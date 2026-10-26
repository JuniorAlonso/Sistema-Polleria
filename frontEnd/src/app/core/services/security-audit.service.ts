import { Injectable, inject, signal } from '@angular/core';
import { IncidentsApiService } from '../api/incidents-api.service';
import { Observable, tap, catchError, of } from 'rxjs';
import { Incidente, CrearIncidenteRequest, ResolverIncidenteRequest, IpBloqueada } from '../models/incident.model';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root'
})
export class SecurityAuditService {
  private api = inject(IncidentsApiService);
  private notify = inject(NotificationService);


  readonly ipsBloqueadas = signal<IpBloqueada[]>([]);
  readonly incidentes = signal<Incidente[]>([]);
  readonly isLoading = signal<boolean>(false);

  constructor() {
    this.cargarIpsBloqueadas();
    this.cargarIncidentes();
  }

  cargarIpsBloqueadas(): void {
    this.api.listarIpsBloqueadas().pipe(
      tap(data => {
        const mapped = data.map(i => ({
          ...i,
          intentosFallidos: i.failedAttempts,
          fechaBloqueo: i.lastAttempt,
          motivo: i.motivo || 'Múltiples intentos fallidos de autenticación'
        }));
        this.ipsBloqueadas.set(mapped);
      }),
      catchError(() => of([]))
    ).subscribe();
  }

  desbloquearIp(ip: string): Observable<void> {
    return this.api.desbloquearIp(ip).pipe(
      tap(() => {
        this.ipsBloqueadas.update(prev => prev.filter(i => i.ip !== ip));
        this.notify.showSuccess(`IP ${ip} desbloqueada manualmente por el administrador`);
      })
    );
  }

  cargarIncidentes(): void {
    this.api.listar().pipe(
      tap(data => {
        const mapped = data.map(inc => ({
          ...inc,
          modulo: inc.modulo || inc.tipo,
          reportadoPor: inc.reportadoPor || inc.responsable || 'Administrador',
          fechaHora: inc.fechaHora || inc.ocurridoEn
        }));
        this.incidentes.set(mapped);
      }),
      catchError(() => of([]))
    ).subscribe();
  }

  registrarIncidente(req: CrearIncidenteRequest): Observable<Incidente> {
    const payload = {
      ...req,
      tipo: req.tipo || 'TECNICO',
      descripcion: req.descripcion || req.causaRaiz || req.titulo,
      responsable: req.responsable || req.reportadoPor || 'Administrador'
    };
    return this.api.registrar(payload).pipe(
      tap(inc => {
        this.incidentes.update(prev => [inc, ...prev]);
        this.notify.showSuccess(`Incidente #${inc.id} registrado: ${inc.titulo}`);
      })
    );
  }

  resolverIncidente(id: number, req: ResolverIncidenteRequest): Observable<Incidente> {
    return this.api.resolver(id, req).pipe(
      tap(resuelto => {
        this.incidentes.update(prev => prev.map(i => i.id === id ? resuelto : i));
        this.notify.showSuccess(`Incidente #${id} resuelto y documentado`);
      })
    );
  }
}
