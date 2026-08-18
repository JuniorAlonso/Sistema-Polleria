import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Orden, CrearOrdenRequest, OrdenEstado } from '../models/orden.models';

@Injectable({ providedIn: 'root' })
export class OrdenService {

  private readonly API = `${environment.ordersApiUrl}/ordenes`;

  constructor(private http: HttpClient) {}

  crear(data: CrearOrdenRequest) {
    return this.http.post<Orden>(this.API, data);
  }

  obtener(id: number) {
    return this.http.get<Orden>(`${this.API}/${id}`);
  }

  misOrdenes() {
    return this.http.get<Orden[]>(`${this.API}/mis-ordenes`);
  }

  activos() {
    return this.http.get<Orden[]>(`${this.API}/activos`);
  }

  paraCocina() {
    return this.http.get<Orden[]>(`${this.API}/cocina`);
  }

  actualizarEstado(id: number, estado: OrdenEstado) {
    return this.http.patch<Orden>(`${this.API}/${id}/estado`, { estado });
  }
}
