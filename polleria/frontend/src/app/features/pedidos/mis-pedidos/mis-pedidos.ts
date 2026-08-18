import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';

import { OrdenService } from '../../../core/services/orden';
import { Orden } from '../../../core/models/orden.models';

@Component({
  selector: 'app-mis-pedidos',
  standalone: true,
  imports: [
    CommonModule, RouterModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatChipsModule, MatProgressSpinnerModule, MatDividerModule,
  ],
  template: `
    <div class="container">
      <h1 class="titulo">Mis Pedidos</h1>

      <div *ngIf="cargando()" class="loading">
        <mat-spinner diameter="48"></mat-spinner>
      </div>

      <div *ngIf="!cargando() && ordenes().length === 0" class="vacio">
        <mat-icon>receipt_long</mat-icon>
        <p>Aún no tienes pedidos</p>
        <button mat-raised-button color="primary" routerLink="/carta">Ver la carta</button>
      </div>

      <div class="lista" *ngIf="!cargando() && ordenes().length > 0">
        <mat-card *ngFor="let o of ordenes()" class="pedido-card" (click)="verDetalle(o.id)">
          <mat-card-header>
            <mat-icon mat-card-avatar>{{ iconoTipo(o.tipo) }}</mat-icon>
            <mat-card-title>Pedido #{{ o.id }}</mat-card-title>
            <mat-card-subtitle>{{ o.creadoEn | date:'dd/MM/yyyy HH:mm' }}</mat-card-subtitle>
          </mat-card-header>

          <mat-card-content>
            <div class="fila">
              <span class="tipo">{{ labelTipo(o.tipo) }}</span>
              <mat-chip [class]="'chip-' + o.estado.toLowerCase()">
                {{ labelEstado(o.estado) }}
              </mat-chip>
            </div>
            <p class="items-resumen">
              {{ o.items.length }} producto{{ o.items.length !== 1 ? 's' : '' }}
            </p>
            <p class="total">Total: <strong>S/ {{ o.total | number:'1.2-2' }}</strong></p>
          </mat-card-content>

          <mat-card-actions>
            <button mat-button color="primary" (click)="verDetalle(o.id); $event.stopPropagation()">
              <mat-icon>visibility</mat-icon> Ver detalle
            </button>
            <button mat-button color="accent"
                    *ngIf="o.tipo !== 'SALON' && o.estado === 'RECIBIDO'"
                    routerLink="/pago/{{ o.id }}"
                    (click)="$event.stopPropagation()">
              <mat-icon>payment</mat-icon> Pagar
            </button>
          </mat-card-actions>
        </mat-card>
      </div>

      <p *ngIf="error()" class="error">{{ error() }}</p>
    </div>
  `,
  styles: [`
    .container { max-width: 700px; margin: 32px auto; padding: 0 16px; }
    .titulo { font-size: 1.8rem; font-weight: 700; color: #e65100; margin-bottom: 24px; }
    .loading { display: flex; justify-content: center; padding: 48px; }
    .vacio { text-align: center; padding: 48px; color: #9e9e9e; }
    .vacio mat-icon { font-size: 64px; width: 64px; height: 64px; }
    .lista { display: flex; flex-direction: column; gap: 16px; }
    .pedido-card { cursor: pointer; transition: box-shadow 0.2s; }
    .pedido-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .fila { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .tipo { font-size: 0.85rem; color: #666; }
    .items-resumen { color: #555; margin: 4px 0; }
    .total { font-size: 1rem; margin: 4px 0; }
    .error { color: red; text-align: center; margin-top: 16px; }

    /* Colores por estado */
    .chip-recibido     { background: #e3f2fd !important; color: #1565c0 !important; }
    .chip-en_preparacion { background: #fff3e0 !important; color: #e65100 !important; }
    .chip-listo        { background: #e8f5e9 !important; color: #2e7d32 !important; }
    .chip-en_camino    { background: #f3e5f5 !important; color: #6a1b9a !important; }
    .chip-entregado    { background: #e8f5e9 !important; color: #1b5e20 !important; }
    .chip-cancelado    { background: #ffebee !important; color: #b71c1c !important; }
  `]
})
export class MisPedidosComponent implements OnInit {

  private ordenSvc = inject(OrdenService);
  private router   = inject(Router);

  ordenes  = signal<Orden[]>([]);
  cargando = signal(true);
  error    = signal<string | null>(null);

  ngOnInit() {
    this.ordenSvc.misOrdenes().subscribe({
      next: os => { this.ordenes.set(os); this.cargando.set(false); },
      error: () => {
        this.error.set('No se pudieron cargar tus pedidos');
        this.cargando.set(false);
      },
    });
  }

  verDetalle(id: number) {
    this.router.navigate(['/pedido', id]);
  }

  iconoTipo(tipo: string): string {
    return tipo === 'DELIVERY' ? 'delivery_dining' : tipo === 'RECOJO' ? 'store' : 'table_restaurant';
  }

  labelTipo(tipo: string): string {
    const m: Record<string, string> = { DELIVERY: 'Delivery', RECOJO: 'Recojo', SALON: 'Salón' };
    return m[tipo] ?? tipo;
  }

  labelEstado(estado: string): string {
    const m: Record<string, string> = {
      RECIBIDO: 'Recibido',
      EN_PREPARACION: 'En preparación',
      LISTO: 'Listo',
      EN_CAMINO: 'En camino',
      ENTREGADO: 'Entregado',
      CANCELADO: 'Cancelado',
    };
    return m[estado] ?? estado;
  }
}

export { MisPedidosComponent as MisPedidos };
