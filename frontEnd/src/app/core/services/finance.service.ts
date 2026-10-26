import { Injectable, inject, signal } from '@angular/core';
import { FinanceApiService } from '../api/finance-api.service';
import { Observable, tap, catchError, of } from 'rxjs';
import { 
  ArqueoCaja, AperturaCajaRequest, MovimientoCaja, MovimientoCajaRequest, 
  CierreCajaRequest, BalanceDiario, EmitirComprobanteRequest,
  AbrirLiquidacionRequest, CerrarLiquidacionRequest
} from '../models/finance.model';
import { 
  BackendComprobanteResponse, 
  BackendLiquidacionResponse 
} from '../models/api-contracts.model';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root'
})
export class FinanceService {
  private api = inject(FinanceApiService);
  private notify = inject(NotificationService);


  readonly cajaActual = signal<ArqueoCaja | null>(null);
  readonly balanceDiario = signal<BalanceDiario | null>(null);
  readonly historial = signal<ArqueoCaja[]>([]);
  readonly movimientos = signal<MovimientoCaja[]>([]);
  readonly isLoading = signal<boolean>(false);

  constructor() {
    this.obtenerCajaActual();
    this.cargarBalanceDiario();
    this.cargarHistorial();
    this.cargarMovimientos();
  }

  obtenerCajaActual(): void {
    this.api.obtenerCajaActual().pipe(
      tap(caja => {
        if (caja) {
          caja.montoInicial = caja.montoApertura;
          caja.ventasEfectivo = caja.montoCierreEfectivo || 0;
          caja.discrepancia = caja.diferencia || 0;
        }
        this.cajaActual.set(caja);
      }),
      catchError(() => {
        this.cajaActual.set(null);
        return of(null);
      })
    ).subscribe();
  }

  cargarCajaActual(): void {
    this.obtenerCajaActual();
  }

  abrirCaja(reqOrMonto: AperturaCajaRequest | number): Observable<ArqueoCaja> {
    const req: AperturaCajaRequest = typeof reqOrMonto === 'number'
      ? { montoApertura: reqOrMonto }
      : reqOrMonto;

    return this.api.abrirCaja(req).pipe(
      tap(caja => {
        if (caja) {
          caja.montoInicial = caja.montoApertura;
          caja.ventasEfectivo = caja.montoCierreEfectivo || 0;
          caja.discrepancia = caja.diferencia || 0;
        }
        this.cajaActual.set(caja);
        this.notify.showSuccess(`Caja #${caja.id} abierta con fondo de S/ ${caja.montoApertura.toFixed(2)}`);
      })
    );
  }

  registrarMovimiento(req: MovimientoCajaRequest): Observable<MovimientoCaja> {
    const payload = {
      ...req,
      motivo: req.motivo || req.concepto || 'Movimiento de caja'
    };
    return this.api.registrarMovimiento(payload).pipe(
      tap(mov => {
        this.notify.showSuccess(`Movimiento de ${mov.tipo} registrado por S/ ${mov.monto.toFixed(2)}`);
        this.obtenerCajaActual();
        this.cargarMovimientos();
      })
    );
  }

  cargarMovimientos(): void {
    this.api.listarMovimientos().pipe(
      tap(m => {
        const mapped = m.map(item => ({
          ...item,
          concepto: item.concepto || item.motivo,
          fechaHora: item.fechaHora || item.fecha,
          usuario: item.usuario || `Usuario #${item.registradoPor}`
        }));
        this.movimientos.set(mapped);
      }),
      catchError(() => of([]))
    ).subscribe();
  }

  cerrarCaja(montoOrId?: number | null | CierreCajaRequest, reqOrObs?: CierreCajaRequest | string): Observable<ArqueoCaja> {
    let id: number | null = null;
    let req: CierreCajaRequest;

    if (typeof montoOrId === 'number' && typeof reqOrObs === 'string') {
      req = {
        montoCierreEfectivo: montoOrId,
        montoCierrePos: 0,
        observaciones: reqOrObs
      };
    } else if (typeof montoOrId === 'object' && montoOrId !== null) {
      req = montoOrId as CierreCajaRequest;
    } else {
      id = (typeof montoOrId === 'number' ? montoOrId : null);
      req = (typeof reqOrObs === 'object' && reqOrObs !== null ? reqOrObs : { montoCierreEfectivo: 0, montoCierrePos: 0 });
    }

    return this.api.cerrarCaja(req, id).pipe(
      tap(cerrada => {
        if (cerrada) {
          cerrada.montoInicial = cerrada.montoApertura;
          cerrada.ventasEfectivo = cerrada.montoCierreEfectivo || 0;
          cerrada.ventasDigital = cerrada.ventasDigitales || 0;
          cerrada.discrepancia = cerrada.diferencia || 0;
        }
        this.cajaActual.set(null);
        this.notify.showSuccess(`Caja cerrada con diferencia de S/ ${cerrada.diferencia?.toFixed(2) || '0.00'}`);
        this.cargarHistorial();
        this.cargarBalanceDiario();
      })
    );
  }

  cargarBalanceDiario(fecha?: string): void {
    this.api.obtenerBalanceDiario(fecha).pipe(
      tap(b => {
        if (b) {
          b.totalVentas = b.ingresos?.totalIngresos || 0;
          b.saldoNeto = b.balanceNeto || 0;
          b.totalGastos = b.egresos?.totalEgresos || 0;
        }
        this.balanceDiario.set(b);
      }),
      catchError(() => of(null))
    ).subscribe();
  }

  cargarHistorial(): void {
    this.api.listarHistorial().pipe(
      tap(h => this.historial.set(h)),
      catchError(() => of([]))
    ).subscribe();
  }

  // --- Comprobantes Electrónicos (Boleta / Factura) ---

  emitirComprobante(req: EmitirComprobanteRequest): Observable<BackendComprobanteResponse> {
    return this.api.emitirComprobante(req);
  }

  obtenerComprobantePorOrden(ordenId: number | string): Observable<BackendComprobanteResponse> {
    return this.api.obtenerComprobantePorOrden(ordenId);
  }

  // --- Liquidaciones de Repartidores ---

  abrirLiquidacion(req: AbrirLiquidacionRequest): Observable<BackendLiquidacionResponse> {
    return this.api.abrirLiquidacion(req);
  }

  cerrarLiquidacion(id: number | string, req: CerrarLiquidacionRequest): Observable<BackendLiquidacionResponse> {
    return this.api.cerrarLiquidacion(id, req);
  }

  listarLiquidacionesPorRepartidor(repartidorId: number | string): Observable<BackendLiquidacionResponse[]> {
    return this.api.listarLiquidacionesPorRepartidor(repartidorId).pipe(
      catchError(() => of([]))
    );
  }

  listarLiquidacionesAbiertas(): Observable<BackendLiquidacionResponse[]> {
    return this.api.listarLiquidacionesAbiertas().pipe(
      catchError(() => of([]))
    );
  }
}
