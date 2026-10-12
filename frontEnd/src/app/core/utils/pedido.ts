import { Order } from '../models/order.model';

/**
 * Nombre del pedido tal como lo ve el cliente: "Pedido N.° 3".
 * El ID interno (POL-4821) solo se muestra al personal.
 */
export function etiquetaPedido(order: Pick<Order, 'numeroCliente' | 'codigoSeguimiento'> | null | undefined): string {
  if (!order) return '';
  return order.numeroCliente ? `Pedido N.° ${order.numeroCliente}` : `Pedido ${order.codigoSeguimiento}`;
}
