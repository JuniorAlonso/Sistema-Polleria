import { CartItem } from './product.model';

export type OrderType = 'DELIVERY' | 'RECOJO_EN_TIENDA' | 'SALON';

/**
 * Máquina de estados según requerimientos (RF15):
 * PENDIENTE_PAGO -> PAGADO -> EN_PREPARACION -> LISTO_COCINA -> EN_REPARTO -> COMPLETADO (o CANCELADO)
 */
export type OrderStatus =
  | 'RECIBIDO'
  | 'EN_PREPARACION'
  | 'LISTO'
  | 'EN_CAMINO'
  | 'ENTREGADO'
  | 'CANCELADO'
  | 'PENDIENTE_PAGO'
  | 'PAGADO'
  | 'LISTO_COCINA'
  | 'EN_REPARTO'
  | 'COMPLETADO';

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
  codigoSeguimiento: string; // Ej: POL-9482 (uso interno del personal)
  numeroCliente?: number;    // Número que ve el cliente: su pedido N.° 1, 2, 3...
  cliente: OrderCustomerInfo;
  items: CartItem[];
  tipo: OrderType;
  estado: OrderStatus;
  /** Opcional: el listado de órdenes no trae el pago; no se inventa un método. */
  metodoPago?: PaymentMethod;
  subtotal: number;
  costoEnvio: number;
  descuento: number;
  total: number;
  notasGenerales?: string;
  createdAt: string;
  updatedAt: string;
  repartidorId?: number;
  /** ISO timestamp de cuando el mozo confirmó que entregó la comanda en mesa. */
  servidoEn?: string;
  servidoPor?: number;
}

export interface CreateOrderRequest {
  tipo: OrderType;
  /** Id real de la mesa en orders-service (no el número visible). Obligatorio para SALON. */
  mesaId?: number;
  cliente: OrderCustomerInfo;
  items: {
    productoId: string;
    cantidad: number;
    notas?: string;
  }[];
  metodoPago?: PaymentMethod;
  notasGenerales?: string;
}
