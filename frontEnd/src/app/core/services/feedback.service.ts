import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { Resenia, CrearReseniaRequest, ReporteIncidencia, CrearReporteRequest, ResolverReporteRequest } from '../models/feedback.model';
import { environment } from '../../../environments/environment';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root'
})
export class FeedbackService {
  private http = inject(HttpClient);
  private notify = inject(NotificationService);

  private readonly API_URL = environment.feedbackApiUrl || 'http://localhost:8085';
  private readonly PAYMENTS_URL = environment.paymentsApiUrl || 'http://localhost:8083';

  readonly resenias = signal<Resenia[]>([]);
  readonly reportes = signal<ReporteIncidencia[]>([]);
  readonly isLoading = signal<boolean>(false);

  readonly promedioEstrellas = computed(() => {
    const list = this.resenias();
    if (list.length === 0) return 5.0;
    const total = list.reduce((acc, r) => acc + (r.calificacion || 5), 0);
    return Number((total / list.length).toFixed(1));
  });

  readonly reclamosPendientes = computed(() => {
    return this.reportes().filter(r => r.estado === 'ABIERTO' || r.estado === 'EN_REVISION' || r.estado === 'PENDIENTE');
  });

  constructor() {
    // Solo la carga pública. `cargarReportes()` pega a /feedback/admin/reportes, que exige
    // ADMIN: como este servicio lo inyecta también la página pública de seguimiento, llamarlo
    // aquí provocaba un 403 en la consola de cada visitante anónimo. El panel de administración
    // lo invoca explícitamente cuando corresponde.
    this.cargarResenias();
  }

  cargarResenias(): void {
    this.http.get<Resenia[]>(`${this.API_URL}/feedback/resenias`).pipe(
      tap(data => {
        const mapped = data.map(r => ({
          ...r,
          estrellas: r.estrellas ?? r.calificacion,
          fecha: r.fecha ?? (r.creadoEn ? new Date(r.creadoEn).toLocaleDateString() : 'Hoy')
        }));
        this.resenias.set(mapped);
      }),
      catchError(() => of([]))
    ).subscribe();
  }

  enviarResenia(req: CrearReseniaRequest): Observable<Resenia> {
    return this.http.post<Resenia>(`${this.API_URL}/feedback/resenias`, req).pipe(
      tap(res => {
        const mapped = {
          ...res,
          estrellas: res.estrellas ?? res.calificacion,
          fecha: res.fecha ?? 'Ahora'
        };
        this.resenias.update(prev => [mapped, ...prev]);
        this.notify.showSuccess('¡Muchas gracias por calificar tu pedido!');
      })
    );
  }

  cargarReportes(): void {
    this.http.get<ReporteIncidencia[]>(`${this.API_URL}/feedback/admin/reportes`).pipe(
      tap(data => this.reportes.set(data)),
      catchError(() => of([]))
    ).subscribe();
  }

  crearReporte(req: CrearReporteRequest, foto?: File): Observable<ReporteIncidencia> {
    const formData = new FormData();
    formData.append('ordenId', req.ordenId.toString());
    formData.append('motivo', req.motivo);
    formData.append('descripcion', req.descripcion);
    if (req.montoReclamado) {
      formData.append('montoReclamado', req.montoReclamado.toString());
    }
    if (foto) {
      formData.append('foto', foto);
    }

    // El backend recibe el reporte con foto en /feedback/reportes/multipart (FormData).
    return this.http.post<ReporteIncidencia>(`${this.API_URL}/feedback/reportes/multipart`, formData).pipe(
      tap(nuevo => {
        this.reportes.update(prev => [nuevo, ...prev]);
        this.notify.showSuccess('Incidencia reportada. Nuestro equipo de soporte la revisará a la brevedad.');
      })
    );
  }

  resolverReporte(id: number, req: ResolverReporteRequest): Observable<ReporteIncidencia> {
    // El backend expone PATCH /feedback/admin/reportes/{id}/resolver.
    return this.http.patch<ReporteIncidencia>(`${this.API_URL}/feedback/admin/reportes/${id}/resolver`, req).pipe(
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

  registrarReclamo(req: { ordenId: number; motivo: any; descripcion: string; montoReclamado?: number; evidenciaUrl?: string }): Observable<ReporteIncidencia> {
    return this.crearReporte({
      ordenId: req.ordenId,
      motivo: req.motivo,
      descripcion: req.descripcion,
      montoReclamado: req.montoReclamado
    });
  }

  resolverReclamo(id: number, resolucion: string, emitirReembolso?: boolean): Observable<ReporteIncidencia> {
    return this.resolverReporte(id, {
      estado: 'RESUELTO',
      resolucion,
      ejecutarReembolso: !!emitirReembolso
    });
  }

  reembolsarPagoDirecto(ordenId: number, monto: number, motivo: string): Observable<any> {
    return this.http.post(`${this.PAYMENTS_URL}/pagos/orden/${ordenId}/reembolso`, { monto, motivo }).pipe(
      tap(() => {
        this.notify.showSuccess(`Reembolso de S/ ${monto.toFixed(2)} procesado correctamente en pasarela`);
      })
    );
  }
}
