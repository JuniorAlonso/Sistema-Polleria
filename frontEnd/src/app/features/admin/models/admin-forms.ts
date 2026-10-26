import { Order, OrderStatus, OrderType, PaymentMethod } from '../../../core/models/order.model';
import { MesaSalon, SalonZona } from '../../../core/models/table.model';
import { MotivoMerma } from '../../../core/models/inventory.model';
import { TipoMovimiento } from '../../../core/models/finance.model';
import { EstadoReclamo } from '../../../core/models/feedback.model';
import { EstadoNotificacion } from '../../../core/models/notification-log.model';

/** Contratos de UI compartidos entre los contenedores (smart) y los componentes presentacionales del panel admin. */

export type InventarioSubTab = 'CARTA' | 'INSUMOS' | 'MERMAS' | 'PREDICCION';
export type OrderStateFilter = 'TODAS' | 'NUEVAS' | 'PREPARANDOSE' | 'EN_CAMINO' | 'COMPLETADO';

export interface OrderAdvance {
  order: Order;
  status: OrderStatus;
}

export interface ManualOrderForm {
  // CREAR abre una comanda nueva; AGREGAR suma platos a la comanda activa de la mesa.
  modo: 'CREAR' | 'AGREGAR';
  ordenId: string | null;
  mesaId: string | number | null;
  tipo: OrderType;
  metodoPago: PaymentMethod;
  clienteNombre: string;
  clienteCelular: string;
  direccion: string;
  selectedProductId: string;
  cantidad: number;
  notas: string;
}

export interface DespachoForm {
  insumoId: number;
  cantidad: number;
  estacion: string;
}

export interface MermaForm {
  insumoId: number;
  cantidad: number;
  motivo: MotivoMerma;
  justificacion: string;
}

export interface MovimientoForm {
  tipo: TipoMovimiento;
  concepto: string;
  monto: number;
}

export interface IncidenteForm {
  titulo: string;
  modulo: 'PAGOS' | 'COCINA_HORNO' | 'RED_WIFI' | 'SISTEMA_LOCAL';
  severidad: 'ALTA' | 'MEDIA' | 'BAJA';
  causaRaiz: string;
  solucionAplicada: string;
}

export interface CrearMesaForm {
  numero: number;
  capacidad: number;
  zona: SalonZona;
  posicionX: number;
  posicionY: number;
}

export interface EditarMesaForm extends CrearMesaForm {
  id: string | number;
  activo: boolean;
}

export interface CoordenadasMesa {
  x: number;
  y: number;
}

export interface CierreCajaForm {
  efectivoReal: number;
  observaciones: string;
}

export interface ResolverReclamoValues {
  estadoFinal: EstadoReclamo | null;
  respuestaAdmin: string | null;
  emitirReembolso: boolean | null;
  montoReembolso: number | null;
}

export interface AjustesWhatsappForm {
  intervaloMs: number;
  jitterPct: number;
  typingMinMs: number;
  typingMaxMs: number;
  typingMsPorCaracter: number;
  presupuestoHora: number;
  presupuestoDia: number;
  horaDesde: number;
  horaHasta: number;
  breakerBaseMs: number;
  breakerMaxMs: number;
  numeroAsesor: string;
  numeroRespaldo: string;
  numeroYape: string;
}

export interface FiltroNotificaciones {
  ordenId: number | null;
  estado: EstadoNotificacion | '';
  desde: string;
}

export interface MesaDragStart {
  event: DragEvent;
  mesa: MesaSalon;
}

export interface MesaMoveStart {
  mesa: MesaSalon;
  event: Event;
}

export interface CasillaRef {
  row: number;
  col: number;
}

export interface CasillaDrop extends CasillaRef {
  event: DragEvent;
}
