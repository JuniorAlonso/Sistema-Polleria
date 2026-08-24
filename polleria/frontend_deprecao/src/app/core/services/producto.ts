import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Producto, Categoria } from '../models/orden.models';

@Injectable({ providedIn: 'root' })
export class ProductoService {

  private readonly API = `${environment.ordersApiUrl}/productos`;

  constructor(private http: HttpClient) {}

  getCartaDisponible() {
    return this.http.get<Producto[]>(this.API);
  }

  getPorCategoria(categoria: Categoria) {
    return this.http.get<Producto[]>(this.API, {
      params: new HttpParams().set('categoria', categoria)
    });
  }

  getTodos() {
    return this.http.get<Producto[]>(this.API, {
      params: new HttpParams().set('soloDisponibles', 'false')
    });
  }

  crear(data: Partial<Producto>) {
    return this.http.post<Producto>(this.API, data);
  }

  actualizar(id: number, data: Partial<Producto>) {
    return this.http.put<Producto>(`${this.API}/${id}`, data);
  }

  toggleDisponibilidad(id: number) {
    return this.http.patch<Producto>(`${this.API}/${id}/disponibilidad`, {});
  }

  eliminar(id: number) {
    return this.http.delete<void>(`${this.API}/${id}`);
  }
}
