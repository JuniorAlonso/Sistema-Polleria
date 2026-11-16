import { Order, OrderItem, OrderStatus } from '../../core/models/order.model';

export type KitchenTab = 'KDS' | 'DISPONIBILIDAD';
export type KdsFilter = 'TODAS' | 'POR_PREPARAR' | 'EN_PREPARACION' | 'LISTOS';

export interface GrupoRondaKds {
  ronda: number;
  items: OrderItem[];
}

export function codigoNumerico(code: string): string {
  return code ? code.replace('POL-', '') : '1001';
}

/**
 * Normaliza el número de ronda de un ítem para el KDS (D1.5):
 * registros históricos o ítems con `ronda = null` / `undefined` se interpretan como ronda 1.
 */
export function normalizarRondaKds(ronda?: number | null): number {
  return typeof ronda === 'number' && Number.isFinite(ronda) && ronda >= 1
    ? Math.trunc(ronda)
    : 1;
}

/**
 * Agrupa los ítems de una comanda por su número de ronda (`ronda = 1, 2, ...`),
 * conservando cada fila individual con su `id`, `cantidad` y `notas` sin mezclar
 * productos iguales ni rondas distintas.
 */
export function agruparItemsPorRondaKds(items: OrderItem[]): GrupoRondaKds[] {
  const mapa = new Map<number, OrderItem[]>();
  for (const item of items ?? []) {
    const ronda = normalizarRondaKds(item.ronda);
    const normalizado: OrderItem = { ...item, ronda };
    const lista = mapa.get(ronda);
    if (lista) {
      lista.push(normalizado);
    } else {
      mapa.set(ronda, [normalizado]);
    }
  }
  return Array.from(mapa.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([ronda, grupoItems]) => ({ ronda, items: grupoItems }));
}

/**
 * Regla del Plan 1 / Plan 2:
 * Cuando `tipo = RECOJO` (`RECOJO_EN_TIENDA` o `RECOJO`) y `canalOrigen = SALON`,
 * se muestra la etiqueta `"MOSTRADOR"`. Para cualquier otro canal o tipo se conserva `order.tipo`.
 */
export function obtenerEtiquetaTipoKds(order: Pick<Order, 'tipo' | 'canalOrigen'>): string {
  const tipo = String(order.tipo ?? '').toUpperCase();
  const canal = String(order.canalOrigen ?? '').toUpperCase();
  const esRecojo = tipo === 'RECOJO_EN_TIENDA' || tipo === 'RECOJO';
  if (esRecojo && canal === 'SALON') {
    return 'MOSTRADOR';
  }
  return order.tipo;
}

/**
 * D1.2 / R1.7: La cocina únicamente puede avanzar `PAGADO`/`RECIBIDO` -> `EN_PREPARACION`
 * y `EN_PREPARACION`/`PREPARANDO` -> `LISTO_COCINA`. Nunca puede cerrar (`COMPLETADO`/`ENTREGADO`),
 * cancelar (`CANCELADO`) ni despachar una comanda.
 */
export function esTransicionCocinaPermitida(
  estadoActual: OrderStatus,
  nuevoEstado: OrderStatus
): boolean {
  const enCola = estadoActual === 'PAGADO' || estadoActual === 'RECIBIDO';
  const enPreparacion = estadoActual === 'EN_PREPARACION' || estadoActual === 'PREPARANDO';
  if (enCola && (nuevoEstado === 'EN_PREPARACION' || nuevoEstado === 'PREPARANDO')) {
    return true;
  }
  if (enPreparacion && (nuevoEstado === 'LISTO_COCINA' || nuevoEstado === 'LISTO')) {
    return true;
  }
  return false;
}
