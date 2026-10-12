import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subscription, catchError, interval, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FiltroHistorial, NotificationLog, WhatsappQr, WhatsappStatus } from '../models/notification-log.model';

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
