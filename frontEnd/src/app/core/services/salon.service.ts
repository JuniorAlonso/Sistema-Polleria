import { Injectable, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { RestaurantTable, TableStatus, OrdenActivaMesa } from '../models/table.model';
import { environment } from '../../../environments/environment';
import { NotificationService } from './notification.service';

export interface AlertaPlatoListoEvento {
  tipo: string;
  ordenId: number;
  mesaId?: number;
  mesaNumero?: number;
  mensaje: string;
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class SalonService {
  private http = inject(HttpClient);
  private notify = inject(NotificationService);
  private platformId = inject(PLATFORM_ID);

  private readonly API_URL = environment.ordersApiUrl || 'http://localhost:8082';

  readonly mesas = signal<RestaurantTable[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly alertasCocina = signal<AlertaPlatoListoEvento[]>([]);

  readonly mesasLibres = computed(() => this.mesas().filter(m => m.estado === 'LIBRE'));
  readonly mesasOcupadas = computed(() => this.mesas().filter(m => m.estado === 'OCUPADA'));
  readonly mesasPorCobrar = computed(() => this.mesas().filter(m => m.estado === 'POR_COBRAR'));
  readonly mesasEnLimpieza = computed(() => this.mesas().filter(m => m.estado === 'LIMPIEZA'));

  private pollingInterval: any = null;

  constructor() {
    this.cargarMesas();
    this.iniciarSincronizacionEnVivo();
  }

  cargarMesas(): void {
    this.isLoading.set(true);
    this.http.get<RestaurantTable[]>(`${this.API_URL}/mesas`).pipe(
      tap(data => {
        this.mesas.set(data);
        this.isLoading.set(false);
      }),
      catchError(err => {
        this.isLoading.set(false);
        return of([]);
      })
    ).subscribe();
  }

  actualizarPosicion(id: string | number, posicionX: number, posicionY: number): Observable<RestaurantTable> {
    return this.http.put<RestaurantTable>(`${this.API_URL}/mesas/${id}/posicion`, { posicionX, posicionY }).pipe(
      tap(actualizada => {
        this.mesas.update(prev => prev.map(m => m.id === id ? { ...m, posicionX, posicionY } : m));
        this.notify.showSuccess(`Mesa #${actualizada.numero} reposicionada en (${posicionX}, ${posicionY})`);
      })
    );
  }

  actualizarPosicionMesa(id: string | number, posicionX: number, posicionY: number): Observable<RestaurantTable> {
    return this.actualizarPosicion(id, posicionX, posicionY);
  }

  actualizarEstado(id: string | number, estado: TableStatus): Observable<RestaurantTable> {
    return this.http.put<RestaurantTable>(`${this.API_URL}/mesas/${id}/estado`, { estado }).pipe(
      tap(actualizada => {
        this.mesas.update(prev => prev.map(m => m.id === id ? { ...m, estado } : m));
        this.notify.showSuccess(`Mesa #${actualizada.numero} actualizada a ${estado}`);
      })
    );
  }

  actualizarEstadoMesa(id: string | number, estado: TableStatus): Observable<RestaurantTable> {
    return this.actualizarEstado(id, estado);
  }

  obtenerOrdenActiva(id: string | number): Observable<OrdenActivaMesa> {
    return this.http.get<OrdenActivaMesa>(`${this.API_URL}/mesas/${id}/orden-activa`);
  }

  crearMesa(req: { numero: number; capacidad: number; posicionX?: number; posicionY?: number }): Observable<RestaurantTable> {
    return this.http.post<RestaurantTable>(`${this.API_URL}/mesas`, req).pipe(
      tap(nueva => {
        this.mesas.update(prev => [...prev, nueva]);
        this.notify.showSuccess(`Mesa #${nueva.numero} creada con éxito`);
      })
    );
  }

  /**
   * Sincronización en vivo con WebSocket / SockJS y fallback reactivo
   */
  private iniciarSincronizacionEnVivo(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Fallback de polling de alta frecuencia (cada 6s) para actualizar el plano y alertar platos listos
    this.pollingInterval = setInterval(() => {
      this.http.get<RestaurantTable[]>(`${this.API_URL}/mesas`).pipe(
        catchError(() => of([]))
      ).subscribe(nuevasMesas => {
        if (nuevasMesas.length > 0) {
          // Detectar si alguna mesa pasó a tener orden lista
          nuevasMesas.forEach(nm => {
            if (nm.ordenActiva && nm.ordenActiva.estadoOrden === 'LISTO') {
              const prev = this.mesas().find(m => m.id === nm.id);
              if (!prev || !prev.ordenActiva || prev.ordenActiva.estadoOrden !== 'LISTO') {
                this.alertasCocina.update(a => [
                  {
                    tipo: 'PEDIDO_LISTO',
                    ordenId: nm.ordenActiva!.ordenId,
                    mesaId: Number(nm.id),
                    mesaNumero: nm.numero,
                    mensaje: `🔔 ¡Pedido listo para servir en Mesa #${nm.numero}!`,
                    timestamp: new Date().toLocaleTimeString().slice(0, 5)
                  },
                  ...a
                ]);
                this.notify.showSuccess(`🔔 Mesa #${nm.numero}: Pedido listo para servir`);
              }
            }
          });
          this.mesas.set(nuevasMesas);
        }
      });
    }, 6000);
  }
}
