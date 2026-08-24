import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Mesa, MesaEstado } from '../models/orden.models';

@Injectable({
  providedIn: 'root',
})
export class MesaService {
  private readonly http = inject(HttpClient);
  private readonly API = `${environment.ordersApiUrl}/mesas`;

  getAll() {
    return this.http.get<Mesa[]>(this.API);
  }

  getLibres() {
    return this.http.get<Mesa[]>(`${this.API}/libres`);
  }

  actualizarEstado(id: number, estado: MesaEstado) {
    return this.http.patch<Mesa>(`${this.API}/${id}/estado`, { estado });
  }
}
