// Fase 3 — notification-service (:3001)

export type EstadoNotificacion = 'EN_COLA' | 'ENVIADO' | 'ERROR';

export type TipoNotificacion =
  | 'PAGO_CONFIRMADO'
  | 'ESTADO_EN_PREPARACION'
  | 'ESTADO_EN_CAMINO'
  | 'ESTADO_ENTREGADO'
  | 'CODIGO_SEGUIMIENTO';

export type EstadoSesionWhatsapp = 'connected' | 'waiting_qr' | 'starting' | 'disconnected' | 'auth_failure';

export interface NotificationLog {
  id: string;
  ordenId: number | null;
  destinatario: string;
  tipo: TipoNotificacion;
  mensaje: string;
  estado: EstadoNotificacion;
  intentos: number;
  errorDetalle: string | null;
  enviadoEn: string | null;
  creadoEn: string;
}

export interface WhatsappStatus {
  status: string;
  whatsapp: EstadoSesionWhatsapp;
  colaPendiente: number;
}

export interface FiltroHistorial {
  ordenId?: number | null;
  estado?: EstadoNotificacion | '';
  desde?: string;
}
