import { OrderItem, OrderStatus } from '../../core/models/order.model';
import { Product } from '../../core/models/product.model';
import { TableStatus } from '../../core/models/table.model';

export type MozoTab = 'MESAS' | 'TOMAR_COMANDA' | 'ALERTAS_COCINA' | 'HISTORIAL_TURNO';

export interface MesaSalon {
  id: number;
  /** Número visible de la mesa en el salón (1, 2, 3...). Se usa en títulos y en la comanda. */
  numero?: number;
  nombre: string;
  zona: 'SALON_PRINCIPAL' | 'TERRAZA' | 'ZONA_VIP' | string;
  capacidad: number;
  estado: TableStatus;
  posicionX?: number;
  posicionY?: number;
  comensales?: number;
  tiempoMinutos?: number;
  totalConsumo: number;
  mozo?: string;
  platosListos?: boolean;
  /** Mozo que tomó la comanda activa (para el chip «Tu comanda»). */
  mozoId?: number;
  ordenId?: string;
  servidoEn?: string | null;
  creadoEn?: string | null;
  items?: { id?: number; ronda?: number; producto: string; cantidad: number; precio: number; notas?: string; listo?: boolean }[];
}

export interface AlertaPlatoListo {
  id: string;
  /** Comanda a marcar como servida (POST /ordenes/{id}/servir). */
  ordenId?: string;
  mozoId?: number;
  mesa: string;
  plato: string;
  cantidad: number;
  hora: string;
  atendido: boolean;
}

/** Ítem temporal del selector de carta (aún no enviado al backend). */
export interface ComandaItem {
  producto: Product;
  cantidad: number;
  notas: string;
}

/** Ítem persistido dentro de una comanda activa de salón, con id de ítem y número de ronda. */
export interface ComandaExistenteItem {
  id?: number;
  ronda: number;
  productoId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  notas?: string;
}

/** Agrupación de ítems persistidos por número de ronda (1, 2, ...). */
export interface GrupoRondaComanda {
  ronda: number;
  items: OrderItem[];
}

/** Representación de la comanda activa de una mesa con sus ítems y rondas mapeados desde OrderItem. */
export interface ComandaExistente {
  id: string;
  codigoSeguimiento: string;
  estado: OrderStatus;
  total: number;
  servidoEn?: string;
  items: ComandaExistenteItem[];
  rondas: GrupoRondaComanda[];
}
