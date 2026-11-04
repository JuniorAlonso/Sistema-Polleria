import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BackendActualizarEstadoRequest, BackendOrdenResponse } from '../models/api-contracts.model';
import { environment } from '../../../environments/environment';

/** Capa HTTP pura de orders-service (:8082). Sin estado, sin mapeo a modelos de UI. */
@Injectable({ providedIn: 'root' })
export class OrdersApiService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = environment.ordersApiUrl || 'http://localhost:8082';

  listarMisOrdenes(): Observable<BackendOrdenResponse[]> {
    return this.http.get<BackendOrdenResponse[]>(`${this.API_URL}/ordenes/mis-ordenes`);
  }

  listarSeguimiento(token: string): Observable<BackendOrdenResponse[]> {
    return this.http.get<BackendOrdenResponse[]>(`${this.API_URL}/ordenes/seguimiento`, {
      headers: { 'X-Seguimiento-Token': token }
    });
  }

  solicitarCodigoSeguimiento(telefono: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.API_URL}/ordenes/seguimiento/codigo`, { telefono });
  }

  verificarCodigoSeguimiento(telefono: string, codigo: string): Observable<{ token: string }> {
    return this.http.post<{ token: string }>(`${this.API_URL}/ordenes/seguimiento/verificar`, { telefono, codigo });
  }

  cancelarSeguimiento(id: number | string, token: string): Observable<BackendOrdenResponse> {
    return this.http.post<BackendOrdenResponse>(
      `${this.API_URL}/ordenes/seguimiento/${id}/cancelar`,
      {},
      { headers: { 'X-Seguimiento-Token': token } }
    );
  }

  crear(body: unknown): Observable<BackendOrdenResponse> {
    return this.http.post<BackendOrdenResponse>(`${this.API_URL}/ordenes`, body);
  }

  obtener(id: number | string): Observable<BackendOrdenResponse> {
    return this.http.get<BackendOrdenResponse>(`${this.API_URL}/ordenes/${id}`);
  }

  agregarItems(id: number | string, body: unknown): Observable<BackendOrdenResponse> {
    return this.http.post<BackendOrdenResponse>(`${this.API_URL}/ordenes/${id}/items`, body);
  }

  servir(id: number | string): Observable<BackendOrdenResponse> {
    return this.http.post<BackendOrdenResponse>(`${this.API_URL}/ordenes/${id}/servir`, {});
  }

  listar(): Observable<BackendOrdenResponse[]> {
    return this.http.get<BackendOrdenResponse[]>(`${this.API_URL}/ordenes`);
  }

  listarActivas(): Observable<BackendOrdenResponse[]> {
    return this.http.get<BackendOrdenResponse[]>(`${this.API_URL}/ordenes/activos`);
  }

  listarCocina(): Observable<BackendOrdenResponse[]> {
    return this.http.get<BackendOrdenResponse[]>(`${this.API_URL}/ordenes/cocina`);
  }

  listarDisponibles(): Observable<BackendOrdenResponse[]> {
    return this.http.get<BackendOrdenResponse[]>(`${this.API_URL}/ordenes/disponibles`);
  }

  reclamar(id: number | string): Observable<BackendOrdenResponse> {
    return this.http.post<BackendOrdenResponse>(`${this.API_URL}/ordenes/${id}/reclamo`, {});
  }

  actualizarEstado(id: number | string, payload: BackendActualizarEstadoRequest): Observable<BackendOrdenResponse> {
    return this.http.patch<BackendOrdenResponse>(`${this.API_URL}/ordenes/${id}/estado`, payload);
  }

  confirmarLlamada(id: number | string): Observable<BackendOrdenResponse> {
    return this.http.post<BackendOrdenResponse>(`${this.API_URL}/ordenes/${id}/confirmar-llamada`, {});
  }

  registrarIntentoLlamada(id: number | string, observaciones?: string): Observable<BackendOrdenResponse> {
    return this.http.post<BackendOrdenResponse>(`${this.API_URL}/ordenes/${id}/intento-llamada`, { observaciones });
  }

  marcarEnPuerta(id: number | string): Observable<BackendOrdenResponse> {
    return this.http.post<BackendOrdenResponse>(`${this.API_URL}/ordenes/${id}/en-puerta`, {});
  }

  declararPedidoFantasma(id: number | string, motivo?: string): Observable<BackendOrdenResponse> {
    return this.http.post<BackendOrdenResponse>(`${this.API_URL}/ordenes/${id}/pedido-fantasma`, { motivo });
  }
}
