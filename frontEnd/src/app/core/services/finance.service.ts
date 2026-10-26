import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { 
  ArqueoCaja, AperturaCajaRequest, MovimientoCaja, MovimientoCajaRequest, 
  CierreCajaRequest, BalanceDiario 
} from '../models/finance.model';
import { 
  BackendComprobanteResponse, 
  BackendLiquidacionResponse 
} from '../models/api-contracts.model';
import { environment } from '../../../environments/environment';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root'
})
export class FinanceService {
  private http = inject(HttpClient);
  private notify = inject(NotificationService);

  private readonly API_URL = environment.financeApiUrl || 'http://localhost:8087';

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
    this.http.get<ArqueoCaja>(`${this.API_URL}/finanzas/caja/actual`).pipe(
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

    return this.http.post<ArqueoCaja>(`${this.API_URL}/finanzas/caja/apertura`, req).pipe(
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
    return this.http.post<MovimientoCaja>(`${this.API_URL}/finanzas/caja/movimientos`, payload).pipe(
      tap(mov => {
        this.notify.showSuccess(`Movimiento de ${mov.tipo} registrado por S/ ${mov.monto.toFixed(2)}`);
        this.obtenerCajaActual();
        this.cargarMovimientos();
      })
    );
  }

  cargarMovimientos(): void {
    this.http.get<MovimientoCaja[]>(`${this.API_URL}/finanzas/caja/movimientos`).pipe(
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

    const url = id ? `${this.API_URL}/finanzas/caja/cierre?arqueoId=${id}` : `${this.API_URL}/finanzas/caja/cierre`;
    return this.http.post<ArqueoCaja>(url, req).pipe(
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
    const query = fecha ? `?fecha=${fecha}` : '';
    this.http.get<BalanceDiario>(`${this.API_URL}/finanzas/balance/diario${query}`).pipe(
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
    this.http.get<ArqueoCaja[]>(`${this.API_URL}/finanzas/caja/historial`).pipe(
      tap(h => this.historial.set(h)),
      catchError(() => of([]))
    ).subscribe();
  }

  // --- Comprobantes Electrónicos (Boleta / Factura) ---

  emitirComprobante(req: {
    ordenId: number;
    tipo: 'BOLETA' | 'FACTURA';
    clienteTipoDoc?: string;
    clienteNumDoc?: string;
    clienteNombre: string;
    clienteDireccion?: string;
    total: number;
    pagadoDigitalmente: boolean;
    vueltoEstimado?: number;
  }): Observable<BackendComprobanteResponse> {
    return this.http.post<BackendComprobanteResponse>(`${this.API_URL}/finanzas/comprobantes`, req);
  }

  obtenerComprobantePorOrden(ordenId: number | string): Observable<BackendComprobanteResponse> {
    return this.http.get<BackendComprobanteResponse>(`${this.API_URL}/finanzas/comprobantes/orden/${ordenId}`);
  }

  // --- Liquidaciones de Repartidores ---

  abrirLiquidacion(req: {
    repartidorId: number;
    repartidorNombre: string;
    fondoInicial: number;
    observaciones?: string;
  }): Observable<BackendLiquidacionResponse> {
    return this.http.post<BackendLiquidacionResponse>(`${this.API_URL}/finanzas/liquidaciones/apertura`, req);
  }

  cerrarLiquidacion(id: number | string, req: {
    totalRendido: number;
    totalCobradoEfectivo?: number;
    observaciones?: string;
  }): Observable<BackendLiquidacionResponse> {
    return this.http.post<BackendLiquidacionResponse>(`${this.API_URL}/finanzas/liquidaciones/${id}/cierre`, req);
  }

  listarLiquidacionesPorRepartidor(repartidorId: number | string): Observable<BackendLiquidacionResponse[]> {
    return this.http.get<BackendLiquidacionResponse[]>(`${this.API_URL}/finanzas/liquidaciones/repartidor/${repartidorId}`).pipe(
      catchError(() => of([]))
    );
  }

  listarLiquidacionesAbiertas(): Observable<BackendLiquidacionResponse[]> {
    return this.http.get<BackendLiquidacionResponse[]>(`${this.API_URL}/finanzas/liquidaciones/abiertas`).pipe(
      catchError(() => of([]))
    );
  }
}
