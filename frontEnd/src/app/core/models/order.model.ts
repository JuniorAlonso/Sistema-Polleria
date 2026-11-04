/** Mapa de nombres: Order / OrderStatus (UI) <-> BackendOrdenResponse (api-contracts.model.ts) via OrderAdapter. */
import { CartItem } from './product.model';

export type OrderType = 'DELIVERY' | 'RECOJO_EN_TIENDA' | 'SALON';

/**
 * Máquina de estados según requerimientos (RF15):
 * PENDIENTE_PAGO -> PAGADO -> EN_PREPARACION -> LISTO_COCINA -> EN_REPARTO -> COMPLETADO (o CANCELADO)
 */
export type OrderStatus =
  | 'RECIBIDO'
  | 'PENDIENTE_CONFIRMACION'
  | 'PENDIENTE_PAGO'
  | 'EN_PREPARACION'
  | 'PREPARANDO'
  | 'LISTO'
  | 'LISTO_PARA_ENTREGAR'
  | 'LISTO_COCINA'
  | 'EN_CAMINO'
  | 'EN_REPARTO'
  | 'EN_PUERTA'
  | 'ENTREGADO'
  | 'COMPLETADO'
  | 'CANCELADO'
  | 'PEDIDO_FANTASMA'
  | 'PAGADO';

export type PaymentMethod = 'YAPE' | 'PLIN' | 'TARJETA' | 'EFECTIVO_CONTRAENTREGA' | 'YAPE_OTP';

/**
 * Canal por el que entró el pedido (S1). Sirve para medir y auditar los pedidos de WhatsApp:
 * un pedido de WhatsApp es `DELIVERY`, igual que uno del checkout web, y solo el canal los distingue.
 */
export type OrderChannel = 'WEB' | 'WHATSAPP' | 'SALON';

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
  /** Canal de origen del pedido (S1). Opcional: las órdenes viejas no tienen canal. */
  canalOrigen?: OrderChannel;
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
  enPuertaAt?: string;
  listoAt?: string;
  intentosLlamada?: number;
  llamadaConfirmacionAt?: string;
  /** ContraPago order: the cash must be collected (and registered) before ENTREGADO. */
  requiereCobroEfectivo?: boolean;
  montoPagaCon?: number;
  vueltoEstimado?: number;
  motivoFantasma?: string;
}

export interface CreateOrderRequest {
  tipo: OrderType;
  /** Id real de la mesa en orders-service (no el número visible). Obligatorio para SALON. */
  mesaId?: number;
  cliente: OrderCustomerInfo;
  estadoInicial?: OrderStatus;
  montoPagaCon?: number;
  ipOrigen?: string;
  items: {
    productoId: string;
    cantidad: number;
    notas?: string;
  }[];
  metodoPago?: PaymentMethod;
  /** Canal de origen (S1). El checkout web no lo manda y el backend deriva WEB o SALON. */
  canalOrigen?: OrderChannel;
  notasGenerales?: string;
}
