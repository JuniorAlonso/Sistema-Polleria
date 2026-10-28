import { Order } from '../models/order.model';

/**
 * Nombre del pedido tal como lo ve el cliente: "Pedido N.° 3".
 * El ID interno (POL-4821) se muestra al personal y, solo en recojo, al cliente como su ticket.
 */
export function etiquetaPedido(order: Pick<Order, 'numeroCliente' | 'codigoSeguimiento'> | null | undefined): string {
  if (!order) return '';
  return order.numeroCliente ? `Pedido N.° ${order.numeroCliente}` : `Pedido ${order.codigoSeguimiento}`;
}

/**
 * Ticket de recojo (POL-<id de la orden>): en caja el pedido se entrega solo contra este código,
 * nunca contra el número de cliente. Vacío para pedidos que no son de recojo.
 */
export function ticketRecojo(order: Pick<Order, 'id' | 'tipo'> | null | undefined): string {
  if (!order || order.tipo !== 'RECOJO_EN_TIENDA') return '';
  const id = String(order.id ?? '').replace(/^ord-/i, '').replace(/^POL-/i, '');
  return id ? `POL-${id}` : '';
}
