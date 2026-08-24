import { PaymentMethod } from './order.model';

export type PaymentStatus = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'CANCELADO';

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
