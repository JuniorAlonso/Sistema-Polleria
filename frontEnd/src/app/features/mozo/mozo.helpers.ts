import { Order, OrderItem, OrderStatus } from '../../core/models/order.model';
import { AlertaPlatoListo, ComandaExistente, GrupoRondaComanda, MesaSalon } from './mozo.types';

/** Funciones puras de presentación del módulo mozo (sin servicios ni estado). */

/**
 * D1.1 / D1.6: Una mesa está por cobrar únicamente cuando su estado es 'POR_COBRAR'.
 * `servidoEn` registra la entrega en mesa y no equivale a solicitar la cuenta.
 */
export function esMesaParaCobrar(mesa: MesaSalon | null | undefined): boolean {
  if (!mesa) return false;
  return mesa.estado === 'POR_COBRAR';
}

/**
 * D1.5: Agrupa los OrderItem persistidos por número de ronda.
 * Los registros históricos sin `ronda` (o con valor inválido) se agrupan en la ronda 1.
 */
export function agruparItemsPorRonda(items: OrderItem[] | null | undefined): GrupoRondaComanda[] {
  if (!items?.length) return [];
  const mapa = new Map<number, OrderItem[]>();
  for (const item of items) {
    const ronda = typeof item.ronda === 'number' && Number.isFinite(item.ronda) && item.ronda >= 1
      ? item.ronda
      : 1;
    const grupo = mapa.get(ronda) ?? [];
    grupo.push({ ...item, ronda });
    mapa.set(ronda, grupo);
  }
  return Array.from(mapa.entries())
    .sort(([a], [b]) => a - b)
    .map(([ronda, grupoItems]) => ({ ronda, items: grupoItems }));
}

/**
 * Construye `ComandaExistente` a partir de `Order`, conservando `id` y `ronda` de cada `OrderItem`.
 */
export function mapearOrdenAComandaExistente(orden: Order | null | undefined): ComandaExistente | null {
  if (!orden) return null;
  const rondas = agruparItemsPorRonda(orden.items);
  return {
    id: orden.id,
    codigoSeguimiento: orden.codigoSeguimiento,
    estado: orden.estado,
    total: orden.total,
    servidoEn: orden.servidoEn,
    items: (orden.items || []).map(item => ({
      id: item.id,
      ronda: typeof item.ronda === 'number' && item.ronda >= 1 ? item.ronda : 1,
      productoId: item.product.id,
      nombre: item.product.nombre,
      cantidad: item.cantidad,
      precioUnitario: item.product.precio,
      subtotal: item.subtotal,
      notas: item.notas
    })),
    rondas
  };
}

export function tiempoTranscurridoDesde(fechaIso: string | null | undefined, ahora: number): string {
  if (!fechaIso) return '';
  const fecha = new Date(fechaIso);
  const diffMs = ahora - fecha.getTime();
  if (isNaN(diffMs) || diffMs < 0) return 'Recién servido';
  const totalMinutos = Math.floor(diffMs / 60000);
  if (totalMinutos < 1) return 'Recién servido';
  const horas = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos % 60;
  if (horas === 0) {
    return `${minutos} min`;
  }
  return minutos > 0 ? `${horas}h ${minutos}m` : `${horas}h`;
}

export function esMiComanda(alerta: AlertaPlatoListo, userId: number | null | undefined): boolean {
  return !!userId && !!alerta.mozoId && alerta.mozoId === userId;
}

export function etiquetaEstadoComanda(estado: OrderStatus): string {
  switch (estado) {
    case 'EN_PREPARACION': return 'Cocinando';
    case 'LISTO_COCINA': return 'Listo';
    case 'PAGADO': return 'En cola';
    case 'EN_REPARTO': return 'En reparto';
    case 'COMPLETADO': return 'Entregado';
    case 'CANCELADO': return 'Cancelado';
    default: return 'Pendiente de pago';
  }
}

/** «1x Chaufa de Pollo, 2x Inca Kola» a partir de los ítems reales de la orden. */
export function resumenItems(o: Order): string {
  if (!o?.items?.length) return '—';
  return o.items.map(i => `${i.cantidad}x ${i.product?.nombre ?? 'Producto'}`).join(', ');
}

export function horaDe(iso: string): string {
  if (!iso) return '—';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

export function getCodeNum(code: string): string {
  return code ? code.replace('POL-', '') : '—';
}
