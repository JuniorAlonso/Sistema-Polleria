import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BackendPagoResponse } from '../models/api-contracts.model';
import { MercadoPagoPreferenceResponse, PagoOrdenAdmin } from '../models/payment.model';
import { environment } from '../../../environments/environment';

/** Capa HTTP pura de payments-service (:8083). Sin estado, sin mapeo a modelos de UI. */
@Injectable({ providedIn: 'root' })
export class PaymentsApiService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = environment.paymentsApiUrl || 'http://localhost:8083';

  listar(): Observable<BackendPagoResponse[]> {
    return this.http.get<BackendPagoResponse[]>(`${this.API_URL}/pagos`);
  }

  iniciar(body: unknown): Observable<BackendPagoResponse> {
    return this.http.post<BackendPagoResponse>(`${this.API_URL}/pagos`, body);
  }

  obtenerPorOrden(ordenId: number | string): Observable<BackendPagoResponse> {
    return this.http.get<BackendPagoResponse>(`${this.API_URL}/pagos/orden/${ordenId}`);
  }

  obtenerPagoAdminPorOrden(ordenId: number | string): Observable<PagoOrdenAdmin> {
    return this.http.get<PagoOrdenAdmin>(`${this.API_URL}/pagos/orden/${ordenId}`);
  }

  obtener(pagoId: number | string): Observable<BackendPagoResponse> {
    return this.http.get<BackendPagoResponse>(`${this.API_URL}/pagos/${pagoId}`);
  }

  confirmar(pagoId: number | string, body: { referenciaExterna: string; detalle: string }): Observable<BackendPagoResponse> {
    return this.http.patch<BackendPagoResponse>(`${this.API_URL}/pagos/${pagoId}/confirmar`, body);
  }

  verificar(pagoId: number | string, body: unknown): Observable<PagoOrdenAdmin> {
    return this.http.post<PagoOrdenAdmin>(`${this.API_URL}/pagos/${pagoId}/verificar`, body);
  }

  crearPreferenciaMercadoPago(body: unknown): Observable<MercadoPagoPreferenceResponse> {
    return this.http.post<MercadoPagoPreferenceResponse>(`${this.API_URL}/pagos/mercadopago/preferencia`, body);
  }

  pagarConYapeOtp(body: unknown): Observable<BackendPagoResponse> {
    return this.http.post<BackendPagoResponse>(`${this.API_URL}/pagos/yape-otp`, body);
  }

  registrarCobroEfectivo(body: unknown): Observable<BackendPagoResponse> {
    return this.http.post<BackendPagoResponse>(`${this.API_URL}/pagos/cobro-efectivo`, body);
  }
}
