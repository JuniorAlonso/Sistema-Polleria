import { CartItem } from './product.model';

export type OrderType = 'DELIVERY' | 'RECOJO_EN_TIENDA' | 'SALON';

/**
 * Máquina de estados según requerimientos (RF15):
 * PENDIENTE_PAGO -> PAGADO -> EN_PREPARACION -> LISTO_COCINA -> EN_REPARTO -> COMPLETADO (o CANCELADO)
 */
export type OrderStatus =
  | 'PENDIENTE_PAGO'
  | 'PAGADO'
  | 'EN_PREPARACION'
  | 'LISTO_COCINA'
  | 'EN_REPARTO'
  | 'COMPLETADO'
  | 'CANCELADO';

export type PaymentMethod = 'YAPE' | 'PLIN' | 'TARJETA' | 'EFECTIVO_CONTRAENTREGA';

export interface OrderCustomerInfo {
  nombre: string;
  celular: string;
  correo?: string;
  direccion?: string;        // RF14
  referencia?: string;       // RF14
  mesaNumero?: number;       // RF11, RF12 (Salón)
}

export interface Order {
  id: string;
  codigoSeguimiento: string; // Ej: POL-9482
  cliente: OrderCustomerInfo;
  items: CartItem[];
  tipo: OrderType;
  estado: OrderStatus;
  metodoPago: PaymentMethod;
  subtotal: number;
  costoEnvio: number;
  descuento: number;
  total: number;
  notasGenerales?: string;
  createdAt: string;
  updatedAt: string;
  repartidorAsignado?: {
    nombre: string;
    celular: string;
  };
}

export interface CreateOrderRequest {
  tipo: OrderType;
  cliente: OrderCustomerInfo;
  items: {
    productoId: string;
    cantidad: number;
    notas?: string;
  }[];
  metodoPago: PaymentMethod;
  notasGenerales?: string;
}
