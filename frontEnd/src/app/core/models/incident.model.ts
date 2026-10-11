export type SeveridadIncidente = 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';
export type TipoIncidente = 'TECNICO' | 'OPERATIVO' | 'LOGISTICO';
export type EstadoIncidente = 'ABIERTO' | 'EN_PROCESO' | 'RESUELTO';

export interface Incidente {
  id: number;
  titulo: string;
  severidad: SeveridadIncidente;
  tipo: TipoIncidente;
  modulo?: string;
  descripcion: string;
  responsable?: string;
  reportadoPor?: string;
  estado: EstadoIncidente;
  causaRaiz?: string;
  solucionAplicada?: string;
  ocurridoEn: string;
  fechaHora?: string;
  resueltoEn?: string;
}

export interface CrearIncidenteRequest {
  titulo: string;
  severidad: SeveridadIncidente;
  tipo?: TipoIncidente;
  modulo?: string;
  descripcion?: string;
  causaRaiz?: string;
  solucionAplicada?: string;
  reportadoPor?: string;
  responsable?: string;
}

export type IncidenteOperativo = Incidente;

export interface ResolverIncidenteRequest {
  estado?: EstadoIncidente;
  causaRaiz: string;
  solucionAplicada: string;
  responsable?: string;
}

export interface IpBloqueada {
  ip: string;
  failedAttempts: number;
  intentosFallidos?: number;
  motivo?: string;
  lastAttempt: string;
  fechaBloqueo?: string;
  blockedUntil?: string;
  currentlyBlocked: boolean;
}
