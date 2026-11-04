/**
 * Debe coincidir 1:1 con MotivoMerma del inventory-service
 * (polleria/inventory-service/.../entity/MotivoMerma.java). El backend rechaza
 * con 400 cualquier valor que no pertenezca a su enum.
 */
export type MotivoMerma =
  | 'VENCIMIENTO'
  | 'MAL_ESTADO'
  | 'ERROR_COCINA'
  | 'CAIDA'
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

/**
 * Refleja MermaResponse del inventory-service. El backend no envía unidad de
 * medida, costo de pérdida ni responsable: para la unidad se cruza el insumo.
 */
export interface Merma {
  id: number;
  insumoId: number;
  insumoNombre: string;
  cantidad: number;
  motivo: MotivoMerma;
  justificacion?: string;
  registradoPor?: number;
  fecha: string;
}

export type RegistroMerma = Merma;

/** Refleja RegistrarMermaRequest del inventory-service. */
export interface RegistrarMermaRequest {
  insumoId: number;
  cantidad: number;
  motivo: MotivoMerma;
  justificacion?: string;
}

/**
 * Refleja AlertaStockResponse del inventory-service: es una alerta por umbral
 * (stockActual <= stockMinimoAlerta), no una predicción. El backend no envía
 * consumo diario, días restantes ni sugerencia, así que el frontend no los
 * inventa.
 */
export interface AlertaStock {
  insumoId: number;
  insumoNombre: string;
  stockActual: number;
  stockMinimoAlerta: number;
  unidadMedida: string;
  nivelCriticidad?: 'ALTO' | 'CRITICO';
  mensaje: string;
}

export interface RentabilidadInventario {
  valorTotalInventario: number;
  costoTotalMermas: number;
  totalInsumos: number;
  totalInsumosCriticos: number;
  alertasCriticas: AlertaStock[];
}
