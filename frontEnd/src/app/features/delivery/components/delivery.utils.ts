import { Order } from '../../../core/models/order.model';

/** Sin código no se muestra un número de pedido plausible: se muestra un guion. */
export function getCodeNum(code: string): string {
  return code ? code.replace('POL-', '') : '—';
}

/** Cantidad total de unidades del pedido (suma de cantidades, no líneas del carrito). */
export function cantidadItems(order: Order): number {
  return (order.items || []).reduce((acc, it) => acc + (it.cantidad || 0), 0);
}
