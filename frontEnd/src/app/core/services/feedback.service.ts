import { Injectable, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, Subject, tap, catchError, of, map } from 'rxjs';
import { Resenia, CrearReseniaRequest, ReporteIncidencia, CrearReporteRequest, ResolverReporteRequest, MotivoReclamo, EstadoReclamo } from '../models/feedback.model';
import { environment } from '../../../environments/environment';
import { NotificationService } from './notification.service';
import { mensajeError } from '../utils/api-error';

@Injectable({
  providedIn: 'root'
})
export class FeedbackService {
  private http = inject(HttpClient);
  private notify = inject(NotificationService);
  private platformId = inject(PLATFORM_ID);

  private readonly API_URL = environment.feedbackApiUrl || 'http://localhost:8085';
  private readonly PAYMENTS_URL = environment.paymentsApiUrl || 'http://localhost:8083';

  readonly resenias = signal<Resenia[]>([]);
  readonly reportes = signal<ReporteIncidencia[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly cargaError = signal<string | null>(null);
  readonly wsConnected = signal<boolean>(false);
  readonly nuevoReclamo$ = new Subject<ReporteIncidencia>();
  readonly devolucionesPendientes = signal<ReporteIncidencia[]>([]);

  private ws: WebSocket | null = null;
  private wsReconnectTimer: any = null;

  // Registro de feedback persistente por ordenId
  readonly reseniasPorOrden = signal<Record<number, { calificacion: number; comentario?: string; fecha?: string }>>({});
  readonly reportesPorOrden = signal<Record<number, {
    id?: number;
    motivo: string;
    descripcion: string;
    fecha?: string;
    estado?: string;
    respuestaAdmin?: string;
    resolucion?: string;
    reembolsoProcedente?: boolean;
    montoReembolso?: number;
    resueltoEn?: string;
  }>>({});

  readonly promedioEstrellas = computed(() => {
    const list = this.resenias();
    if (!list.length) return '5.0';
    const sum = list.reduce((acc, curr) => acc + (curr.calificacion ?? curr.estrellas ?? 5), 0);
    return (sum / list.length).toFixed(1);
  });

  readonly reclamosPendientes = computed(() => {
    return this.reportes().filter(r => r.estado === 'ABIERTO' || r.estado === 'PENDIENTE' || r.estado === 'EN_REVISION');
  });

  guardarReseniaLocal(ordenId: number, calificacion: number, comentario?: string): void {
    const nuevo = {
      ...this.reseniasPorOrden(),
      [ordenId]: {
        calificacion,
        comentario,
        fecha: new Date().toLocaleDateString()
      }
    };
    this.reseniasPorOrden.set(nuevo);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('sanpollo_ratings_by_order', JSON.stringify(nuevo));
      } catch {}
    }
  }

  getFotoUrl(url?: string): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) {
      return url;
    }
    const base = (environment.feedbackApiUrl || 'http://localhost:8085').replace(/\/$/, '');
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${base}${path}`;
  }

  consultarReporteDeOrden(ordenId: number): Observable<ReporteIncidencia | null> {
    if (!ordenId) return of(null);
    return this.http.get<ReporteIncidencia>(`${this.API_URL}/feedback/reportes/orden/${ordenId}`).pipe(
      tap(remoto => {
        if (remoto) {
          this.guardarReporteLocal(ordenId, {
            id: remoto.id,
            motivo: remoto.motivo,
            descripcion: remoto.descripcion,
            estado: remoto.estado,
            respuestaAdmin: remoto.respuestaAdmin || remoto.resolucion,
            resolucion: remoto.resolucion || remoto.respuestaAdmin,
            reembolsoProcedente: remoto.reembolsoProcedente,
            montoReembolso: remoto.montoReembolso,
            fecha: remoto.creadoEn ? new Date(remoto.creadoEn).toLocaleDateString() : undefined,
            resueltoEn: remoto.resueltoEn
          });
        }
      }),
      catchError(() => of(this.obtenerReporteDeOrden(ordenId) as any))
    );
  }

  guardarReporteLocal(ordenId: number, reporte: {
    id?: number;
    motivo: string;
    descripcion: string;
    estado?: string;
    respuestaAdmin?: string;
    resolucion?: string;
    reembolsoProcedente?: boolean;
    montoReembolso?: number;
    fecha?: string;
    resueltoEn?: string;
  }): void {
    const nuevo = {
      ...this.reportesPorOrden(),
      [ordenId]: {
        ...reporte,
        fecha: reporte.fecha || new Date().toLocaleDateString(),
        estado: reporte.estado || 'ABIERTO'
      }
    };
    this.reportesPorOrden.set(nuevo);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('sanpollo_reports_by_order', JSON.stringify(nuevo));
      } catch {}
    }
  }

  obtenerReseniaDeOrden(ordenId: number): { calificacion: number; comentario?: string; fecha?: string } | null {
    if (!ordenId) return null;
    const local = this.reseniasPorOrden()[ordenId];
    if (local) return local;
    const fromList = this.resenias().find(r => r.ordenId === ordenId);
    if (fromList) {
      return {
        calificacion: fromList.calificacion ?? fromList.estrellas ?? 5,
        comentario: fromList.comentario,
        fecha: fromList.fecha
      };
    }
    return null;
  }

  obtenerReporteDeOrden(ordenId: number): {
    id?: number;
    motivo: string;
    descripcion: string;
    fecha?: string;
    estado?: string;
    respuestaAdmin?: string;
    resolucion?: string;
    reembolsoProcedente?: boolean;
    montoReembolso?: number;
    resueltoEn?: string;
  } | null {
    if (!ordenId) return null;
    // Dar prioridad al listado reactivo si ya está resuelto o actualizado
    const fromList = this.reportes().find(r => r.ordenId === ordenId);
    if (fromList) {
      const data = {
        id: fromList.id,
        motivo: fromList.motivo,
        descripcion: fromList.descripcion,
        fecha: fromList.creadoEn ? new Date(fromList.creadoEn).toLocaleDateString() : undefined,
        estado: fromList.estado,
        respuestaAdmin: fromList.respuestaAdmin || fromList.resolucion,
        resolucion: fromList.resolucion || fromList.respuestaAdmin,
        reembolsoProcedente: fromList.reembolsoProcedente,
        montoReembolso: fromList.montoReembolso,
        resueltoEn: fromList.resueltoEn
      };
      // Actualizar caché local
      this.guardarReporteLocal(ordenId, data);
      return data;
    }
    const local = this.reportesPorOrden()[ordenId];
    if (local) return local;
    return null;
  }

  cargarMisReseniasYReportes(): void {
    this.http.get<Resenia[]>(`${this.API_URL}/feedback/resenias/mis-resenias`).pipe(
      tap(data => {
        if (data && data.length > 0) {
          const map = { ...this.reseniasPorOrden() };
          data.forEach(r => {
            if (r.ordenId && !map[r.ordenId]) {
              map[r.ordenId] = {
                calificacion: r.calificacion ?? r.estrellas ?? 5,
                comentario: r.comentario,
                fecha: r.creadoEn ? new Date(r.creadoEn).toLocaleDateString() : ''
              };
            }
          });
          this.reseniasPorOrden.set(map);
          if (typeof localStorage !== 'undefined') {
            try {
              localStorage.setItem('sanpollo_ratings_by_order', JSON.stringify(map));
            } catch {}
          }
        }
      }),
      catchError((err: unknown) => {
        this.cargaError.set(mensajeError(err, 'No se pudieron cargar tus reseñas.'));
        return of([]);
      })
    ).subscribe();

    this.http.get<ReporteIncidencia[]>(`${this.API_URL}/feedback/reportes/mis-reportes`).pipe(
      tap(data => {
        if (data && data.length > 0) {
          const map = { ...this.reportesPorOrden() };
          data.forEach(r => {
            if (r.ordenId && !map[r.ordenId]) {
              map[r.ordenId] = {
                id: r.id,
                motivo: r.motivo,
                descripcion: r.descripcion,
                fecha: r.creadoEn ? new Date(r.creadoEn).toLocaleDateString() : '',
                estado: r.estado
              };
            }
          });
          this.reportesPorOrden.set(map);
          if (typeof localStorage !== 'undefined') {
            try {
              localStorage.setItem('sanpollo_reports_by_order', JSON.stringify(map));
            } catch {}
          }
        }
      }),
      catchError((err: unknown) => {
        this.cargaError.set(mensajeError(err, 'No se pudieron cargar tus reportes.'));
        return of([]);
      })
    ).subscribe();
  }

  cargarResenias(): void {
    this.http.get<Resenia[]>(`${this.API_URL}/feedback/resenias`).pipe(
      tap(data => {
        this.cargaError.set(null);
        const mapped = data.map(r => ({
          ...r,
          estrellas: r.estrellas ?? r.calificacion,
          fecha: r.fecha ?? (r.creadoEn ? new Date(r.creadoEn).toLocaleDateString() : '')
        }));
        this.resenias.set(mapped);
      }),
      catchError((err: unknown) => {
        this.cargaError.set(mensajeError(err, 'No se pudieron cargar las reseñas.'));
        return of([]);
      })
    ).subscribe();
  }

  enviarResenia(req: CrearReseniaRequest): Observable<Resenia> {
    return this.http.post<Resenia>(`${this.API_URL}/feedback/resenias`, req).pipe(
      tap(res => {
        const mapped = {
          ...res,
          estrellas: res.estrellas ?? res.calificacion,
          fecha: res.fecha ?? (res.creadoEn ? new Date(res.creadoEn).toLocaleDateString() : '')
        };
        this.resenias.update(prev => [mapped, ...prev]);
        this.guardarReseniaLocal(req.ordenId, req.calificacion, req.comentario);
        this.notify.showSuccess('¡Muchas gracias por calificar tu pedido!');
      })
    );
  }

  cargarReportes(estado?: EstadoReclamo, motivo?: MotivoReclamo): void {
    let params = new HttpParams();
    if (estado) params = params.set('estado', estado);
    if (motivo) params = params.set('motivo', motivo);

    this.http.get<ReporteIncidencia[]>(`${this.API_URL}/feedback/admin/reportes`, { params }).pipe(
      tap(data => {
        this.cargaError.set(null);
        this.reportes.set(data);
      }),
      catchError((err: unknown) => {
        this.cargaError.set(mensajeError(err, 'No se pudieron cargar los reclamos.'));
        return of([]);
      })
    ).subscribe();
  }

  crearReporte(req: CrearReporteRequest, foto?: File): Observable<ReporteIncidencia> {
    return this.crearReporteMultipart(req.ordenId, req.motivo, req.descripcion, foto);
  }

  crearReporteMultipart(ordenId: number, motivo: MotivoReclamo, descripcion: string, foto?: File): Observable<ReporteIncidencia> {
    const formData = new FormData();
    formData.append('ordenId', ordenId.toString());
    formData.append('motivo', motivo);
    formData.append('descripcion', descripcion);

    if (foto) {
      formData.append('foto', foto, foto.name);
    }

    return this.http.post<ReporteIncidencia>(`${this.API_URL}/feedback/reportes/multipart`, formData).pipe(
      tap(nuevo => {
        this.reportes.update(prev => [nuevo, ...prev]);
        this.guardarReporteLocal(ordenId, {
          id: nuevo.id,
          motivo,
          descripcion,
          estado: nuevo.estado
        });
        this.notify.showSuccess('Incidencia reportada con éxito. Nuestro equipo la revisará.');
      })
    );
  }

  resolverReporte(id: number, req: ResolverReporteRequest): Observable<ReporteIncidencia> {
    const respuesta = (req.respuestaAdmin ?? req.resolucion ?? '').trim();
    const payload = {
      estado: req.estado || 'RESUELTO',
      respuestaAdmin: respuesta,
      reembolsoProcedente: req.reembolsoProcedente ?? req.ejecutarReembolso ?? false,
      montoReembolso: req.montoReembolso
    };
    const idempotencyKey = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `reclamo-${id}-${Date.now()}`;

    return this.http.patch<ReporteIncidencia>(
      `${this.API_URL}/feedback/admin/reportes/${id}/resolver`,
      payload,
      { headers: { 'Idempotency-Key': idempotencyKey } }
    ).pipe(
      tap(resuelto => {
        this.reportes.update(prev => prev.map(r => r.id === id ? resuelto : r));
        this.notify.showSuccess(`Incidencia #${id} ${resuelto.estado.toLowerCase()}`);
      })
    );
  }

  calificarPedido(req: { ordenId: number; estrellas: number; comentario?: string }): Observable<Resenia> {
    return this.enviarResenia({
      ordenId: req.ordenId,
      calificacion: req.estrellas,
      comentario: req.comentario
    });
  }

  registrarReclamo(req: { ordenId: number; motivo: any; descripcion: string; montoReclamado?: number; evidenciaUrl?: string }, foto?: File): Observable<ReporteIncidencia> {
    return this.crearReporteMultipart(req.ordenId, req.motivo, req.descripcion, foto);
  }

  resolverReclamo(id: number, resolucion: string, emitirReembolso?: boolean, montoReembolso?: number, estadoFinal: EstadoReclamo = 'RESUELTO'): Observable<ReporteIncidencia> {
    return this.resolverReporte(id, {
      estado: estadoFinal,
      respuestaAdmin: resolucion,
      reembolsoProcedente: !!emitirReembolso,
      montoReembolso: montoReembolso
    });
  }

  cambiarEstadoReporte(id: number, estado: EstadoReclamo): Observable<ReporteIncidencia> {
    return this.http.patch<ReporteIncidencia>(`${this.API_URL}/feedback/admin/reportes/${id}/estado`, null, {
      params: { estado }
    }).pipe(
      tap(actualizado => {
        this.reportes.update(prev => prev.map(r => r.id === id ? actualizado : r));
        this.notify.showSuccess(`Ticket #${id} cambiado a ${estado}`);
      })
    );
  }

  responderResenia(id: number, respuestaAdmin: string): Observable<Resenia> {
    return this.http.patch<Resenia>(`${this.API_URL}/feedback/resenias/admin/${id}/responder`, { respuestaAdmin }).pipe(
      tap(actualizada => {
        this.resenias.update(prev => prev.map(r => r.id === id ? actualizada : r));
        this.notify.showSuccess('Respuesta de moderación guardada');
      })
    );
  }

  cambiarVisibilidadResenia(id: number, visible: boolean): Observable<Resenia> {
    return this.http.patch<Resenia>(`${this.API_URL}/feedback/resenias/admin/${id}/visibilidad`, null, {
      params: { visible: visible.toString() }
    }).pipe(
      tap(actualizada => {
        this.resenias.update(prev => prev.map(r => r.id === id ? actualizada : r));
        this.notify.showSuccess(`Reseña #${id} ${visible ? 'visible' : 'oculta'}`);
      })
    );
  }

  getEvidenciaBlobUrl(path: string): Observable<string> {
    const fullUrl = this.getFotoUrl(path);
    return this.http.get(fullUrl, { responseType: 'blob' }).pipe(
      map(blob => URL.createObjectURL(blob)),
      catchError(() => of(''))
    );
  }

  cargarDevolucionesPendientes(): void {
    this.http.get<ReporteIncidencia[]>(`${this.API_URL}/feedback/devoluciones/pendientes`).pipe(
      tap(data => {
        this.cargaError.set(null);
        this.devolucionesPendientes.set(data || []);
      }),
      catchError((err: unknown) => {
        this.cargaError.set(mensajeError(err, 'No se pudieron cargar las devoluciones pendientes.'));
        return of([]);
      })
    ).subscribe();
  }

  marcarDevuelto(id: number): Observable<ReporteIncidencia> {
    return this.http.patch<ReporteIncidencia>(`${this.API_URL}/feedback/reportes/${id}/entregar`, {}).pipe(
      tap(() => {
        this.devolucionesPendientes.update(prev => prev.filter(r => r.id !== id));
        this.notify.showSuccess(`Devolución #${id} entregada en ventanilla`);
      })
    );
  }

  reembolsarPagoDirecto(ordenId: number, monto: number, motivo: string): Observable<any> {
    const idempotencyKey = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `reembolso-${ordenId}-${Date.now()}`;
    return this.http.post(
      `${this.PAYMENTS_URL}/pagos/orden/${ordenId}/reembolso`,
      { monto, motivo },
      { headers: { 'Idempotency-Key': idempotencyKey } }
    ).pipe(
      tap(() => {
        this.notify.showSuccess(`Reembolso de S/ ${monto.toFixed(2)} procesado correctamente en pasarela`);
      })
    );
  }
}
