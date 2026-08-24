// ============================================================
// Tipos y Contratos exactos de los Microservicios Spring Boot
// ============================================================

// --- 1.1 Auth Service (:8081) ---
export type BackendRole = 'CLIENTE' | 'MOZO' | 'COCINA' | 'ADMIN' | 'REPARTIDOR';

export interface BackendRegisterRequest {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: BackendRole;
}

export interface BackendLoginRequest {
  identifier: string; // email o teléfono
  password: string;
}

export interface BackendTwoFactorRequest {
  email: string;
  code: string;
}

export interface BackendAuthResponse {
  token: string | null;
  name: string | null;
  email: string;
  role: BackendRole;
  requiresTwoFactor: boolean;
  message?: string;
}

// --- 1.2 Carta & Productos (:8082) ---
export type BackendCategoria =
  | 'POLLO_ENTERO'
  | 'MEDIO_POLLO'
  | 'CUARTO_POLLO'
  | 'COMBO'
  | 'PARRILLA'
  | 'GUARNICION'
  | 'BEBIDA'
  | 'POSTRE'
  | 'PROMOCION';

export interface BackendProductoResponse {
  id: number;
  nombre: string;
  descripcion?: string;
  precio: number;
  categoria: BackendCategoria;
  imagenUrl?: string;
  disponible: boolean;
  creadoEn?: string;
  actualizadoEn?: string;
}

export interface BackendProductoRequest {
  nombre: string;
  descripcion?: string;
  precio: number;
  categoria: BackendCategoria;
  imagenUrl?: string;
  disponible?: boolean;
}

// --- 1.3 Órdenes & Estados (:8082) ---
export type BackendOrdenTipo = 'SALON' | 'DELIVERY' | 'RECOJO';

export type BackendOrdenEstado =
  | 'RECIBIDO'
  | 'EN_PREPARACION'
  | 'LISTO'
  | 'EN_CAMINO'
  | 'ENTREGADO'
  | 'CANCELADO';

export interface BackendOrdenItemRequest {
  productoId: number;
  cantidad: number;
  notas?: string;
}

export interface BackendCrearOrdenRequest {
  tipo: BackendOrdenTipo;
  mesaId?: number;
  direccionEntrega?: string;
  referencia?: string;
  nombreCliente?: string;
  telefonoCliente?: string;
  observaciones?: string;
  items: BackendOrdenItemRequest[];
}

export interface BackendItemResponse {
  productoId: number;
  productoNombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  notas?: string;
}

export interface BackendOrdenResponse {
  id: number;
  tipo: BackendOrdenTipo;
  estado: BackendOrdenEstado;
  clienteId?: number;
  mozoId?: number;
  repartidorId?: number;
  mesaNumero?: number;
  direccionEntrega?: string;
  referencia?: string;
  nombreCliente?: string;
  telefonoCliente?: string;
  total: number;
  observaciones?: string;
  creadoEn: string;
  actualizadoEn?: string;
  items: BackendItemResponse[];
}

export interface BackendActualizarEstadoRequest {
  estado: BackendOrdenEstado;
  repartidorId?: number;
}

// --- 1.4 Pagos (:8083) ---
export type BackendMetodoPago = 'CONTRAENTREGA' | 'TARJETA' | 'YAPE_PLIN';

export type BackendEstadoPago = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'CANCELADO';

export interface BackendIniciarPagoRequest {
  ordenId: number;
  monto: number;
  metodoPago: BackendMetodoPago;
  tokenPasarela?: string;
  telefonoYape?: string;
}

export interface BackendPagoResponse {
  id: number;
  ordenId: number;
  clienteId: number;
  monto: number;
  metodoPago: BackendMetodoPago;
  estado: BackendEstadoPago;
  referenciaExterna?: string;
  detalle?: string;
  creadoEn: string;
  actualizadoEn?: string;
}
