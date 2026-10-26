import { Order } from '../../../core/models/order.model';

export type CajeroTab = 'POS' | 'LLAMADAS_CONTRAPAGO' | 'LIQUIDACIONES' | 'MERMAS_FANTASMA' | 'ARQUEO' | 'HISTORIAL';
export type MetodoCobro = 'EFECTIVO' | 'TARJETA' | 'YAPE_PLIN';
export type DestinoFantasma = 'VENTA_RAPIDA_SALON' | 'MERMA_JUSTIFICADA';

/** Fila del historial de cobros aprobados (vista "Cobros del Día"). */
export interface CobroDelDia {
  id: number | string;
  fechaHora: string;
  ordenId: number | string;
  codigoOrden: string;
  clienteNombre: string;
  tipoOrden: string;
  metodo: string;
  monto: number;
  referencia: string;
  items: Order['items'];
  cajero: string;
}

/** Datos que muestra el modal del ticket / comprobante. */
export interface TicketVista {
  ordenId?: number | string;
  fechaHora?: string;
  cajero?: string;
  cliente?: string;
  tipo?: string;
  items?: Order['items'];
  total?: number;
  metodo?: string;
  efectivoRecibido?: number;
  vuelto?: number;
  referencia?: string;
}

export interface ResolverFantasmaEvent {
  orden: Order;
  destino: DestinoFantasma;
}
