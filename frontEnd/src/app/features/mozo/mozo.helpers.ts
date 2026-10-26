import { Order, OrderStatus } from '../../core/models/order.model';
import { AlertaPlatoListo, MesaSalon } from './mozo.types';

/** Funciones puras de presentación del módulo mozo (sin servicios ni estado). */

export function esMesaParaCobrar(mesa: MesaSalon | null | undefined): boolean {
  if (!mesa) return false;
  return mesa.estado === 'POR_COBRAR' || !!mesa.servidoEn;
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
