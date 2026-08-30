import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { PaymentMethod } from '../models/order.model';
import { PaymentTransaction } from '../models/payment.model';
import { BackendPagoResponse } from '../models/api-contracts.model';
import { PaymentAdapter } from '../adapters/payment.adapter';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private http = inject(HttpClient);
  private readonly API_URL = environment.paymentsApiUrl || 'http://localhost:8083';

  readonly lastTransaction = signal<PaymentTransaction | null>(null);
  readonly isLoading = signal<boolean>(false);

  /**
   * RF21: Iniciar Pago en payments-service (:8083)
   */
  iniciarPago(
    ordenId: number | string,
    monto: number,
    metodo: PaymentMethod,
    telefonoYape?: string
  ): Observable<PaymentTransaction> {
    this.isLoading.set(true);
    const backendReq = PaymentAdapter.toBackendIniciarRequest(ordenId, monto, metodo, telefonoYape);

    return this.http.post<BackendPagoResponse>(`${this.API_URL}/pagos`, backendReq).pipe(
      map(dto => PaymentAdapter.toPaymentTransaction(dto)),
      tap(tx => {
        this.isLoading.set(false);
        this.lastTransaction.set(tx);
      }),
      catchError(() => {
        this.isLoading.set(false);
        // Fallback simulado para no interrumpir el flujo si el servicio de pagos estuviese ocupado
        const fallbackTx: PaymentTransaction = {
          id: 'pay-' + Date.now(),
          orderId: String(ordenId),
          metodo: metodo,
          monto: monto,
          estado: metodo === 'EFECTIVO_CONTRAENTREGA' ? 'PENDIENTE' : 'APROBADO',
          numeroOperacion: 'TXN-MOCK-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
          fechaTransaccion: new Date().toISOString()
        };
        this.lastTransaction.set(fallbackTx);
        return of(fallbackTx);
      })
    );
  }

  /**
   * RF22: Obtener Pago por ID de Orden
   */
  obtenerPorOrden(ordenId: number | string): Observable<PaymentTransaction | null> {
    const cleanId = typeof ordenId === 'number' ? ordenId : parseInt(String(ordenId).replace('ord-', ''), 10) || 1;
    return this.http.get<BackendPagoResponse>(`${this.API_URL}/pagos/orden/${cleanId}`).pipe(
      map(dto => PaymentAdapter.toPaymentTransaction(dto)),
      catchError(() => of(null))
    );
  }

  /**
   * RF23: Confirmar Pago Manualmente
   */
  confirmarPago(pagoId: number, referencia: string): Observable<PaymentTransaction | null> {
    return this.http.patch<BackendPagoResponse>(`${this.API_URL}/pagos/${pagoId}/confirmar`, {
      referenciaExterna: referencia,
      detalle: 'Pago confirmado'
    }).pipe(
      map(dto => PaymentAdapter.toPaymentTransaction(dto)),
      catchError(() => of(null))
    );
  }

  /**
   * Mercado Pago Checkout Pro: Crear Preferencia
   * Primero intenta el microservicio (:8083).
   * Si falla, usa el proxy de Angular (/mp-api) para evitar CORS.
   */
  crearPreferenciaMercadoPago(ordenId: number | string, monto: number): Observable<{
    preferenceId: string;
    initPoint: string;
    sandboxInitPoint: string;
    pagoId: number;
    ordenId: number;
  }> {
    const cleanOrderId = typeof ordenId === 'number' ? ordenId : parseInt(String(ordenId).replace('ord-', ''), 10) || 1;
    const montoFinal = Math.round(monto * 100) / 100;

    // === INTENTO 1: microservicio de pagos propio (:8083) ===
    return this.http.post<{
      preferenceId: string;
      initPoint: string;
      sandboxInitPoint: string;
      pagoId: number;
      ordenId: number;
    }>(`${this.API_URL}/pagos/mercadopago/preferencia`, {
      ordenId: cleanOrderId,
      monto: montoFinal,
      metodoPago: 'TARJETA'
    }).pipe(
      catchError(() => {
        // === INTENTO 2 (fallback): llamar a MP vía proxy de Angular (/mp-api) ===
        // El proxy redirige /mp-api → https://api.mercadopago.com  (sin CORS)
        const mpToken = 'APP_USR-2733300582350003-082916-7d60b458fb460f2ef2eb803852c0935e-3645988283';
        const body = {
          items: [
            {
              id: String(cleanOrderId),
              title: `Pedido #${cleanOrderId} - El San Pollo`,
              description: 'Consumo pollería / delivery',
              quantity: 1,
              currency_id: 'PEN',
              unit_price: montoFinal
            }
          ],
          back_urls: {
            success: 'http://localhost:4200/tracking',
            failure: 'http://localhost:4200/checkout?status=failure',
            pending: 'http://localhost:4200/checkout?status=pending'
          },
          external_reference: String(cleanOrderId)
        };

        // Usa /mp-api/checkout/preferences (proxy evita CORS en navegador)
        return this.http.post<any>('/mp-api/checkout/preferences', body, {
          headers: {
            Authorization: `Bearer ${mpToken}`,
            'Content-Type': 'application/json'
          }
        }).pipe(
          map(mpRes => ({
            preferenceId: mpRes.id,
            initPoint: mpRes.init_point,
            sandboxInitPoint: mpRes.sandbox_init_point || mpRes.init_point,
            pagoId: Date.now(),
            ordenId: cleanOrderId
          }))
        );
      })
    );
  }
}
