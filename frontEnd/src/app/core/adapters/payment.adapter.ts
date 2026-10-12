import {
  BackendEstadoPago,
  BackendIniciarPagoRequest,
  BackendMetodoPago,
  BackendPagoResponse
} from '../models/api-contracts.model';
import { PaymentMethod } from '../models/order.model';
import { PaymentStatus, PaymentTransaction, ProcessPaymentRequest } from '../models/payment.model';

export class PaymentAdapter {
  /**
   * Mapea método de pago del frontend al enum del backend
   */
  static toBackendMetodoPago(method: PaymentMethod | string): BackendMetodoPago {
    if (!method) return 'TARJETA';
    const m = method.toUpperCase();
    if (m === 'YAPE' || m === 'PLIN' || m === 'YAPE_PLIN') return 'YAPE_PLIN';
    if (m === 'EFECTIVO_CONTRAENTREGA' || m === 'CONTRAENTREGA' || m === 'EFECTIVO') return 'CONTRAENTREGA';
    return 'TARJETA';
  }

  /**
   * Mapea método de pago del backend al frontend
   */
  static toPaymentMethod(backendMethod: BackendMetodoPago | string): PaymentMethod {
    if (!backendMethod) return 'TARJETA';
    const m = backendMethod.toUpperCase();
    if (m === 'YAPE_PLIN') return 'YAPE';
    if (m === 'CONTRAENTREGA') return 'EFECTIVO_CONTRAENTREGA';
    return 'TARJETA';
  }

  /**
   * Mapea estado de pago del backend al frontend
   */
  static toPaymentStatus(backendEstado: BackendEstadoPago | string): PaymentStatus {
    if (!backendEstado) return 'PENDIENTE';
    const e = backendEstado.toUpperCase();
    if (e === 'APROBADO') return 'APROBADO';
    if (e === 'RECHAZADO') return 'RECHAZADO';
    if (e === 'CANCELADO') return 'CANCELADO';
    return 'PENDIENTE';
  }

  /**
   * Transforma una respuesta de pago del backend a PaymentTransaction
   */
  static toPaymentTransaction(dto: BackendPagoResponse): PaymentTransaction {
    return {
      id: String(dto.id),
      orderId: String(dto.ordenId),
      metodo: this.toPaymentMethod(dto.metodoPago),
      monto: typeof dto.monto === 'number' ? dto.monto : parseFloat(String(dto.monto)) || 0,
      estado: this.toPaymentStatus(dto.estado),
      numeroOperacion: dto.referenciaExterna || undefined,
      comprobanteUrl: undefined,
      fechaTransaccion: dto.creadoEn || new Date().toISOString()
    };
  }

  /**
   * Construye el request de inicio de pago para el backend
   */
  static toBackendIniciarRequest(
    ordenId: number | string,
    monto: number,
    metodo: PaymentMethod,
    telefonoYape?: string
  ): BackendIniciarPagoRequest {
    const cleanOrderId = typeof ordenId === 'number' ? ordenId : parseInt(String(ordenId).replace('ord-', ''), 10) || 1;
    const backendMetodo = this.toBackendMetodoPago(metodo);

    // Sin tokenPasarela inventado: un token falso hace que el backend apruebe un cobro que
    // nunca existió. El cobro real con tarjeta se resuelve en el Checkout Pro de Mercado Pago
    // (POST /pagos/mercadopago/preferencia); sin token, la pasarela rechaza el cargo.
    return {
      ordenId: cleanOrderId,
      monto: Math.round(monto * 100) / 100,
      metodoPago: backendMetodo,
      telefonoYape: backendMetodo === 'YAPE_PLIN' ? (telefonoYape || '987654321') : undefined
    };
  }
}
