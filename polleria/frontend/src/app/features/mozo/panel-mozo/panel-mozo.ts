import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

import { OrdenService } from '../../../core/services/orden';
import { Orden, OrdenEstado } from '../../../core/models/orden.models';

@Component({
  selector: 'app-panel-mozo',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatChipsModule, MatBadgeModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="mozo-container">
      <div class="page-header">
        <h1 class="page-title">Panel del Mozo</h1>
        <span class="refresh-info">Actualiza cada 10 seg</span>
      </div>

      <div *ngIf="cargando()" class="loading">
        <mat-spinner diameter="48"></mat-spinner>
      </div>

      <div class="board" *ngIf="!cargando()">

        <!-- Columna: Recibidas -->
        <div class="column">
          <div class="col-header recibido">
            📋 Recibidas
            <span class="badge">{{ recibidas().length }}</span>
          </div>
          <div *ngIf="recibidas().length === 0" class="vacio">Sin pedidos nuevos</div>
          <mat-card *ngFor="let o of recibidas()" class="orden-card">
            <mat-card-content>
              <div class="orden-top">
                <strong>#{{ o.id }}</strong>
                <span class="tipo">{{ labelTipo(o) }}</span>
              </div>
              <ul class="items">
                <li *ngFor="let item of o.items">
                  <b>{{ item.cantidad }}x</b> {{ item.productoNombre }}
                </li>
              </ul>
              <div class="total">S/ {{ o.total | number:'1.2-2' }}</div>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- Columna: En preparación -->
        <div class="column">
          <div class="col-header preparacion">
            👨‍🍳 En Preparación
            <span class="badge">{{ enPreparacion().length }}</span>
          </div>
          <div *ngIf="enPreparacion().length === 0" class="vacio">Cocina sin pedidos</div>
          <mat-card *ngFor="let o of enPreparacion()" class="orden-card">
            <mat-card-content>
              <div class="orden-top">
                <strong>#{{ o.id }}</strong>
                <span class="tipo">{{ labelTipo(o) }}</span>
              </div>
              <ul class="items">
                <li *ngFor="let item of o.items">
                  <b>{{ item.cantidad }}x</b> {{ item.productoNombre }}
                </li>
              </ul>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- Columna: Listos para entregar -->
        <div class="column">
          <div class="col-header listo">
            ✅ Listos para Entregar
            <span class="badge alert-badge">{{ listos().length }}</span>
          </div>
          <div *ngIf="listos().length === 0" class="vacio">Nada listo aún</div>
          <mat-card *ngFor="let o of listos()" class="orden-card listo-card">
            <mat-card-content>
              <div class="orden-top">
                <strong>#{{ o.id }}</strong>
                <span class="tipo">{{ labelTipo(o) }}</span>
              </div>
              <ul class="items">
                <li *ngFor="let item of o.items">
                  <b>{{ item.cantidad }}x</b> {{ item.productoNombre }}
                </li>
              </ul>
              <button mat-raised-button color="primary" (click)="entregar(o)" style="width:100%;margin-top:8px">
                <mat-icon>check_circle</mat-icon> Marcar Entregado
              </button>
            </mat-card-content>
          </mat-card>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .mozo-container { padding: 16px; max-width: 1200px; margin: 0 auto; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .page-title { font-size: 1.8rem; font-weight: 700; color: #e65100; margin: 0; }
    .refresh-info { font-size: 0.8rem; color: #9e9e9e; }
    .loading { display: flex; justify-content: center; padding: 48px; }
    .board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    @media (max-width: 768px) { .board { grid-template-columns: 1fr; } }
    .column { display: flex; flex-direction: column; gap: 12px; }
    .col-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-radius: 8px; font-weight: 600; margin-bottom: 4px; }
    .recibido   { background: #fff3e0; color: #e65100; border-left: 4px solid #ff6d00; }
    .preparacion{ background: #e3f2fd; color: #1565c0; border-left: 4px solid #1976d2; }
    .listo      { background: #e8f5e9; color: #2e7d32; border-left: 4px solid #43a047; }
    .badge { background: rgba(0,0,0,0.12); border-radius: 12px; padding: 2px 8px; font-size: 0.85rem; }
    .alert-badge { background: #f44336; color: white; }
    .vacio { text-align: center; padding: 24px; color: #bdbdbd; font-size: 0.9rem; border: 2px dashed #e0e0e0; border-radius: 8px; }
    .orden-card { border-radius: 8px !important; }
    .listo-card { border: 2px solid #43a047 !important; }
    .orden-top { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .tipo { font-size: 0.8rem; color: #757575; }
    .items { list-style: none; padding: 0; margin: 0 0 8px; font-size: 0.9rem; }
    .items li { padding: 2px 0; border-bottom: 1px dashed #f0f0f0; }
    .total { text-align: right; font-weight: 600; color: #e65100; }
  `]
})
export class PanelMozoComponent implements OnInit, OnDestroy {

  private ordenSvc = inject(OrdenService);
  private snackBar = inject(MatSnackBar);

  ordenes  = signal<Orden[]>([]);
  cargando = signal(true);

  private estadosAnteriores = new Map<number, string>();
  private intervalId: ReturnType<typeof setInterval> | null = null;

  readonly recibidas      = () => this.ordenes().filter(o => o.estado === 'RECIBIDO');
  readonly enPreparacion  = () => this.ordenes().filter(o => o.estado === 'EN_PREPARACION');
  readonly listos         = () => this.ordenes().filter(o => o.estado === 'LISTO');

  ngOnInit() {
    this.cargar(true);
    this.intervalId = setInterval(() => this.cargar(false), 10000);
  }

  ngOnDestroy() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  cargar(inicial: boolean) {
    this.ordenSvc.activos().subscribe({
      next: os => {
        if (!inicial) {
          os.forEach(orden => {
            const prev = this.estadosAnteriores.get(orden.id);
            if (prev && prev !== orden.estado && orden.estado === 'LISTO') {
              this.snackBar.open(
                `🍗 Pedido #${orden.id} está LISTO para entregar`,
                'OK',
                { duration: 8000, panelClass: ['snack-listo'] }
              );
            }
          });
        }
        os.forEach(o => this.estadosAnteriores.set(o.id, o.estado));
        this.ordenes.set(os);
        this.cargando.set(false);
      },
      error: () => { if (inicial) this.cargando.set(false); }
    });
  }

  entregar(orden: Orden) {
    const nuevoEstado: OrdenEstado = orden.tipo === 'DELIVERY' ? 'EN_CAMINO' : 'ENTREGADO';
    this.ordenSvc.actualizarEstado(orden.id, nuevoEstado).subscribe({
      next: updated => {
        this.ordenes.update(os => os.map(o => o.id === updated.id ? updated : o));
        this.snackBar.open(`Pedido #${orden.id} → ${nuevoEstado === 'EN_CAMINO' ? 'en camino' : 'entregado'}`, 'OK', { duration: 3000 });
      },
      error: () => this.snackBar.open('Error al actualizar estado', 'OK', { duration: 3000 })
    });
  }

  labelTipo(o: Orden): string {
    if (o.mesaNumero) return `Mesa ${o.mesaNumero}`;
    return o.tipo === 'DELIVERY' ? '🚚 Delivery' : '🏠 Recojo';
  }
}

export { PanelMozoComponent as PanelMozo };
