import { Injectable, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { RestaurantTable, TableStatus, OrdenActivaMesa, SalonZona } from '../models/table.model';
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

export interface ZonaSalonConfig {
  id: SalonZona;
  nombre: string;
  filas: number;
  columnas: number;
  color?: string;
}

export const DEFAULT_ZONAS_SALON: ZonaSalonConfig[] = [
  { id: 'SALON_PRINCIPAL', nombre: 'Salón Central', filas: 4, columnas: 5, color: 'border-polleria-gold/40' },
  { id: 'TERRAZA', nombre: 'Terraza al Aire Libre', filas: 8, columnas: 9, color: 'border-emerald-500/40' },
  { id: 'ZONA_VIP', nombre: 'Zona VIP', filas: 3, columnas: 4, color: 'border-purple-500/40' },
  { id: 'SEGUNDO_PISO', nombre: 'Segundo Piso', filas: 4, columnas: 6, color: 'border-sky-500/40' }
];

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
  readonly zonasSalon = signal<ZonaSalonConfig[]>(this.cargarZonasConfig());

  readonly mesasLibres = computed(() => this.mesas().filter(m => m.estado === 'LIBRE'));
  readonly mesasOcupadas = computed(() => this.mesas().filter(m => m.estado === 'OCUPADA'));
  readonly mesasPorCobrar = computed(() => this.mesas().filter(m => m.estado === 'POR_COBRAR'));
  readonly mesasEnLimpieza = computed(() => this.mesas().filter(m => m.estado === 'LIMPIEZA'));

  private pollingInterval: any = null;

  constructor() {
    this.cargarMesas();
    this.iniciarSincronizacionEnVivo();
  }

  private cargarZonasConfig(): ZonaSalonConfig[] {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const item = localStorage.getItem('polleria_zonas_config');
        if (item) {
          const parsed = JSON.parse(item);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch (e) {
        console.warn('Error leyendo configuración de zonas de localStorage', e);
      }
    }
    return DEFAULT_ZONAS_SALON;
  }

  guardarZonasConfig(zonas: ZonaSalonConfig[]): void {
    this.zonasSalon.set([...zonas]);
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.setItem('polleria_zonas_config', JSON.stringify(zonas));
      } catch (e) {
        console.warn('Error guardando configuración de zonas en localStorage', e);
      }
    }
  }

  ajustarDimensionesZona(zonaId: string, filasDelta: number, columnasDelta: number): void {
    const list = this.zonasSalon().map(z => {
      if (z.id === zonaId) {
        return {
          ...z,
          filas: Math.max(2, Math.min(15, z.filas + filasDelta)),
          columnas: Math.max(2, Math.min(20, z.columnas + columnasDelta))
        };
      }
      return z;
    });
    this.guardarZonasConfig(list);
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

  actualizarEstado(id: string | number, estado: TableStatus, forzar: boolean = false): Observable<RestaurantTable> {
    return this.http.put<RestaurantTable>(`${this.API_URL}/mesas/${id}/estado`, { estado, forzar }).pipe(
      tap(actualizada => {
        this.mesas.update(prev => prev.map(m => m.id === id ? { ...m, estado } : m));
        this.notify.showSuccess(`Mesa #${actualizada.numero} actualizada a ${estado}`);
      })
    );
  }

  actualizarEstadoMesa(id: string | number, estado: TableStatus, forzar: boolean = false): Observable<RestaurantTable> {
    return this.actualizarEstado(id, estado, forzar);
  }

  obtenerOrdenActiva(id: string | number): Observable<OrdenActivaMesa> {
    return this.http.get<OrdenActivaMesa>(`${this.API_URL}/mesas/${id}/orden-activa`);
  }

  crearMesa(req: { numero: number; capacidad: number; posicionX?: number; posicionY?: number; zona?: string }): Observable<RestaurantTable> {
    return this.http.post<RestaurantTable>(`${this.API_URL}/mesas`, req).pipe(
      tap(nueva => {
        this.mesas.update(prev => [...prev, nueva]);
        this.notify.showSuccess(`Mesa #${nueva.numero} creada con éxito`);
      })
    );
  }

  actualizarMesa(id: string | number, req: { numero?: number; capacidad?: number; posicionX?: number; posicionY?: number; zona?: string; activo?: boolean }): Observable<RestaurantTable> {
    return this.http.put<RestaurantTable>(`${this.API_URL}/mesas/${id}`, req).pipe(
      tap(actualizada => {
        this.mesas.update(prev => prev.map(m => m.id === id ? { ...m, ...actualizada } : m));
        this.notify.showSuccess(`Mesa #${actualizada.numero} modificada con éxito`);
      })
    );
  }

  eliminarMesa(id: string | number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/mesas/${id}`).pipe(
      tap(() => {
        this.mesas.update(prev => prev.filter(m => m.id !== id));
        this.notify.showSuccess(`Mesa dada de baja`);
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
                    mensaje: `¡Pedido listo para servir en Mesa #${nm.numero}!`,
                    timestamp: new Date().toLocaleTimeString().slice(0, 5)
                  },
                  ...a
                ]);
                this.notify.showSuccess(`Mesa #${nm.numero}: Pedido listo para servir`);
              }
            }
          });
          this.mesas.set(nuevasMesas);
        }
      });
    }, 6000);
  }
}
