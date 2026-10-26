import { Order } from '../../../core/models/order.model';
import { EstadoNotificacion, TipoNotificacion } from '../../../core/models/notification-log.model';

/** Funciones puras de presentación del panel admin (sin estado ni servicios). */

export function getCodeNum(code: string): string {
  return code ? code.replace('POL-', '') : '1001';
}

export function obtenerResumenPlatos(orden: Order): string {
  if (!orden.items || orden.items.length === 0) return 'Sin productos especificados';
  return orden.items.map(i => `${i.cantidad}x ${i.product?.nombre || 'Producto'}`).join(', ');
}

/**
 * Estados desde los que el panel puede abrir el despacho con motorizado:
 * - `EN_PREPARACION`: el despacho encadena el paso `LISTO` antes de `EN_CAMINO`.
 * - `LISTO_COCINA`: transición directa a `EN_CAMINO` con `repartidorId`.
 * - `EN_REPARTO`: reasignar un pedido ya en ruta.
 */
export function puedeDespachar(order: Order): boolean {
  return ['EN_PREPARACION', 'LISTO_COCINA', 'EN_REPARTO'].includes(order.estado);
}

/** Minutes the courier must wait at the door before an order may be declared a ghost order (delivery). */
export const GHOST_DELIVERY_MINUTES = 30;
/** Minutes a pickup order may stay ready in store before it may be declared a ghost order. */
export const GHOST_PICKUP_MINUTES = 60;
/** Window (from order creation) in which a Yape capture can still be verified. */
export const PROOF_WINDOW_MINUTES = 15;

export interface GhostWindow {
  /** True once the waiting time required by the backend has elapsed. */
  canDeclare: boolean;
  /** Milliseconds left until the order can be declared; null when the start timestamp is unknown. */
  remainingMs: number | null;
}

/**
 * Ghost-order rule mirrored from orders-service: delivery orders after 30 min at the door,
 * pickup orders after 1 h ready in store. Returns null when the order is not in a state where
 * a ghost declaration applies. The backend stays the authority; this only enables/disables the button.
 */
export function ghostWindow(order: Order, now: number): GhostWindow | null {
  let since: string | undefined;
  let minutes: number;
  if (order.tipo === 'DELIVERY' && order.estado === 'EN_PUERTA') {
    since = order.enPuertaAt;
    minutes = GHOST_DELIVERY_MINUTES;
  } else if (order.tipo === 'RECOJO_EN_TIENDA' && order.estado === 'LISTO_COCINA') {
    since = order.listoAt;
    minutes = GHOST_PICKUP_MINUTES;
  } else {
    return null;
  }
  const start = since ? Date.parse(since) : NaN;
  if (!Number.isFinite(start)) return { canDeclare: false, remainingMs: null };
  const remainingMs = start + minutes * 60_000 - now;
  return { canDeclare: remainingMs <= 0, remainingMs };
}

/** Human text explaining why the ghost declaration is (not) available. */
export function ghostHint(window: GhostWindow): string {
  if (window.remainingMs === null) return 'Sin hora de registro: no se puede declarar todavía';
  if (window.canDeclare) return 'Tiempo de espera cumplido';
  return `Disponible en ${formatRemaining(window.remainingMs)}`;
}

/** Whole minutes left in the Yape-proof window of an order (negative when expired). */
export function proofRemainingMs(order: Order, now: number): number | null {
  const start = Date.parse(order.createdAt);
  if (!Number.isFinite(start)) return null;
  return start + PROOF_WINDOW_MINUTES * 60_000 - now;
}

export function formatRemaining(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  return `${minutes} min`;
}

export function getMotivoLabel(motivo?: string): string {
  switch (motivo) {
    case 'PEDIDO_INCOMPLETO': return 'Pedido Incompleto o Faltan Items';
    case 'DEMORA_EXCESIVA': return 'Demora Excesiva en la Entrega';
    case 'COMIDA_FRIA':
    case 'PRODUCTO_FRIO': return 'Producto Frío o en Mal Estado';
    case 'PRODUCTO_DANADO': return 'Producto Dañado en Transporte';
    case 'CALIDAD_ALIMENTOS': return 'Calidad de Alimentos Insatisfactoria';
    case 'COBRO_ERRONEO': return 'Cobro Erróneo / Error de Pago';
    case 'MALA_ATENCION': return 'Mala Atención del Repartidor / Personal';
    default: return (motivo || 'Otro Motivo').replace(/_/g, ' ');
  }
}

export function etiquetaTipoNotificacion(tipo: TipoNotificacion): string {
  const etiquetas: Record<TipoNotificacion, string> = {
    PAGO_CONFIRMADO: 'Pago confirmado',
    ESTADO_EN_PREPARACION: 'En preparación',
    ESTADO_EN_CAMINO: 'En camino',
    ESTADO_ENTREGADO: 'Entregado',
    CODIGO_SEGUIMIENTO: 'Código de seguimiento'
  };
  return etiquetas[tipo] ?? tipo;
}

export function claseEstadoNotificacion(estado: EstadoNotificacion): string {
  if (estado === 'ENVIADO') return 'bg-emerald-500/20 text-emerald-400';
  if (estado === 'ERROR') return 'bg-red-500/20 text-red-400';
  return 'bg-amber-500/20 text-amber-300';
}

/** Motivo de pausa del gobernador en lenguaje del panel. */
export function etiquetaMotivoPausa(motivo: string | null): string {
  const etiquetas: Record<string, string> = {
    'circuit-breaker': 'Circuit breaker abierto',
    'fuera-de-ventana': 'Fuera de la ventana horaria',
    'presupuesto-hora': 'Presupuesto por hora agotado',
    'presupuesto-dia': 'Presupuesto del día agotado'
  };
  return motivo ? (etiquetas[motivo] ?? motivo) : 'Sin pausa';
}

export function etiquetaEstadoBreaker(estado: string): string {
  const etiquetas: Record<string, string> = {
    cerrado: 'Cerrado',
    medioAbierto: 'Medio abierto',
    abierto: 'Abierto'
  };
  return etiquetas[estado] ?? estado;
}

/** `reintentoEn` viene en milisegundos; se muestra legible para el admin. */
export function formatearDuracionMs(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '—';
  const segundos = Math.ceil(ms / 1000);
  if (segundos < 60) return `${segundos} s`;
  const minutos = Math.round(segundos / 60);
  return `${minutos} min`;
}

export function porcentajePresupuesto(enviados: number, limite: number): number {
  if (!limite || limite <= 0) return 0;
  return Math.min(100, Math.round((enviados / limite) * 100));
}
