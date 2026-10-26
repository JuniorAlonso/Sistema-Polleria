import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ArqueoCaja, AperturaCajaRequest, MovimientoCaja, CierreCajaRequest, BalanceDiario,
  EmitirComprobanteRequest, AbrirLiquidacionRequest, CerrarLiquidacionRequest
} from '../models/finance.model';
import { BackendComprobanteResponse, BackendEfectivoPendienteLiquidacion, BackendLiquidacionResponse } from '../models/api-contracts.model';
import { environment } from '../../../environments/environment';

/** Capa HTTP pura de finance-service (:8087). Sin estado, sin notificaciones. */
@Injectable({ providedIn: 'root' })
export class FinanceApiService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = environment.financeApiUrl || 'http://localhost:8087';

  obtenerCajaActual(): Observable<ArqueoCaja> {
    return this.http.get<ArqueoCaja>(`${this.API_URL}/finanzas/caja/actual`);
  }

  abrirCaja(req: AperturaCajaRequest): Observable<ArqueoCaja> {
    return this.http.post<ArqueoCaja>(`${this.API_URL}/finanzas/caja/apertura`, req);
  }

  registrarMovimiento(payload: unknown): Observable<MovimientoCaja> {
    return this.http.post<MovimientoCaja>(`${this.API_URL}/finanzas/caja/movimientos`, payload);
  }

  listarMovimientos(): Observable<MovimientoCaja[]> {
    return this.http.get<MovimientoCaja[]>(`${this.API_URL}/finanzas/caja/movimientos`);
  }

  cerrarCaja(req: CierreCajaRequest, arqueoId?: number | null): Observable<ArqueoCaja> {
    const url = arqueoId
      ? `${this.API_URL}/finanzas/caja/cierre?arqueoId=${arqueoId}`
      : `${this.API_URL}/finanzas/caja/cierre`;
    return this.http.post<ArqueoCaja>(url, req);
  }

  obtenerBalanceDiario(fecha?: string): Observable<BalanceDiario> {
    const query = fecha ? `?fecha=${fecha}` : '';
    return this.http.get<BalanceDiario>(`${this.API_URL}/finanzas/balance/diario${query}`);
  }

  listarHistorial(): Observable<ArqueoCaja[]> {
    return this.http.get<ArqueoCaja[]>(`${this.API_URL}/finanzas/caja/historial`);
  }

  emitirComprobante(req: EmitirComprobanteRequest): Observable<BackendComprobanteResponse> {
    return this.http.post<BackendComprobanteResponse>(`${this.API_URL}/finanzas/comprobantes`, req);
  }

  obtenerComprobantePorOrden(ordenId: number | string): Observable<BackendComprobanteResponse> {
    return this.http.get<BackendComprobanteResponse>(`${this.API_URL}/finanzas/comprobantes/orden/${ordenId}`);
  }

  abrirLiquidacion(req: AbrirLiquidacionRequest): Observable<BackendLiquidacionResponse> {
    return this.http.post<BackendLiquidacionResponse>(`${this.API_URL}/finanzas/liquidaciones/apertura`, req);
  }

  cerrarLiquidacion(id: number | string, req: CerrarLiquidacionRequest): Observable<BackendLiquidacionResponse> {
    return this.http.post<BackendLiquidacionResponse>(`${this.API_URL}/finanzas/liquidaciones/${id}/cierre`, req);
  }

  listarLiquidacionesPorRepartidor(repartidorId: number | string): Observable<BackendLiquidacionResponse[]> {
    return this.http.get<BackendLiquidacionResponse[]>(`${this.API_URL}/finanzas/liquidaciones/repartidor/${repartidorId}`);
  }

  obtenerEfectivoPendienteLiquidacion(repartidorId: number | string): Observable<BackendEfectivoPendienteLiquidacion> {
    return this.http.get<BackendEfectivoPendienteLiquidacion>(
      `${this.API_URL}/finanzas/liquidaciones/repartidor/${repartidorId}/pendiente`);
  }

  listarLiquidacionesAbiertas(): Observable<BackendLiquidacionResponse[]> {
    return this.http.get<BackendLiquidacionResponse[]>(`${this.API_URL}/finanzas/liquidaciones/abiertas`);
  }
}
