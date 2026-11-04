import { Order } from '../../../core/models/order.model';
import { PagoOrdenAdmin } from '../../../core/models/payment.model';

export type CajeroTab = 'POS' | 'CAPTURAS_PAGO' | 'LLAMADAS_CONTRAPAGO' | 'RECOJO_TIENDA' | 'LIQUIDACIONES' | 'MERMAS_FANTASMA' | 'ARQUEO' | 'HISTORIAL';
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

/** PENDIENTE_PAGO order with its payment (null while the customer has not uploaded the capture). */
export interface CapturaPendiente {
  orden: Order;
  pago: PagoOrdenAdmin | null;
}

export interface RechazarCapturaEvent {
  pago: PagoOrdenAdmin;
  motivo: string;
}

export interface EntregaRecojoEvent {
  orden: Order;
  codigoTicket: string;
  efectivoRecibido: number;
}
