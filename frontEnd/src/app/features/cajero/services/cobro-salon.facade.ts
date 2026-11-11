import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, switchMap, throwError } from 'rxjs';
import { PaymentService } from '../../../core/services/payment.service';
import { FinanceService } from '../../../core/services/finance.service';
import { FinanceApiService } from '../../../core/api/finance-api.service';
import { OrdersService } from '../../../core/services/orders.service';
import { Order } from '../../../core/models/order.model';
import { PaymentMethod } from '../../../core/models/order.model';
import { BackendComprobanteResponse } from '../../../core/models/api-contracts.model';
import { mensajeError } from '../../../core/utils/api-error';
import { DatosFiscales } from '../models/datos-fiscales';
import { MetodoCobro } from '../models/cajero.models';

/** Step of the charge that failed. */
export type PasoCobro = 'CAJA' | 'PAGO' | 'COMPROBANTE' | 'CIERRE';

export interface ErrorCobro {
  paso: PasoCobro;
  mensaje: string;
  /** True when the money was already taken: the comanda must stay pending, never be charged again. */
  pagoAprobado: boolean;
  comprobante?: BackendComprobanteResponse;
}

export interface ResultadoCobro {
  comprobante: BackendComprobanteResponse;
}

const ESTADOS_CERRADOS = ['COMPLETADO', 'ENTREGADO', 'CANCELADO'];

/**
 * Charge of a dine-in comanda at the POS (plan 03, flow 4.1): payment, then receipt and cash income
 * in one finance transaction, then order and table closing. The pending steps are derived from the
 * backend on every call (D3.17): an APPROVED payment is never charged again, and the receipt is
 * idempotent per order, so retrying after any failure only completes what is missing.
 */
@Injectable({ providedIn: 'root' })
export class CobroSalonFacade {
  private readonly pagos = inject(PaymentService);
  private readonly finanzas = inject(FinanceService);
  private readonly finanzasApi = inject(FinanceApiService);
  private readonly ordenes = inject(OrdersService);

  cobrar(orden: Order, metodo: MetodoCobro, referencia: string, datosFiscales: DatosFiscales): Observable<ResultadoCobro> {
    const esEfectivo = metodo === 'EFECTIVO';

    return this.verificarCaja(esEfectivo).pipe(
      switchMap(() => this.asegurarPagoAprobado(orden, metodo, referencia)),
      switchMap(() =>
        this.finanzas.registrarVentaEnCaja(orden.id, datosFiscales, esEfectivo).pipe(
          catchError(err => throwError(() => this.error('COMPROBANTE', err, 'No se pudo emitir el comprobante', true)))
        )
      ),
      switchMap(comprobante => this.cerrarOrden(orden, comprobante))
    );
  }

  /** Fresh read of the cash register: the cached signal may be stale (R3.7). */
  private verificarCaja(esEfectivo: boolean): Observable<void> {
    if (!esEfectivo) return of(undefined);
    return this.finanzasApi.obtenerCajaActual().pipe(
      catchError(() => of(null)),
      switchMap(caja => caja?.estado === 'ABIERTA'
        ? of(undefined)
        : throwError(() => ({
            paso: 'CAJA',
            mensaje: 'No hay una caja abierta. Abre la caja para cobrar en efectivo; tarjeta y Yape siguen disponibles.',
            pagoAprobado: false
          } satisfies ErrorCobro)))
    );
  }

  private asegurarPagoAprobado(orden: Order, metodo: MetodoCobro, referencia: string): Observable<void> {
    return this.pagos.obtenerPorOrden(orden.id).pipe(
      switchMap(existente => {
        if (existente?.estado === 'APROBADO') return of(undefined);
        if (existente?.estado === 'CANCELADO') {
          return throwError(() => ({
            paso: 'PAGO', mensaje: 'El pago de esta orden fue cancelado; no se puede cobrar.', pagoAprobado: false
          } satisfies ErrorCobro));
        }
        const pagoId$ = existente
          ? of(Number(existente.id))
          : this.pagos.iniciarPago(orden.id, orden.total, metodo as unknown as PaymentMethod).pipe(map(tx => Number(tx.id)));
        return pagoId$.pipe(
          switchMap(pagoId => this.pagos.confirmarPago(pagoId, referencia)),
          switchMap(confirmado => confirmado?.estado === 'APROBADO'
            ? of(undefined)
            : throwError(() => ({
                paso: 'PAGO', mensaje: 'No se pudo confirmar el cobro en el servicio de pagos.', pagoAprobado: false
              } satisfies ErrorCobro)))
        );
      }),
      catchError(err => throwError(() => this.esErrorCobro(err)
        ? err
        : this.error('PAGO', err, 'No se pudo registrar el cobro', false)))
    );
  }

  private cerrarOrden(orden: Order, comprobante: BackendComprobanteResponse): Observable<ResultadoCobro> {
    if (ESTADOS_CERRADOS.includes(orden.estado)) return of({ comprobante });
    return this.ordenes.completarOrdenSalon(orden.id, orden.estado).pipe(
      map(() => ({ comprobante })),
      catchError(err => throwError(() => ({
        ...this.error('CIERRE', err, 'No se pudo cerrar la comanda', true),
        comprobante
      } satisfies ErrorCobro)))
    );
  }

  private error(paso: PasoCobro, err: unknown, porDefecto: string, pagoAprobado: boolean): ErrorCobro {
    return { paso, mensaje: mensajeError(err, porDefecto), pagoAprobado };
  }

  private esErrorCobro(err: unknown): err is ErrorCobro {
    return !!err && typeof err === 'object' && 'paso' in err && 'pagoAprobado' in err;
  }
}
