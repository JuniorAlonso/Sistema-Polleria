import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Incidente, ResolverIncidenteRequest, IpBloqueada } from '../models/incident.model';
import { environment } from '../../../environments/environment';

/** Capa HTTP pura de incident-service (:8088) y del bloqueo de IPs de auth-service (:8081). */
@Injectable({ providedIn: 'root' })
export class IncidentsApiService {
  private readonly http = inject(HttpClient);
  private readonly AUTH_URL = environment.authApiUrl || 'http://localhost:8081';
  private readonly INCIDENT_URL = environment.incidentApiUrl || 'http://localhost:8088';

  listarIpsBloqueadas(): Observable<IpBloqueada[]> {
    return this.http.get<IpBloqueada[]>(`${this.AUTH_URL}/auth/admin/ips-bloqueadas`);
  }

  desbloquearIp(ip: string): Observable<void> {
    return this.http.delete<void>(`${this.AUTH_URL}/auth/admin/ips-bloqueadas/${ip}`);
  }

  listar(): Observable<Incidente[]> {
    return this.http.get<Incidente[]>(`${this.INCIDENT_URL}/incidentes`);
  }

  registrar(payload: unknown): Observable<Incidente> {
    return this.http.post<Incidente>(`${this.INCIDENT_URL}/incidentes`, payload);
  }

  resolver(id: number | string, req: ResolverIncidenteRequest): Observable<Incidente> {
    return this.http.patch<Incidente>(`${this.INCIDENT_URL}/incidentes/${id}/resolver`, req);
  }
}
