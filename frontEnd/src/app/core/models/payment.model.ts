/**
 * Mapa de nombres (contratos tipados):
 *  - Captura de pago (UI)      -> PaymentTransaction / ProcessPaymentRequest
 *  - Pago crudo del backend    -> BackendPagoResponse (api-contracts.model.ts)
 *  - Pago para verificar Yape  -> PagoOrdenAdmin
 */
import { PaymentMethod } from './order.model';

export type PaymentStatus = 'PENDIENTE' | 'PENDIENTE_VERIFICACION' | 'APROBADO' | 'RECHAZADO' | 'CANCELADO';

export interface PaymentTransaction {
  id: string;
  orderId: string;
  metodo: PaymentMethod;
  monto: number;
  estado: PaymentStatus;
  numeroOperacion?: string;
  comprobanteUrl?: string;
  fechaTransaccion: string;
}

export interface ProcessPaymentRequest {
  orderId: string;
  metodo: PaymentMethod;
  monto: number;
  detallesTarjeta?: {
    numeroEnmascarado: string;
    titular: string;
  };
  numeroOperacionYapePlin?: string;
}

/**
 * T6e (S6/S7) - estados de un pago de Yape devueltos por `payments-service`.
 * `PENDIENTE_VERIFICACION` no existe en `PaymentStatus` del modelo compartido: la verificacion del
 * comprobante es exclusiva del panel del `ADMIN`.
 */
export type EstadoPagoAdmin =
  | 'PENDIENTE'
  | 'PENDIENTE_VERIFICACION'
  | 'APROBADO'
  | 'RECHAZADO'
  | 'CANCELADO';

/**
 * T6e - pago de una orden con la evidencia de Yape que el `ADMIN` necesita para decidir.
 * `comprobanteUrl` es una URL firmada de MinIO de vida corta (300 s) que solo recibe un `ADMIN`;
 * no se cachea, porque reusarla mostraria una imagen rota.
 */
export interface PagoOrdenAdmin {
  id: number;
  ordenId: number;
  monto: number;
  estado: EstadoPagoAdmin | string;
  comprobanteUrl?: string | null;
  motivoRechazo?: string | null;
  detalle?: string | null;
  creadoEn?: string;
  actualizadoEn?: string;
}

/** Respuesta de `POST /pagos/mercadopago/preferencia`. */
export interface MercadoPagoPreferenceResponse {
  preferenceId: string;
  initPoint: string;
  sandboxInitPoint: string;
  pagoId: number;
  ordenId: number;
}
