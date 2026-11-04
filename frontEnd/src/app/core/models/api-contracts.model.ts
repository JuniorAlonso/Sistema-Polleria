// ============================================================
// Tipos y Contratos exactos de los Microservicios Spring Boot
// ============================================================

// --- 1.1 Auth Service (:8081) ---
export type BackendRole = 'CLIENTE' | 'MOZO' | 'COCINA' | 'ADMIN' | 'REPARTIDOR' | 'CAJERO';

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

export interface BackendRefreshTokenRequest {
  refreshToken: string;
}

export interface BackendLogoutRequest {
  refreshToken: string;
}

export interface BackendAuthResponse {
  token: string | null;
  refreshToken?: string | null;
  tokenType?: string | null;
  expiresIn?: number | null;
  name: string | null;
  email: string;
  phone?: string | null;
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
  | 'PENDIENTE_CONFIRMACION'
  | 'PENDIENTE_PAGO'
  | 'EN_PREPARACION'
  | 'PREPARANDO'
  | 'LISTO'
  | 'LISTO_PARA_ENTREGAR'
  | 'EN_CAMINO'
  | 'EN_PUERTA'
  | 'ENTREGADO'
  | 'CANCELADO'
  | 'PEDIDO_FANTASMA';

export interface BackendOrdenItemRequest {
  productoId: number;
  cantidad: number;
  notas?: string;
}

export interface BackendCrearOrdenRequest {
  tipo: BackendOrdenTipo;
  canalOrigen?: 'WEB' | 'WHATSAPP' | 'SALON';
  estadoInicial?: BackendOrdenEstado;
  mesaId?: number;
  direccionEntrega?: string;
  referencia?: string;
  nombreCliente?: string;
  telefonoCliente?: string;
  montoPagaCon?: number;
  ipOrigen?: string;
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
  numeroCliente?: number | null;
  tipo: BackendOrdenTipo;
  canalOrigen?: 'WEB' | 'WHATSAPP' | 'SALON';
  estado: BackendOrdenEstado;
  clienteId?: number;
  mozoId?: number;
  repartidorId?: number;
  /** Momento en que el mozo confirmó que entregó la comanda en mesa (no cambia el estado). */
  servidoEn?: string | null;
  servidoPor?: number | null;
  enPuertaAt?: string | null;
  listoAt?: string | null;
  intentosLlamada?: number | null;
  /** Set when the cashier confirmed the ContraPago phone call. */
  llamadaConfirmacionAt?: string | null;
  /** True for ContraPago orders: cash must be collected before ENTREGADO. */
  requiereCobroEfectivo?: boolean;
  montoPagaCon?: number | null;
  vueltoEstimado?: number | null;
  motivoFantasma?: string | null;
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
  /** Pickup ticket (POL-<id>), required by the backend for RECOJO -> ENTREGADO. */
  codigoTicket?: string;
}

// --- 1.4 Pagos (:8083) ---
export type BackendMetodoPago = 'CONTRAENTREGA' | 'TARJETA' | 'YAPE_PLIN';

export type BackendEstadoPago = 'PENDIENTE' | 'PENDIENTE_VERIFICACION' | 'APROBADO' | 'RECHAZADO' | 'CANCELADO';

export interface BackendYapeOtpPagoRequest {
  ordenId: number;
  monto: number;
  telefono: string;
  otp: string;
  email?: string;
}

export interface BackendCobroEfectivoRequest {
  ordenId: number;
  monto: number;
  montoRecibido?: number;
  vueltoEntregado?: number;
  /** Pickup ticket (POL-<id>), required by the backend when the order is RECOJO. */
  codigoTicket?: string;
}

// --- 1.5 Sanciones & Auditoría (:8081) ---
export interface BackendVerificarSancionResponse {
  sancionado: boolean;
  bloqueadoEfectivo: boolean;
  bloqueadoTotal: boolean;
  motivo?: string | null;
  telefonoNormalizado?: string | null;
}

// --- 1.6 Comprobantes & Liquidaciones (:8086) ---
export interface BackendComprobanteResponse {
  id: number;
  ordenId: number;
  tipo: 'BOLETA' | 'FACTURA';
  serieCorrelativo: string;
  clienteTipoDoc?: string;
  clienteNumDoc?: string;
  clienteNombre: string;
  clienteDireccion?: string;
  subtotal: number;
  igv: number;
  total: number;
  estadoPagoTexto: string;
  vueltoEntregado?: number;
  emitidoEn: string;
  emitidoPor?: number;
}

export interface BackendLiquidacionResponse {
  id: number;
  repartidorId: number;
  repartidorNombre: string;
  arqueoCajaId?: number;
  fondoInicial: number;
  totalCobradoEfectivo: number;
  /** Cash expected from the courier's approved cash payments (payments-service), set on close. */
  totalEsperadoEfectivo?: number | null;
  /** Counted cash minus expected cash, set on close. */
  diferenciaEfectivo?: number | null;
  totalRendido: number;
  diferencia: number;
  estado: 'ABIERTA' | 'CERRADA' | 'DISCREPANCIA';
  observaciones?: string;
  creadoEn: string;
  cerradoEn?: string;
}

/** Cash the courier still has to hand in for the open settlement (GET /finanzas/liquidaciones/repartidor/{id}/pendiente). */
export interface BackendEfectivoPendienteLiquidacion {
  repartidorId: number;
  liquidacionId: number;
  desde: string;
  total: number;
  cantidad: number;
  pagos: { pagoId: number; ordenId: number; monto: number; verificadoEn: string }[];
}

// --- 1.7 Mermas & Productos Fantasma (:8085) ---
export interface BackendResolucionProductoFantasmaRequest {
  ordenId: number;
  ordenTipo: 'DELIVERY' | 'RECOJO';
  destino: 'VENTA_RAPIDA_SALON' | 'MERMA_JUSTIFICADA';
  observaciones?: string;
}

export interface BackendResolucionProductoFantasmaResponse {
  ordenId: number;
  destino: 'VENTA_RAPIDA_SALON' | 'MERMA_JUSTIFICADA';
  resultado: string;
  mermaId?: number;
  fecha: string;
}

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
  checkoutUrl?: string;
  comprobanteClave?: string;
  comprobanteUrl?: string;
}
