import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { IniciarPagoRequest, Pago } from '../models/orden.models';

@Injectable({ providedIn: 'root' })
export class PagoService {

  private readonly API = `${environment.paymentsApiUrl}/pagos`;

  constructor(private http: HttpClient) {}

  iniciar(data: IniciarPagoRequest) {
    return this.http.post<Pago>(this.API, data);
  }

  obtener(id: number) {
    return this.http.get<Pago>(`${this.API}/${id}`);
  }

  porOrden(ordenId: number) {
    return this.http.get<Pago>(`${this.API}/orden/${ordenId}`);
  }

  misPagos() {
    return this.http.get<Pago[]>(`${this.API}/mis-pagos`);
  }

  cancelar(id: number) {
    return this.http.patch<Pago>(`${this.API}/${id}/cancelar`, {});
  }
}
