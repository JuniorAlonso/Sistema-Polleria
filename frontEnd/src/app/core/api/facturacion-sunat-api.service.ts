import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Estado del comprobante ante SUNAT (alineado a EstadoSunat.java). */
export type EstadoSunat = 'ENVIANDO' | 'ACEPTADO' | 'OBSERVADO' | 'RECHAZADO' | 'ERROR';

export interface EnvioSunatResponse {
  ordenId: number;
  comprobanteId: number;
  tipo: 'FACTURA' | 'BOLETA';
  serieNumero: string;
  nombreArchivo: string;
  estado: EstadoSunat;
  codigoRespuesta: string | null;
  descripcion: string | null;
  observaciones: string | null;
  hash: string | null;
  total: number;
  intentos: number;
  enviadoEn: string | null;
  tieneCdr: boolean;
}

/**
 * Capa HTTP pura de facturacion-sunat-service (:8089).
 * El interceptor de autenticación adjunta el JWT; por eso XML, CDR y ticket HTML se solicitan como Blob.
 */
@Injectable({ providedIn: 'root' })
export class FacturacionSunatApiService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = environment.facturacionApiUrl || 'http://localhost:8089';

  enviarASunat(ordenId: number): Observable<EnvioSunatResponse> {
    return this.http.post<EnvioSunatResponse>(`${this.API_URL}/facturacion/orden/${ordenId}/enviar`, {});
  }

  obtenerEstado(ordenId: number): Observable<EnvioSunatResponse> {
    return this.http.get<EnvioSunatResponse>(`${this.API_URL}/facturacion/orden/${ordenId}`);
  }

  listar(estado?: EstadoSunat): Observable<EnvioSunatResponse[]> {
    let params = new HttpParams();
    if (estado) {
      params = params.set('estado', estado);
    }
    return this.http.get<EnvioSunatResponse[]>(`${this.API_URL}/facturacion`, { params });
  }

  descargarXml(ordenId: number): Observable<Blob> {
    return this.http.get(`${this.API_URL}/facturacion/orden/${ordenId}/xml`, { responseType: 'blob' });
  }

  descargarCdr(ordenId: number): Observable<Blob> {
    return this.http.get(`${this.API_URL}/facturacion/orden/${ordenId}/cdr`, { responseType: 'blob' });
  }

  obtenerTicketHtml(ordenId: number): Observable<Blob> {
    return this.http.get(`${this.API_URL}/facturacion/orden/${ordenId}/ticket`, { responseType: 'blob' });
  }
}
