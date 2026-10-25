import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
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
  readonly pagos = signal<PaymentTransaction[]>([]);

  readonly pagosPorOrdenMap = computed(() => {
    const map = new Map<string, PaymentTransaction>();
    for (const p of this.pagos()) {
      map.set(String(p.orderId), p);
    }
    return map;
  });

  /**
   * Carga todos los pagos registrados desde payments-service (:8083)
   */
  cargarPagos(): Observable<PaymentTransaction[]> {
    return this.http.get<BackendPagoResponse[]>(`${this.API_URL}/pagos`).pipe(
      map(dtos => (dtos || []).map(dto => PaymentAdapter.toPaymentTransaction(dto))),
      tap(lista => this.pagos.set(lista)),
      catchError(() => of([]))
    );
  }

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
      catchError((error: HttpErrorResponse) => {
        // Sin respuesta del backend no hay pago que registrar: el error sube al llamador
        // en vez de fabricar una transacción aprobada.
        this.isLoading.set(false);
        return throwError(() => error);
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
   * RF22: Obtener Pago por ID de Pago
   */
  obtener(pagoId: number | string): Observable<PaymentTransaction | null> {
    const cleanId = typeof pagoId === 'number' ? pagoId : parseInt(String(pagoId).replace('pay-', ''), 10) || 1;
    return this.http.get<BackendPagoResponse>(`${this.API_URL}/pagos/${cleanId}`).pipe(
      map(dto => PaymentAdapter.toPaymentTransaction(dto)),
      catchError(() => of(null))
    );
  }

  /**
   * Mercado Pago Checkout Pro: Crear Preferencia
   * 1. Llama al microservicio de pagos propio (:8083), unico que habla con Mercado Pago.
   * 2. Si la pasarela no responde, el error sube al llamador: no se simula un cobro.
   * El access token de Mercado Pago nunca viaja al navegador.
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
    });
  }
}
