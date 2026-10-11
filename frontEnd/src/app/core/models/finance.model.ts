export type EstadoCaja = 'ABIERTA' | 'CERRADA';
export type TipoMovimiento = 
  | 'INGRESO' 
  | 'EGRESO' 
  | 'VENTA_EFECTIVO' 
  | 'VENTA_DIGITAL' 
  | 'REEMBOLSO';

export interface ArqueoCaja {
  id: number;
  usuarioId: number;
  usuarioNombre: string;
  cajero?: string;
  montoApertura: number;
  montoInicial?: number;
  montoCierreEfectivo?: number;
  ventasEfectivo?: number;
  montoCierrePos?: number;
  ventasDigitales?: number;
  ventasDigital?: number;
  totalEsperado?: number;
  diferencia?: number;
  discrepancia?: number;
  estado: EstadoCaja;
  observaciones?: string;
  fechaApertura: string;
  fechaCierre?: string;
}

export interface MovimientoCaja {
  id: number;
  arqueoId: number;
  tipo: TipoMovimiento;
  monto: number;
  motivo: string;
  concepto?: string;
  registradoPor: number;
  usuario?: string;
  fecha: string;
  fechaHora?: string;
}

export interface AperturaCajaRequest {
  montoApertura: number;
  usuarioNombre?: string;
  observaciones?: string;
}

export interface MovimientoCajaRequest {
  tipo: TipoMovimiento;
  monto: number;
  motivo?: string;
  concepto?: string;
}

export interface CierreCajaRequest {
  montoCierreEfectivo: number;
  montoCierrePos: number;
  ventasDigitales?: number;
  observaciones?: string;
}

export interface BalanceDiario {
  fecha: string;
  ingresos: {
    pasarelaDigital: number;
    efectivoSalon: number;
    posFisicoSalon: number;
    totalIngresos: number;
  };
  egresos: {
    reembolsosEmitidos: number;
    gastosCajaChica: number;
    totalEgresos: number;
  };
  balanceNeto: number;
  ordenesAtendidas: number;
  ticketPromedio: number;
  totalVentas?: number;
  saldoNeto?: number;
  totalGastos?: number;
}

export type CajaSesion = ArqueoCaja;
