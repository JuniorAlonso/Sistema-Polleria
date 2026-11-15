import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { PaymentMethod } from '../models/order.model';
import { PaymentTransaction, PagoOrdenAdmin, MercadoPagoPaymentMethod, MercadoPagoPreferenceResponse } from '../models/payment.model';
import { PaymentsApiService } from '../api/payments-api.service';
import { BackendCobroEfectivoRequest, BackendMetodoPago } from '../models/api-contracts.model';
import { PaymentAdapter } from '../adapters/payment.adapter';
import { parsePositiveIntId } from '../utils/id';
import { mensajeError } from '../utils/api-error';

export type { EstadoPagoAdmin, PagoOrdenAdmin } from '../models/payment.model';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private api = inject(PaymentsApiService);

  readonly lastTransaction = signal<PaymentTransaction | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly pagos = signal<PaymentTransaction[]>([]);
  readonly pagosError = signal<string | null>(null);

  readonly pagosPorOrdenMap = computed(() => {
    const map = new Map<string, PaymentTransaction>();
    for (const p of this.pagos()) {
      map.set(String(p.orderId), p);
    }
    return map;
  });

  /**
   * Carga pagos registrados desde payments-service (:8083).
   * Registra pagosError cuando falla el servicio en lugar de confundirlo con una lista vacía.
   */
  cargarPagos(filtro?: { estado?: string; fecha?: string; limit?: number }): Observable<PaymentTransaction[]> {
    this.pagosError.set(null);
    return this.api.listar(filtro).pipe(
      map(dtos => (dtos || []).map(dto => PaymentAdapter.toPaymentTransaction(dto))),
      tap(lista => this.pagos.set(lista)),
      catchError((error: unknown) => {
        this.pagosError.set(mensajeError(error, 'No se pudo cargar la lista de pagos.'));
        return of([]);
      })
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
    const cleanId = parsePositiveIntId(ordenId);
    if (!cleanId) {
      return throwError(() => new Error(`Id de orden inválido: ${ordenId}`));
    }
    this.isLoading.set(true);
    const backendReq = PaymentAdapter.toBackendIniciarRequest(cleanId, monto, metodo, telefonoYape);

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
   * RF22: Obtener Pago por ID de Orden.
   * Solo 404 significa "sin pago previo"; timeouts y 5xx se propagan para evitar pagos duplicados.
   */
  obtenerPorOrden(ordenId: number | string): Observable<PaymentTransaction | null> {
    const cleanId = parsePositiveIntId(ordenId);
    if (!cleanId) {
      return throwError(() => new Error(`Id de orden inválido: ${ordenId}`));
    }
    return this.api.obtenerPorOrden(cleanId).pipe(
      map(dto => PaymentAdapter.toPaymentTransaction(dto)),
      catchError((error: HttpErrorResponse) => {
        if (error?.status === 404) {
          return of(null);
        }
        return throwError(() => error);
      })
    );
  }

  /**
   * Errors reach the caller: a 409 (for example an amount that no longer matches the order) carries
   * the reason the cashier must see.
   */
  confirmarPago(
    pagoId: number,
    referencia: string,
    metodoPago?: BackendMetodoPago
  ): Observable<PaymentTransaction | null> {
    const cleanId = parsePositiveIntId(pagoId);
    if (!cleanId) {
      return throwError(() => new Error(`Id de pago inválido: ${pagoId}`));
    }
    const body: { referenciaExterna: string; detalle: string; metodoPago?: BackendMetodoPago } = {
      referenciaExterna: referencia,
      detalle: 'Pago confirmado',
      ...(metodoPago ? { metodoPago } : {})
    };
    return this.api.confirmar(cleanId, body).pipe(
      map(dto => PaymentAdapter.toPaymentTransaction(dto))
    );
  }

  /**
   * RF22: Obtener Pago por ID de Pago
   */
  obtener(pagoId: number | string): Observable<PaymentTransaction | null> {
    const raw = typeof pagoId === 'string' && pagoId.trim().startsWith('pay-')
      ? pagoId.trim().slice(4)
      : pagoId;
    const cleanId = parsePositiveIntId(raw);
    if (!cleanId) {
      return throwError(() => new Error(`Id de pago inválido: ${pagoId}`));
    }
    return this.api.obtener(cleanId).pipe(
      map(dto => PaymentAdapter.toPaymentTransaction(dto)),
      catchError((error: HttpErrorResponse) => {
        if (error?.status === 404) {
          return of(null);
        }
        return throwError(() => error);
      })
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
    const cleanId = parsePositiveIntId(ordenId);
    if (!cleanId) {
      return throwError(() => new Error(`Id de orden inválido: ${ordenId}`));
    }
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
        throwError(() => new Error(mensajeError(error, 'No se pudo cargar la bandeja de verificación.'))))
    );
  }

  /** Uploads the payment proof image of an order; the returned state comes from the backend. */
  subirComprobante(ordenId: number | string, file: File): Observable<PagoOrdenAdmin> {
    const raw = typeof ordenId === 'string' && ordenId.trim().startsWith('POL-')
      ? ordenId.trim().slice(4)
      : ordenId;
    const cleanId = parsePositiveIntId(raw);
    if (!cleanId) {
      return throwError(() => new Error(`Id de orden inválido: ${ordenId}`));
    }
    return this.api.subirComprobante(cleanId, file).pipe(
      map(dto => dto as PagoOrdenAdmin),
      catchError((error: HttpErrorResponse) =>
        throwError(() => new Error(mensajeError(error, 'No se pudo verificar el comprobante de Yape.'))))
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

    const raw = typeof pagoId === 'string' && pagoId.trim().startsWith('pay-')
      ? pagoId.trim().slice(4)
      : pagoId;
    const cleanId = parsePositiveIntId(raw);
    if (!cleanId) {
      return throwError(() => new Error(`Id de pago inválido: ${pagoId}`));
    }
    const body = aprobado ? { aprobado: true } : { aprobado: false, motivoRechazo: motivo };

    return this.api.verificar(cleanId, body).pipe(
      catchError((error: HttpErrorResponse) =>
        throwError(() => new Error(mensajeError(error, 'No se pudo verificar el comprobante de Yape.')))
      )
    );
  }

  /**
   * Mercado Pago Checkout Pro: Crear Preferencia
   * 1. Llama al microservicio de pagos propio (:8083), unico que habla con Mercado Pago.
   * 2. Si la pasarela no responde, el error sube al llamador: no se simula un cobro.
   * El access token de Mercado Pago nunca viaja al navegador.
   */
  crearPreferenciaMercadoPago(ordenId: number | string, monto: number): Observable<MercadoPagoPreferenceResponse> {
    const cleanOrderId = parsePositiveIntId(ordenId);
    if (!cleanOrderId) {
      return throwError(() => new Error(`Id de orden inválido: ${ordenId}`));
    }
    const montoFinal = Math.round(monto * 100) / 100;

    return this.api.crearPreferenciaMercadoPago({
      ordenId: cleanOrderId,
      monto: montoFinal,
      metodoPago: 'TARJETA'
    });
  }

  /**
   * Consulta los medios de pago disponibles configurados en Mercado Pago desde el backend (:8083).
   */
  obtenerMediosPagoMercadoPago(): Observable<MercadoPagoPaymentMethod[]> {
    return this.api.listarMediosDePagoMercadoPago();
  }

  /**
   * Confirma la orden tras el redireccionamiento GET desde Mercado Pago en la URL de retorno.
   */
  confirmarRetornoMercadoPago(params: Record<string, string>): Observable<PaymentTransaction> {
    return this.api.confirmarRetornoMercadoPago(params).pipe(
      map(dto => PaymentAdapter.toPaymentTransaction(dto))
    );
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
    const cleanId = parsePositiveIntId(ordenId);
    if (!cleanId) {
      return throwError(() => new Error(`Id de orden inválido: ${ordenId}`));
    }
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
    vueltoEntregado?: number,
    codigoTicket?: string
  ): Observable<PaymentTransaction> {
    const cleanId = parsePositiveIntId(ordenId);
    if (!cleanId) {
      return throwError(() => new Error(`Id de orden inválido: ${ordenId}`));
    }
    const body: BackendCobroEfectivoRequest = {
      ordenId: cleanId,
      monto: Math.round(monto * 100) / 100,
      montoRecibido: montoRecibido ? Math.round(montoRecibido * 100) / 100 : undefined,
      vueltoEntregado: vueltoEntregado ? Math.round(vueltoEntregado * 100) / 100 : undefined,
      // Pickup collections send the ticket; the courier flow calls without it.
      ...(codigoTicket ? { codigoTicket } : {})
    };

    return this.api.registrarCobroEfectivo(body).pipe(
      map(dto => PaymentAdapter.toPaymentTransaction(dto)),
      tap(tx => this.lastTransaction.set(tx))
    );
  }
}
