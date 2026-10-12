import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { 
  Insumo, CrearInsumoRequest, ActualizarStockRequest, 
  DespachoCocina, CrearDespachoRequest, 
  Merma, RegistrarMermaRequest, 
  AlertaStock, RentabilidadInventario 
} from '../models/inventory.model';
import { environment } from '../../../environments/environment';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private http = inject(HttpClient);
  private notify = inject(NotificationService);

  private readonly API_URL = environment.inventoryApiUrl || 'http://localhost:8086';

  readonly insumos = signal<Insumo[]>([]);
  readonly mermas = signal<Merma[]>([]);
  readonly despachos = signal<DespachoCocina[]>([]);
  readonly alertas = signal<AlertaStock[]>([]);
  readonly rentabilidad = signal<RentabilidadInventario | null>(null);
  readonly isLoading = signal<boolean>(false);

  constructor() {
    this.cargarInsumos();
    this.cargarAlertas();
    this.cargarRentabilidad();
    this.cargarMermas();
    this.cargarDespachos();
  }

  cargarInsumos(): void {
    this.isLoading.set(true);
    this.http.get<Insumo[]>(`${this.API_URL}/inventario/insumos`).pipe(
      tap(data => {
        const mapped = data.map(ins => ({
          ...ins,
          stockMinimo: ins.stockMinimo ?? ins.stockMinimoAlerta,
          categoria: ins.categoria ?? 'ABARROTES',
          estado: ins.estado ?? (ins.stockActual <= ins.stockMinimoAlerta ? 'CRITICO' : ins.stockActual <= ins.stockMinimoAlerta * 1.5 ? 'BAJO' : 'OPTIMO')
        }));
        this.insumos.set(mapped);
        this.isLoading.set(false);
      }),
      catchError(() => {
        this.isLoading.set(false);
        return of([]);
      })
    ).subscribe();
  }

  crearInsumo(req: CrearInsumoRequest): Observable<Insumo> {
    return this.http.post<Insumo>(`${this.API_URL}/inventario/insumos`, req).pipe(
      tap(nuevo => {
        this.insumos.update(prev => [...prev, nuevo]);
        this.notify.showSuccess(`Insumo "${nuevo.nombre}" creado exitosamente`);
        this.cargarRentabilidad();
      })
    );
  }

  actualizarStock(id: number, req: ActualizarStockRequest): Observable<Insumo> {
    // El backend expone PATCH /inventario/insumos/{id}/stock, no PUT.
    return this.http.patch<Insumo>(`${this.API_URL}/inventario/insumos/${id}/stock`, req).pipe(
      tap(actualizado => {
        this.insumos.update(prev => prev.map(i => i.id === id ? actualizado : i));
        this.notify.showSuccess(`Stock actualizado para ${actualizado.nombre}`);
        this.cargarAlertas();
        this.cargarRentabilidad();
      })
    );
  }

  registrarDespacho(req: CrearDespachoRequest): Observable<DespachoCocina> {
    return this.http.post<DespachoCocina>(`${this.API_URL}/inventario/despachos`, req).pipe(
      tap(despacho => {
        this.despachos.update(prev => [despacho, ...prev]);
        this.notify.showSuccess(`Despacho a cocina #${despacho.id} registrado con éxito`);
        this.cargarInsumos();
        this.cargarAlertas();
      })
    );
  }

  despacharACocina(req: { insumoId: number; cantidad: number; estacionDestino?: string }): Observable<DespachoCocina> {
    return this.registrarDespacho({
      solicitanteNombre: req.estacionDestino || 'Cocina Principal',
      items: [{
        insumoId: req.insumoId,
        cantidad: req.cantidad,
        observaciones: req.estacionDestino
      }]
    });
  }

  cargarDespachos(): void {
    this.http.get<DespachoCocina[]>(`${this.API_URL}/inventario/despachos`).pipe(
      tap(data => this.despachos.set(data)),
      catchError(() => of([]))
    ).subscribe();
  }

  registrarMerma(req: RegistrarMermaRequest): Observable<Merma> {
    return this.http.post<Merma>(`${this.API_URL}/inventario/mermas`, req).pipe(
      tap(merma => {
        this.mermas.update(prev => [merma, ...prev]);
        this.notify.showSuccess(`Merma de ${merma.cantidad} ${merma.insumoNombre} registrada`);
        this.cargarInsumos();
        this.cargarRentabilidad();
      })
    );
  }

  cargarMermas(): void {
    this.http.get<Merma[]>(`${this.API_URL}/inventario/mermas`).pipe(
      tap(data => this.mermas.set(data)),
      catchError(() => of([]))
    ).subscribe();
  }

  cargarAlertas(): void {
    this.http.get<AlertaStock[]>(`${this.API_URL}/inventario/alertas`).pipe(
      tap(data => this.alertas.set(data)),
      catchError(() => of([]))
    ).subscribe();
  }

  cargarRentabilidad(): void {
    this.http.get<RentabilidadInventario>(`${this.API_URL}/inventario/rentabilidad`).pipe(
      tap(data => this.rentabilidad.set(data)),
      catchError(() => of(null))
    ).subscribe();
  }
}
