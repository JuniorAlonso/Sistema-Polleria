// Fase 3 — notification-service (:3001)

export type EstadoNotificacion = 'EN_COLA' | 'ENVIADO' | 'ERROR';

export type TipoNotificacion =
  | 'PAGO_CONFIRMADO'
  | 'ESTADO_EN_PREPARACION'
  | 'ESTADO_EN_CAMINO'
  | 'ESTADO_ENTREGADO'
  | 'CODIGO_SEGUIMIENTO';

export type EstadoSesionWhatsapp =
  | 'connected'
  | 'waiting_qr'
  | 'starting'
  | 'disconnected'
  | 'auth_failure'
  | 'error_inicio';

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
  detalle?: string | null;
}

export interface WhatsappQr {
  whatsapp: EstadoSesionWhatsapp;
  qr: string | null; // imagen PNG en data URL; null si ya está conectado o aún no se genera
  detalle?: string | null; // motivo del fallo de arranque de WhatsApp, si lo hubo
}

export interface FiltroHistorial {
  ordenId?: number | null;
  estado?: EstadoNotificacion | '';
  desde?: string;
}
