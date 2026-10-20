import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subscription, catchError, interval, of, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FiltroHistorial, NotificationLog, WhatsappQr, WhatsappStatus } from '../models/notification-log.model';

/**
 * T5b (S4/S8/S11) — Anti-baneo y contactos configurables desde el panel.
 * `ajustes` es el store en MEMORIA del notification-service: se pierde al reiniciar (S8).
 */
export interface AjustesWhatsapp {
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
  /** Celular del admin (normalizado 51 + 9 dígitos) o null si aún no se configuró. */
  numeroAsesor: string | null;
  /** Celular de respaldo opcional (S11); null = sin respaldo. */
  numeroRespaldo: string | null;
}

export interface PresupuestoWhatsapp {
  enviados: number;
  limite: number;
}

export interface VentanaWhatsapp {
  horaDesde: number;
  horaHasta: number;
  abierta: boolean;
}

export interface BreakerWhatsapp {
  estado: 'cerrado' | 'medioAbierto' | 'abierto';
  senal: string | null;
  detalle: string | null;
  aperturas: number;
  /** ms restantes para el próximo intento cuando está abierto; 0 en cualquier otro estado. */
  reintentoEn: number;
}

export interface GobernadorWhatsapp {
  pausada: boolean;
  motivo: string | null;
  detalle: string | null;
  presupuestoHora: PresupuestoWhatsapp;
  presupuestoDia: PresupuestoWhatsapp;
  ventana: VentanaWhatsapp;
  breaker: BreakerWhatsapp;
}

export interface AjustesRespuesta {
  ajustes: AjustesWhatsapp;
  gobernador: GobernadorWhatsapp | null;
}

/**
 * Historial (RF32) y estado de la sesión de WhatsApp del notification-service.
 * El token ADMIN lo agrega el authTokenInterceptor.
 */
@Injectable({
  providedIn: 'root'
})
export class WhatsappNotificationsService {
  private http = inject(HttpClient);

  private readonly NOTIFICATION_URL = environment.notificationApiUrl || 'http://localhost:3001/api/notificaciones';

  readonly historial = signal<NotificationLog[]>([]);
  readonly status = signal<WhatsappStatus | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // QR para vincular WhatsApp desde el panel (solo ADMIN)
  readonly qr = signal<WhatsappQr | null>(null);
  readonly qrError = signal<string | null>(null);
  private sondeoQr?: Subscription;

  // T5b — ajustes anti-baneo y contactos editables desde el panel (solo ADMIN)
  readonly ajustes = signal<AjustesWhatsapp | null>(null);
  readonly gobernador = signal<GobernadorWhatsapp | null>(null);
  readonly ajustesCargando = signal<boolean>(false);
  readonly guardandoAjustes = signal<boolean>(false);
  readonly ajustesError = signal<string | null>(null);

  /**
   * Motivo por el que WhatsApp no arrancó (perfil de Chromium bloqueado, navegador
   * que no lanza). Sin esto el panel muestra "Generando el código QR..." para
   * siempre cuando el QR nunca va a aparecer.
   */
  readonly diagnostico = computed(() => this.qr()?.detalle ?? this.status()?.detalle ?? null);

  readonly totales = computed(() => {
    const logs = this.historial();
    return {
      enviados: logs.filter(l => l.estado === 'ENVIADO').length,
      enCola: logs.filter(l => l.estado === 'EN_COLA').length,
      errores: logs.filter(l => l.estado === 'ERROR').length
    };
  });

  cargar(filtro: FiltroHistorial = {}): void {
    this.cargarStatus();
    this.cargarHistorial(filtro);
  }

  cargarStatus(): void {
    this.http.get<WhatsappStatus>(`${this.NOTIFICATION_URL}/status`).pipe(
      tap(status => this.status.set(status)),
      catchError(() => {
        this.status.set(null);
        return of(null);
      })
    ).subscribe();
  }

  /**
   * T5b — GET /ajustes: valores vigentes del anti-baneo y estado del gobernador.
   * Devuelve tal cual el contrato `{ ajustes, gobernador }` del backend.
   */
  obtenerAjustes(): Observable<AjustesRespuesta> {
    return this.http.get<AjustesRespuesta>(`${this.NOTIFICATION_URL}/ajustes`);
  }

  /**
   * T5b — PATCH /ajustes: manda SOLO los campos cambiados y devuelve la configuración
   * resultante completa. Un 400 se propaga con el mensaje del backend, sin tragárselo.
   */
  actualizarAjustes(cambios: Partial<AjustesWhatsapp>): Observable<AjustesWhatsapp> {
    return this.http.patch<AjustesWhatsapp>(`${this.NOTIFICATION_URL}/ajustes`, cambios).pipe(
      catchError(err => throwError(() => new Error(
        this.mensajeErrorAjustes(err, 'No se pudieron guardar los ajustes de WhatsApp.')
      )))
    );
  }

  /** T5b — carga los ajustes y el gobernador en los signals que consume el panel. */
  cargarAjustes(): void {
    this.ajustesCargando.set(true);
    this.obtenerAjustes().pipe(
      tap(({ ajustes, gobernador }) => {
        this.ajustes.set(ajustes);
        this.gobernador.set(gobernador);
        this.ajustesError.set(null);
        this.ajustesCargando.set(false);
      }),
      catchError(err => {
        this.ajustesCargando.set(false);
        this.ajustesError.set(this.mensajeErrorAjustes(err, 'No se pudieron cargar los ajustes de WhatsApp.'));
        return of(null);
      })
    ).subscribe();
  }

  /**
   * T5b — guarda solo los cambios indicados y refresca con lo que responde el backend.
   * Si el backend rechaza (400), el mensaje llega tal cual a `ajustesError`.
   */
  guardarAjustes(cambios: Partial<AjustesWhatsapp>): void {
    if (Object.keys(cambios).length === 0) return;

    this.guardandoAjustes.set(true);
    this.actualizarAjustes(cambios).pipe(
      tap(ajustes => {
        this.ajustes.set(ajustes);
        this.ajustesError.set(null);
        this.guardandoAjustes.set(false);
      }),
      catchError(err => {
        this.guardandoAjustes.set(false);
        this.ajustesError.set(this.mensajeErrorAjustes(err, 'No se pudieron guardar los ajustes de WhatsApp.'));
        return of(null);
      })
    ).subscribe();
  }

  private mensajeErrorAjustes(err: any, porDefecto: string): string {
    if (err?.status === 0) return 'No se pudo conectar con notification-service (:3001). ¿Está encendido?';
    if (err?.status === 403) return 'Solo un administrador puede administrar estos ajustes.';
    return err?.error?.error || err?.error?.mensaje || porDefecto;
  }

  cargarHistorial(filtro: FiltroHistorial = {}): void {
    let params = new HttpParams();
    if (filtro.ordenId) params = params.set('ordenId', filtro.ordenId);
    if (filtro.estado) params = params.set('estado', filtro.estado);
    if (filtro.desde) params = params.set('desde', filtro.desde);

    this.isLoading.set(true);
    this.http.get<NotificationLog[]>(`${this.NOTIFICATION_URL}/historial`, { params }).pipe(
      tap(logs => {
        this.historial.set(logs);
        this.error.set(null);
        this.isLoading.set(false);
      }),
      catchError(err => {
        this.isLoading.set(false);
        this.error.set(
          err.status === 0
            ? 'No se pudo conectar con notification-service (:3001). ¿Está encendido?'
            : err.status === 403
              ? 'Solo un administrador puede ver el historial.'
              : 'No se pudo cargar el historial de notificaciones.'
        );
        return of([]);
      })
    ).subscribe();
  }

  /** Consulta el QR cada 5 s mientras la pestaña de WhatsApp está abierta. */
  iniciarSondeoQr(): void {
    this.cargarQr();
    if (!this.sondeoQr) {
      this.sondeoQr = interval(5000).subscribe(() => this.cargarQr());
    }
  }

  detenerSondeoQr(): void {
    this.sondeoQr?.unsubscribe();
    this.sondeoQr = undefined;
  }

  cargarQr(): void {
    this.http.get<WhatsappQr>(`${this.NOTIFICATION_URL}/qr`).pipe(
      tap(qr => {
        this.qr.set(qr);
        this.qrError.set(null);
        // Mantener el estado de la sesión al día sin esperar a "Actualizar"
        const status = this.status();
        if (status && status.whatsapp !== qr.whatsapp) {
          this.status.set({ ...status, whatsapp: qr.whatsapp });
        }
      }),
      catchError(err => {
        this.qr.set(null);
        this.qrError.set(
          err.status === 404
            ? 'Este notification-service no tiene la opción de QR. Reinícialo para cargar la versión nueva, o usa http://localhost:3001/qr.'
            : err.status === 403 || err.status === 401
              ? 'Solo un administrador puede ver el código QR.'
              : 'No se pudo obtener el código QR del notification-service.'
        );
        return of(null);
      })
    ).subscribe();
  }
}
