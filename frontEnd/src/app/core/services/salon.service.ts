import { Injectable, inject, signal, computed, PLATFORM_ID, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of, throwError } from 'rxjs';
import { RestaurantTable, TableStatus, OrdenActivaMesa, SalonZona } from '../models/table.model';
import { environment } from '../../../environments/environment';
import { NotificationService } from './notification.service';
import { AuthService } from './auth.service';

export interface AlertaPlatoListoEvento {
  tipo: string;
  ordenId: number;
  mesaId?: number;
  mesaNumero?: number;
  mensaje: string;
  timestamp: string;
}

export interface ZonaSalonBackend {
  id: number;
  slug: string;
  nombre: string;
  filas: number;
  columnas: number;
  color?: string;
  orden?: number;
  activo?: boolean;
}

export interface ZonaSalonConfig {
  id: SalonZona;
  dbId?: number;
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
export class SalonService implements OnDestroy {
  private http = inject(HttpClient);
  private notify = inject(NotificationService);
  private platformId = inject(PLATFORM_ID);
  private auth = inject(AuthService);

  private readonly API_URL = environment.ordersApiUrl || 'http://localhost:8082';

  readonly mesas = signal<RestaurantTable[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly hasError = signal<boolean>(false);
  readonly alertasCocina = signal<AlertaPlatoListoEvento[]>([]);
  readonly zonasSalon = signal<ZonaSalonConfig[]>(DEFAULT_ZONAS_SALON);

  readonly mesasLibres = computed(() => this.mesas().filter(m => m.estado === 'LIBRE'));
  readonly mesasOcupadas = computed(() => this.mesas().filter(m => m.estado === 'OCUPADA'));
  readonly mesasPorCobrar = computed(() => this.mesas().filter(m => m.estado === 'POR_COBRAR'));
  readonly mesasEnLimpieza = computed(() => this.mesas().filter(m => m.estado === 'LIMPIEZA' || m.estado === 'EN_LIMPIEZA'));

  private pollingInterval: any = null;

  constructor() {
    this.cargarZonas();
    this.cargarMesas();
    this.iniciarSincronizacionEnVivo();
  }

  ngOnDestroy(): void {
    this.detenerSincronizacion();
  }

  detenerSincronizacion(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  cargarZonas(): void {
    this.http.get<ZonaSalonBackend[]>(`${this.API_URL}/zonas`).pipe(
      catchError(err => {
        console.warn('[SalonService] No se pudieron cargar zonas del backend, usando configuración default', err);
        return of([]);
      })
    ).subscribe(data => {
      if (Array.isArray(data) && data.length > 0) {
        const configs: ZonaSalonConfig[] = data.map(z => ({
          id: z.slug,
          dbId: z.id,
          nombre: z.nombre,
          filas: z.filas,
          columnas: z.columnas,
          color: z.color || 'border-polleria-gold/40'
        }));
        this.zonasSalon.set(configs);
      }
    });
  }

  ajustarDimensionesZona(zonaId: string, filasDelta: number, columnasDelta: number): void {
    const list = this.zonasSalon().map(z => {
      if (z.id === zonaId) {
        const updated = {
          ...z,
          filas: Math.max(2, Math.min(15, z.filas + filasDelta)),
          columnas: Math.max(2, Math.min(20, z.columnas + columnasDelta))
        };
        if (updated.dbId) {
          this.http.put(`${this.API_URL}/zonas/${updated.dbId}/dimensiones`, {
            filas: updated.filas,
            columnas: updated.columnas
          }).pipe(
            catchError(err => {
              console.warn('[SalonService] Error al persistir dimensiones de zona en servidor', err);
              return of(null);
            })
          ).subscribe();
        }
        return updated;
      }
      return z;
    });
    this.zonasSalon.set(list);
  }

  cargarMesas(): void {
    // Sin sesión no hay nada que pedir: /mesas exige autenticación y respondería 403 (rellenando
    // la consola de errores). El interceptor se encarga de devolver al usuario al login.
    if (!this.haySesion()) {
      return;
    }

    this.isLoading.set(true);
    this.http.get<RestaurantTable[]>(`${this.API_URL}/mesas`).pipe(
      tap(data => {
        this.mesas.set(data);
        this.isLoading.set(false);
        this.hasError.set(false);
      }),
      catchError(err => {
        this.isLoading.set(false);
        this.hasError.set(true);
        console.warn('[SalonService] Error al cargar mesas desde el servidor:', err);
        return of([]);
      })
    ).subscribe();
  }

  private haySesion(): boolean {
    return !!this.auth.getAccessToken();
  }

  private manejarErrorMutacion(err: any): Observable<never> {
    if (err?.status === 409) {
      this.notify.showWarning(
        '⚠️ Conflicto de Concurrencia',
        '⚠️ Conflicto: Otro usuario modificó esta mesa. Actualizando vista...'
      );
      this.cargarMesas();
    } else {
      const msg = err?.error?.error || 'No se pudo completar la operación en la mesa';
      this.notify.showError('Error en Operación', msg);
    }
    return throwError(() => err);
  }

  actualizarPosicion(id: string | number, posicionX: number, posicionY: number): Observable<RestaurantTable> {
    return this.http.put<RestaurantTable>(`${this.API_URL}/mesas/${id}/posicion`, { posicionX, posicionY }).pipe(
      tap(actualizada => {
        this.mesas.update(prev => prev.map(m => m.id === id ? { ...m, posicionX, posicionY } : m));
        this.notify.showSuccess(`Mesa #${actualizada.numero} reposicionada en (${posicionX}, ${posicionY})`);
      }),
      catchError(err => this.manejarErrorMutacion(err))
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
      }),
      catchError(err => this.manejarErrorMutacion(err))
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
      }),
      catchError(err => this.manejarErrorMutacion(err))
    );
  }

  actualizarMesa(id: string | number, req: { numero?: number; capacidad?: number; posicionX?: number; posicionY?: number; zona?: string; activo?: boolean }): Observable<RestaurantTable> {
    return this.http.put<RestaurantTable>(`${this.API_URL}/mesas/${id}`, req).pipe(
      tap(actualizada => {
        this.mesas.update(prev => prev.map(m => m.id === id ? { ...m, ...actualizada } : m));
        this.notify.showSuccess(`Mesa #${actualizada.numero} modificada con éxito`);
      }),
      catchError(err => this.manejarErrorMutacion(err))
    );
  }

  eliminarMesa(id: string | number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/mesas/${id}`).pipe(
      tap(() => {
        this.mesas.update(prev => prev.filter(m => m.id !== id));
        this.notify.showSuccess(`Mesa dada de baja`);
      }),
      catchError(err => this.manejarErrorMutacion(err))
    );
  }

  /**
   * Sincronización en vivo con WebSocket / SockJS y fallback reactivo
   */
  private iniciarSincronizacionEnVivo(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Fallback de polling de alta frecuencia (cada 6s) para actualizar el plano y alertar platos listos
    this.pollingInterval = setInterval(() => {
      if (!this.haySesion()) {
        return;
      }
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
