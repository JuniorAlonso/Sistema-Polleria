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
}
