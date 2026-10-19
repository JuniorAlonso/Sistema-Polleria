export type MotivoReclamo = 
  | 'PEDIDO_INCOMPLETO' 
  | 'DEMORA_EXCESIVA' 
  | 'COMIDA_FRIA' 
  | 'PRODUCTO_DANADO' 
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
  productoId?: number;
  clienteNombre?: string;
  calificacion: number; // 1 a 5
  estrellas?: number;
  comentario?: string;
  respuestaAdmin?: string;
  respondidoEn?: string;
  visible?: boolean;
  creadoEn: string;
  fecha?: string;
}

export interface CrearReseniaRequest {
  ordenId: number;
  productoId?: number;
  calificacion: number;
  comentario?: string;
}

export interface ReporteIncidencia {
  id: number;
  ordenId: number;
  clienteId: number;
  clienteNombre?: string;
  motivo: MotivoReclamo;
  descripcion: string;
  fotoEvidenciaUrl?: string;
  fotoUrl?: string;
  montoReclamado?: number;
  montoReembolso?: number;
  reembolsoProcedente?: boolean;
  estado: EstadoReclamo;
  respuestaAdmin?: string;
  resolucion?: string;
  creadoEn: string;
  resueltoEn?: string;
  esNuevo?: boolean;
}

export type ReporteReclamo = ReporteIncidencia;

export interface CrearReporteRequest {
  ordenId: number;
  motivo: MotivoReclamo;
  descripcion: string;
  montoReclamado?: number;
  fotoEvidenciaUrl?: string;
}

export interface ResolverReporteRequest {
  estado: EstadoReclamo;
  respuestaAdmin?: string;
  resolucion?: string;
  reembolsoProcedente?: boolean;
  ejecutarReembolso?: boolean;
  montoReembolso?: number;
}
