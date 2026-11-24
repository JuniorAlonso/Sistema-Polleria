import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, Subscription, catchError, defer, finalize, of, tap, throwError } from 'rxjs';
import {
  EnvioSunatResponse,
  EstadoSunat,
  FacturacionSunatApiService
} from '../api/facturacion-sunat-api.service';
import { NotificationService } from './notification.service';
import { mensajeError, mensajeErrorBlob } from '../utils/api-error';
import { parsePositiveIntId } from '../utils/id';

/**
 * Servicio reactivo para facturación electrónica SUNAT (envío bajo demanda, consulta, ticket QR y descargas).
 */
@Injectable({ providedIn: 'root' })
export class FacturacionSunatService {
  private readonly api = inject(FacturacionSunatApiService);
  private readonly notify = inject(NotificationService);
  private readonly platformId = inject(PLATFORM_ID);

  private cargarEnviosSub?: Subscription;

  readonly envios = signal<EnvioSunatResponse[]>([]);
  readonly cargandoListado = signal<boolean>(false);
  readonly errorListado = signal<string | null>(null);
  readonly enviandoOrdenIds = signal<Set<number>>(new Set());

  readonly enviosPorOrden = computed<Map<number, EnvioSunatResponse>>(() => {
    const mapa = new Map<number, EnvioSunatResponse>();
    for (const item of this.envios()) {
      mapa.set(item.ordenId, item);
    }
    return mapa;
  });

  cargarEnvios(estado?: EstadoSunat): void {
    this.cargarEnviosSub?.unsubscribe();
    this.cargandoListado.set(true);
    this.errorListado.set(null);
    this.cargarEnviosSub = this.api.listar(estado).pipe(
      tap(lista => this.envios.set(lista)),
      catchError((err: unknown) => {
        this.errorListado.set(mensajeError(err, 'No se pudo consultar el listado de envíos SUNAT.'));
        return of([]);
      }),
      finalize(() => this.cargandoListado.set(false))
    ).subscribe();
  }

  consultarEstadoOrden(ordenId: number | string): Observable<EnvioSunatResponse | null> {
    const cleanId = parsePositiveIntId(ordenId);
    if (!cleanId) return of(null);

    return this.api.obtenerEstado(cleanId).pipe(
      tap(res => this.upsertEnvio(res)),
      catchError((err: unknown) => {
        const status = (err as { status?: number } | null)?.status;
        if (status !== 404) {
          this.errorListado.set(mensajeError(err, `No se pudo consultar el estado SUNAT de la orden #${cleanId}.`));
        }
        return of(null);
      })
    );
  }

  enviarASunat(ordenId: number | string): Observable<EnvioSunatResponse> {
    return defer(() => {
      const cleanId = parsePositiveIntId(ordenId);
      if (!cleanId) {
        return throwError(() => new Error(`ID de orden inválido para SUNAT: ${ordenId}`));
      }
      if (this.enviandoOrdenIds().has(cleanId)) {
        return throwError(() => new Error(`La orden #${cleanId} ya se está enviando a SUNAT.`));
      }

      this.marcarEnviando(cleanId, true);
      return this.api.enviarASunat(cleanId).pipe(
        tap(res => {
          this.upsertEnvio(res);
          this.notificarResultado(res);
        }),
        catchError((err: unknown) => {
          this.notify.showError('Error al enviar a SUNAT',
            mensajeError(err, 'No se pudo conectar con facturacion-sunat-service.'));
          return throwError(() => err);
        }),
        finalize(() => this.marcarEnviando(cleanId, false))
      );
    });
  }

  abrirTicketSunat(ordenId: number | string): void {
    const cleanId = parsePositiveIntId(ordenId);
    if (!cleanId || !isPlatformBrowser(this.platformId)) return;

    // Abrir la pestaña de forma síncrona durante el clic evita bloqueos de popups tras la llamada HTTP.
    const tab = window.open('about:blank', '_blank');
    if (tab) {
      tab.opener = null;
    }

    const envio = this.enviosPorOrden().get(cleanId);
    const fallbackFilename = `ticket-${envio?.nombreArchivo || cleanId}.html`;

    this.api.obtenerTicketHtml(cleanId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        if (tab && !tab.closed) {
          tab.location.href = url;
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } else {
          this.dispararDescarga(blob, fallbackFilename);
          this.notify.showWarning(
            'Ventana emergente bloqueada',
            'Se descargó el ticket SUNAT en HTML porque el navegador bloqueó la nueva pestaña.'
          );
          URL.revokeObjectURL(url);
        }
      },
      error: (err: unknown) => {
        if (tab && !tab.closed) {
          tab.close();
        }
        void mensajeErrorBlob(err, 'No se pudo generar el ticket con QR.').then(msg => {
          this.notify.showError('Ticket SUNAT no disponible', msg);
        });
      }
    });
  }

  descargarXml(ordenId: number | string, nombreBase?: string): void {
    const cleanId = parsePositiveIntId(ordenId);
    if (!cleanId || !isPlatformBrowser(this.platformId)) return;

    const envio = this.enviosPorOrden().get(cleanId);
    const filename = `${nombreBase || envio?.nombreArchivo || `comprobante-${cleanId}`}.xml`;

    this.api.descargarXml(cleanId).subscribe({
      next: (blob) => this.dispararDescarga(blob, filename),
      error: (err: unknown) => {
        void mensajeErrorBlob(err, 'No se pudo descargar el XML firmado.').then(msg => {
          this.notify.showError('XML no disponible', msg);
        });
      }
    });
  }

  descargarCdr(ordenId: number | string, nombreBase?: string): void {
    const cleanId = parsePositiveIntId(ordenId);
    if (!cleanId || !isPlatformBrowser(this.platformId)) return;

    const envio = this.enviosPorOrden().get(cleanId);
    const filename = `R-${nombreBase || envio?.nombreArchivo || `comprobante-${cleanId}`}.zip`;

    this.api.descargarCdr(cleanId).subscribe({
      next: (blob) => this.dispararDescarga(blob, filename),
      error: (err: unknown) => {
        void mensajeErrorBlob(err, 'No se pudo descargar la Constancia de Recepción (CDR).').then(msg => {
          this.notify.showError('CDR no disponible', msg);
        });
      }
    });
  }

  estaEnviando(ordenId: number | string): boolean {
    const cleanId = parsePositiveIntId(ordenId);
    return !!cleanId && this.enviandoOrdenIds().has(cleanId);
  }

  private upsertEnvio(res: EnvioSunatResponse): void {
    this.envios.update(prev => {
      const idx = prev.findIndex(e => e.ordenId === res.ordenId);
      if (idx >= 0) {
        const copia = [...prev];
        copia[idx] = res;
        return copia;
      }
      return [res, ...prev];
    });
  }

  private marcarEnviando(ordenId: number, activo: boolean): void {
    this.enviandoOrdenIds.update(prev => {
      const next = new Set(prev);
      if (activo) {
        next.add(ordenId);
      } else {
        next.delete(ordenId);
      }
      return next;
    });
  }

  private notificarResultado(res: EnvioSunatResponse): void {
    const titulo = `${res.serieNumero} · ${res.estado}`;
    if (res.estado === 'ACEPTADO') {
      this.notify.showSuccess(titulo, res.descripcion || 'Comprobante aceptado por SUNAT.');
    } else if (res.estado === 'OBSERVADO') {
      this.notify.showWarning(titulo, res.observaciones || res.descripcion || 'Comprobante aceptado con observaciones.');
    } else if (res.estado === 'RECHAZADO') {
      this.notify.showError(titulo, res.descripcion || 'SUNAT rechazó el comprobante.');
    } else if (res.estado === 'ERROR') {
      this.notify.showError(titulo, res.descripcion || 'Error de comunicación con SUNAT. Puedes reintentar.');
    }
  }

  private dispararDescarga(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
