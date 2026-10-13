import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Motorizado asignable a un pedido de delivery (auth-service, GET /auth/admin/repartidores). */
export interface Repartidor {
  id: number;
  nombre: string;
  email: string;
  telefono: string;
}

/**
 * Roster real de motorizados para el modal de asignación del panel.
 *
 * No se carga solo: el endpoint exige rol ADMIN, así que llamarlo desde una pantalla de otro rol
 * (el panel del motorizado) devolvería 403. Cada pantalla que lo necesita lo pide explícitamente.
 */
@Injectable({
  providedIn: 'root'
})
export class RepartidoresService {
  private http = inject(HttpClient);
  private readonly API_URL = environment.authApiUrl || 'http://localhost:8081';

  readonly repartidores = signal<Repartidor[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly hasError = signal<boolean>(false);

  /** Nombre del motorizado por id, para no mostrar "Repartidor #7" inventado en las tablas. */
  readonly nombrePorId = computed<Record<number, string>>(() => {
    const mapa: Record<number, string> = {};
    for (const repartidor of this.repartidores()) {
      mapa[repartidor.id] = repartidor.nombre;
    }
    return mapa;
  });

  cargar(): void {
    this.isLoading.set(true);
    this.http.get<Repartidor[]>(`${this.API_URL}/auth/admin/repartidores`).pipe(
      tap(lista => {
        this.repartidores.set(Array.isArray(lista) ? lista : []);
        this.hasError.set(false);
        this.isLoading.set(false);
      }),
      catchError(() => {
        // Sin roster no se inventa un motorizado: el modal lo informa y no deja despachar.
        this.repartidores.set([]);
        this.hasError.set(true);
        this.isLoading.set(false);
        return of([]);
      })
    ).subscribe();
  }
}
