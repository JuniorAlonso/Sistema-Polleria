export type TableStatus = 'LIBRE' | 'OCUPADA' | 'POR_COBRAR' | 'EN_LIMPIEZA' | 'LIMPIEZA' | 'RESERVADA';

export type MesaEstado = TableStatus;
export type SalonZona = string;

export interface OrdenActivaMesa {
  ordenId: number;
  mozoId: number;
  total: number;
  estadoOrden: string;
  tiempoEsperaMinutos: number;
  /** ISO timestamp de cuando el mozo confirmó que la comanda ya se sirvió en mesa. */
  servidoEn?: string | null;
  creadoEn?: string | null;
  codigoSeguimiento?: string;
  itemsResumen?: string;
}

export interface RestaurantTable {
  id: string | number;
  numero: number;
  nombre?: string;
  capacidad: number;
  estado: TableStatus;
  posicionX: number;
  posicionY: number;
  qrUrl?: string;
  zona?: string;
  mozo?: string;
  mozoAsignado?: string;
  platosListos?: boolean;
  totalConsumo?: number;
  ordenActiva?: OrdenActivaMesa;
  activo?: boolean;
  ultimaActualizacion?: string;
}

export type MesaSalon = RestaurantTable;
