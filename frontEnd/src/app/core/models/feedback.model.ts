export type MotivoReclamo = 
  | 'PEDIDO_INCOMPLETO' 
  | 'DEMORA_EXCESIVA' 
  | 'CALIDAD_ALIMENTOS' 
  | 'PEDIDO_EQUIVOCADO' 
  | 'OTRO';

export type EstadoReclamo = 
  | 'ABIERTO' 
  | 'EN_REVISION' 
  | 'PENDIENTE' 
  | 'RESUELTO' 
  | 'RECHAZADO';

export interface Resenia {
  id: number;
  ordenId: number;
  clienteId: number;
  clienteNombre?: string;
  calificacion: number; // 1 a 5
  estrellas?: number;
  comentario?: string;
  canal?: string;
  creadoEn: string;
  fecha?: string;
}

export interface CrearReseniaRequest {
  ordenId: number;
  calificacion: number;
  comentario?: string;
  canal?: string;
}

export interface ReporteIncidencia {
  id: number;
  ordenId: number;
  clienteId: number;
  clienteNombre?: string;
  motivo: MotivoReclamo;
  descripcion: string;
  montoReclamado?: number;
  fotoUrl?: string;
  estado: EstadoReclamo;
  resolucion?: string;
  creadoEn: string;
  resueltoEn?: string;
}

export type ReporteReclamo = ReporteIncidencia;

export interface CrearReporteRequest {
  ordenId: number;
  motivo: MotivoReclamo;
  descripcion: string;
  montoReclamado?: number;
}

export interface ResolverReporteRequest {
  estado: EstadoReclamo;
  resolucion: string;
  ejecutarReembolso?: boolean;
}
