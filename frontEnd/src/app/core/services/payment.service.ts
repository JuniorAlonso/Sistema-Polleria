import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { PaymentMethod } from '../models/order.model';
import { PaymentTransaction, PagoOrdenAdmin } from '../models/payment.model';
import { PaymentsApiService } from '../api/payments-api.service';
import { BackendPagoResponse } from '../models/api-contracts.model';
import { PaymentAdapter } from '../adapters/payment.adapter';

export type { EstadoPagoAdmin, PagoOrdenAdmin } from '../models/payment.model';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private api = inject(PaymentsApiService);

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
    return this.api.listar().pipe(
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

    return this.api.iniciar(backendReq).pipe(
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
    return this.api.obtenerPorOrden(cleanId).pipe(
      map(dto => PaymentAdapter.toPaymentTransaction(dto)),
      catchError(() => of(null))
    );
  }

  /**
   * RF23: Confirmar Pago Manualmente
   */
  confirmarPago(pagoId: number, referencia: string): Observable<PaymentTransaction | null> {
    return this.api.confirmar(pagoId, {
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
    return this.api.obtener(cleanId).pipe(
      map(dto => PaymentAdapter.toPaymentTransaction(dto)),
      catchError(() => of(null))
    );
  }

  /**
   * T6e (S6/S7) — pago de una orden para que el `ADMIN` verifique el comprobante de Yape.
   *
   * Se pide **al abrir el detalle** y no se cachea: la URL del comprobante es una firma de vida
   * corta (300 s), así que reusarla mostraría una imagen rota. El error del backend (por ejemplo el
   * 404 de una orden sin pago) se propaga tal cual.
   */
  obtenerPagoParaVerificacion(ordenId: number | string): Observable<PagoOrdenAdmin> {
    const cleanId = typeof ordenId === 'number' ? ordenId : parseInt(String(ordenId).replace('ord-', ''), 10) || 1;
    return this.api.obtenerPagoAdminPorOrden(cleanId);
  }

  /**
   * Cashier/admin inbox: payments waiting for proof verification, with the signed proof URL.
   * Never cached (the URL lives 5 minutes). Errors propagate with the backend message.
   */
  listarPendientesVerificacion(): Observable<PagoOrdenAdmin[]> {
    return this.api.listarPorEstado('PENDIENTE_VERIFICACION').pipe(
      map(list => list as PagoOrdenAdmin[]),
      catchError((error: HttpErrorResponse) =>
        throwError(() => new Error(this.mensajeErrorVerificacion(error))))
    );
  }

  /** Uploads the payment proof image of an order; the returned state comes from the backend. */
  subirComprobante(ordenId: number | string, file: File): Observable<PagoOrdenAdmin> {
    const cleanId = typeof ordenId === 'number' ? ordenId : parseInt(String(ordenId).replace('POL-', '').replace('ord-', ''), 10);
    if (!Number.isFinite(cleanId) || cleanId <= 0) {
      return throwError(() => new Error(`Id de orden inválido: ${ordenId}`));
    }
    return this.api.subirComprobante(cleanId, file).pipe(
      map(dto => dto as PagoOrdenAdmin),
      catchError((error: HttpErrorResponse) =>
        throwError(() => new Error(this.mensajeErrorVerificacion(error))))
    );
  }

  /**
   * T6e (S6) — decisión del `ADMIN` sobre el comprobante de Yape.
   *
   * Rechazar exige motivo: sin motivo no se dispara ninguna llamada (el backend respondería 400 y el
   * cliente no tendría nada que leer en su WhatsApp). Un error del backend se propaga con su mensaje
   * y **sin** reportar éxito: el estado que se muestra es el que devuelve el backend, nunca uno local.
   */
  verificarComprobante(
    pagoId: number | string,
    aprobado: boolean,
    motivoRechazo?: string
  ): Observable<PagoOrdenAdmin> {
    const motivo = (motivoRechazo ?? '').trim();
    if (!aprobado && !motivo) {
      return throwError(() => new Error('El motivo de rechazo es obligatorio'));
    }

    const cleanId = typeof pagoId === 'number' ? pagoId : parseInt(String(pagoId).replace('pay-', ''), 10) || 1;
    const body = aprobado ? { aprobado: true } : { aprobado: false, motivoRechazo: motivo };

    return this.api.verificar(cleanId, body).pipe(
      catchError((error: HttpErrorResponse) =>
        throwError(() => new Error(this.mensajeErrorVerificacion(error)))
      )
    );
  }

  /** Mensaje del backend tal cual; solo hay un texto propio cuando no vino ninguno. */
  private mensajeErrorVerificacion(error: HttpErrorResponse): string {
    const cuerpo = error?.error;
    const mensaje = typeof cuerpo === 'string'
      ? cuerpo
      : cuerpo?.error || cuerpo?.mensaje || cuerpo?.message;
    return typeof mensaje === 'string' && mensaje.trim()
      ? mensaje
      : 'No se pudo verificar el comprobante de Yape.';
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

    return this.api.crearPreferenciaMercadoPago({
      ordenId: cleanOrderId,
      monto: montoFinal,
      metodoPago: 'TARJETA'
    });
  }

  /**
   * Cobro directo con Yape integrado en Mercado Pago (OTP 6 dígitos).
   */
  pagarConYapeOtp(
    ordenId: number | string,
    monto: number,
    telefono: string,
    otp: string,
    email?: string
  ): Observable<PaymentTransaction> {
    const cleanId = typeof ordenId === 'number' ? ordenId : parseInt(String(ordenId).replace('ord-', ''), 10) || 1;
    const body = {
      ordenId: cleanId,
      monto: Math.round(monto * 100) / 100,
      telefono: telefono.replace(/\D/g, ''),
      otp: otp.trim(),
      email: email?.trim()
    };

    return this.api.pagarConYapeOtp(body).pipe(
      map(dto => PaymentAdapter.toPaymentTransaction(dto)),
      tap(tx => this.lastTransaction.set(tx))
    );
  }

  /**
   * Registro obligatorio de cobro en efectivo antes de completar la entrega (ContraPago).
   */
  registrarCobroEfectivo(
    ordenId: number | string,
    monto: number,
    montoRecibido?: number,
    vueltoEntregado?: number
  ): Observable<PaymentTransaction> {
    const cleanId = typeof ordenId === 'number' ? ordenId : parseInt(String(ordenId).replace('ord-', ''), 10) || 1;
    const body = {
      ordenId: cleanId,
      monto: Math.round(monto * 100) / 100,
      montoRecibido: montoRecibido ? Math.round(montoRecibido * 100) / 100 : undefined,
      vueltoEntregado: vueltoEntregado ? Math.round(vueltoEntregado * 100) / 100 : undefined
    };

    return this.api.registrarCobroEfectivo(body).pipe(
      map(dto => PaymentAdapter.toPaymentTransaction(dto)),
      tap(tx => this.lastTransaction.set(tx))
    );
  }
}
