import { Order } from '../../../core/models/order.model';

/** Sin código no se muestra un número de pedido plausible: se muestra un guion. */
export function getCodeNum(code: string): string {
  return code ? code.replace('POL-', '') : '—';
}

/** Cantidad total de unidades del pedido (suma de cantidades, no líneas del carrito). */
export function cantidadItems(order: Order): number {
  return (order.items || []).reduce((acc, it) => acc + (it.cantidad || 0), 0);
}

/**
 * ContraPago order: the courier must collect and register the cash before ENTREGADO.
 * Uses the backend flag; the order listing does not carry the payment method.
 */
export function esContraPago(order: Order): boolean {
  return order.requiereCobroEfectivo === true;
}

/** Minutes the courier must wait at the door before declaring a ghost order (backend rule). */
export const MINUTOS_ESPERA_FANTASMA = 30;

/**
 * Whole minutes elapsed at the door. When the courier marked the arrival in this session,
 * `anchorMs` (local time of the HTTP response) is used so client clock skew cannot distort
 * the countdown; otherwise the server `enPuertaAt` is used. Never negative.
 */
export function minutosTranscurridosEnPuerta(enPuertaAt: string | undefined, nowMs: number, anchorMs?: number): number {
  let inicio = anchorMs;
  if (inicio === undefined) {
    if (!enPuertaAt) return 0;
    inicio = new Date(enPuertaAt).getTime();
    if (Number.isNaN(inicio)) return 0;
  }
  return Math.max(0, Math.floor((nowMs - inicio) / 60000));
}

/** Backend error text (`{ error }` / `{ mensaje }` body, or `Error.message`) with a Spanish fallback. */
export function mensajeBackend(err: unknown, porDefecto: string): string {
  const e = err as { status?: number; error?: { error?: string; mensaje?: string; message?: string }; message?: string } | null;
  if (e?.status === 0) return 'No se pudo conectar con el servidor';
  return e?.error?.error || e?.error?.mensaje || e?.error?.message
    || (e instanceof Error ? e.message : '') || porDefecto;
}
