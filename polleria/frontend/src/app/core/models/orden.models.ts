export type Categoria =
  | 'POLLO_ENTERO' | 'MEDIO_POLLO' | 'CUARTO_POLLO'
  | 'COMBO' | 'PARRILLA' | 'GUARNICION'
  | 'BEBIDA' | 'POSTRE' | 'PROMOCION';

export type OrdenTipo = 'SALON' | 'DELIVERY' | 'RECOJO';
export type OrdenEstado = 'RECIBIDO' | 'EN_PREPARACION' | 'LISTO' | 'EN_CAMINO' | 'ENTREGADO' | 'CANCELADO';
export type MesaEstado = 'LIBRE' | 'OCUPADA' | 'RESERVADA';

export interface Producto {
  id: number;
  nombre: string;
  descripcion?: string;
  precio: number;
  categoria: Categoria;
  imagenUrl?: string;
  disponible: boolean;
}

export interface Mesa {
  id: number;
  numero: number;
  capacidad: number;
  estado: MesaEstado;
  qrUrl?: string;
}

export interface OrdenItemRequest {
  productoId: number;
  cantidad: number;
  notas?: string;
}

export interface CrearOrdenRequest {
  tipo: OrdenTipo;
  mesaId?: number;
  direccionEntrega?: string;
  referencia?: string;
  nombreCliente?: string;
  telefonoCliente?: string;
  observaciones?: string;
  items: OrdenItemRequest[];
}

export interface OrdenItem {
  productoId: number;
  productoNombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  notas?: string;
}

export interface Orden {
  id: number;
  tipo: OrdenTipo;
  estado: OrdenEstado;
  mesaNumero?: number;
  direccionEntrega?: string;
  nombreCliente?: string;
  total: number;
  observaciones?: string;
  creadoEn: string;
  items: OrdenItem[];
}

export interface CarritoItem {
  producto: Producto;
  cantidad: number;
  notas?: string;
}
