export type MotivoMerma = 
  | 'VENCIMIENTO' 
  | 'MAL_ESTADO' 
  | 'ERROR_COCINA' 
  | 'CAIDA' 
  | 'COCCION_EXCESIVA' 
  | 'OTRO';

export type InsumoCategoria = 'CARNES' | 'VERDURAS' | 'ABARROTES' | 'BEBIDAS' | 'CONDIMENTOS' | 'DESCARTABLES' | 'OTRO';

export interface Insumo {
  id: number;
  nombre: string;
  unidadMedida: string;
  stockActual: number;
  stockMinimoAlerta: number;
  stockMinimo?: number;
  costoUnitario: number;
  categoria?: string;
  estado?: 'OPTIMO' | 'BAJO' | 'CRITICO';
}

export interface CrearInsumoRequest {
  nombre: string;
  unidadMedida: string;
  stockActual: number;
  stockMinimoAlerta: number;
  costoUnitario: number;
}

export interface ActualizarStockRequest {
  cantidad: number;
  esDelta: boolean;
}

export interface DespachoItem {
  id?: number;
  insumoId: number;
  insumoNombre: string;
  cantidad: number;
  observaciones?: string;
}

export interface DespachoCocina {
  id: number;
  solicitanteId: number;
  solicitanteNombre: string;
  fechaDespacho: string;
  items: DespachoItem[];
}

export interface CrearDespachoRequest {
  solicitanteNombre?: string;
  items: {
    insumoId: number;
    cantidad: number;
    observaciones?: string;
  }[];
}

export interface Merma {
  id: number;
  insumoId: number;
  insumoNombre: string;
  cantidad: number;
  unidad?: string;
  costoPerdida?: number;
  responsable?: string;
  motivo: MotivoMerma;
  justificacion?: string;
  registradoPor?: number;
  fecha: string;
}

export type RegistroMerma = Merma;

export interface RegistrarMermaRequest {
  insumoId: number;
  cantidad: number;
  motivo: MotivoMerma;
  justificacion?: string;
  responsable?: string;
}

export interface AlertaStock {
  insumoId: number;
  insumoNombre: string;
  stockActual: number;
  stockMinimoAlerta: number;
  unidadMedida: string;
  nivelCriticidad?: 'ALTO' | 'CRITICO';
  nivelSeveridad?: 'ALTA' | 'CRITICA' | 'CRITICO' | 'ALTO';
  mensaje: string;
  consumoDiarioEstimado?: number;
  diasRestantesEstimados?: number;
  sugerencia?: string;
}

export interface RentabilidadInventario {
  valorTotalInventario: number;
  costoTotalMermas: number;
  totalInsumos: number;
  totalInsumosCriticos: number;
  alertasCriticas: AlertaStock[];
}
