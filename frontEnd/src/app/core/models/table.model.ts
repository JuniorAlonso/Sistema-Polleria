export type TableStatus = 'LIBRE' | 'OCUPADA' | 'RESERVADA' | 'EN_LIMPIEZA';

export interface RestaurantTable {
  id: string;
  numero: number;
  capacidad: number;
  estado: TableStatus;
  pedidoActualId?: string;
  mozoAsignado?: string;
  ultimaActualizacion?: string;
}
