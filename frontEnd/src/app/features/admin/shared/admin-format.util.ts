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
