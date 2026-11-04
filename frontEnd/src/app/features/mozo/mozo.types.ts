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
  items?: { producto: string; cantidad: number; precio: number; notas?: string; listo?: boolean }[];
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

export interface ComandaItem {
  producto: Product;
  cantidad: number;
  notas: string;
}
