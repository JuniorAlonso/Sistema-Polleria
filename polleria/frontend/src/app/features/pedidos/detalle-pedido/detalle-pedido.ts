import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { OrdenService } from '../../../core/services/orden';
import { PagoService } from '../../../core/services/pago';
import { Orden, Pago } from '../../../core/models/orden.models';

@Component({
  selector: 'app-detalle-pedido',
  standalone: true,
  imports: [
    CommonModule, RouterModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatChipsModule, MatDividerModule, MatListModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="container" *ngIf="!cargando(); else loading">

      <button mat-button routerLink="/mis-pedidos" class="back-btn">
        <mat-icon>arrow_back</mat-icon> Mis pedidos
      </button>

      <mat-card *ngIf="orden()">
        <mat-card-header>
          <mat-icon mat-card-avatar>{{ iconoTipo(orden()!.tipo) }}</mat-icon>
          <mat-card-title>Pedido #{{ orden()!.id }}</mat-card-title>
          <mat-card-subtitle>{{ orden()!.creadoEn | date:'dd/MM/yyyy HH:mm' }}</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>

          <!-- Estado -->
          <div class="estado-row">
            <mat-chip [class]="'chip-' + orden()!.estado.toLowerCase()">
              {{ labelEstado(orden()!.estado) }}
            </mat-chip>
            <span class="tipo-label">{{ labelTipo(orden()!.tipo) }}</span>
          </div>

          <!-- Dirección (delivery) -->
          <div *ngIf="orden()!.direccionEntrega" class="info-row">
            <mat-icon>place</mat-icon>
            <span>{{ orden()!.direccionEntrega }}</span>
          </div>

          <!-- Observaciones -->
          <div *ngIf="orden()!.observaciones" class="info-row">
            <mat-icon>notes</mat-icon>
            <span>{{ orden()!.observaciones }}</span>
          </div>

          <mat-divider style="margin: 16px 0"></mat-divider>

          <!-- Items -->
          <h3 class="section-title">Productos</h3>
          <mat-list>
            <mat-list-item *ngFor="let item of orden()!.items">
              <span matListItemTitle>{{ item.productoNombre }}</span>
              <span matListItemLine>
                x{{ item.cantidad }} × S/ {{ item.precioUnitario | number:'1.2-2' }}
                = S/ {{ item.subtotal | number:'1.2-2' }}
              </span>
              <span matListItemLine *ngIf="item.notas" class="notas">{{ item.notas }}</span>
            </mat-list-item>
          </mat-list>

          <mat-divider style="margin: 16px 0"></mat-divider>
          <div class="total-row">
            <span>Total</span>
            <strong>S/ {{ orden()!.total | number:'1.2-2' }}</strong>
          </div>

          <!-- Pago -->
          <ng-container *ngIf="pago()">
            <mat-divider style="margin: 16px 0"></mat-divider>
            <h3 class="section-title">Pago</h3>
            <div class="pago-info">
              <div class="info-row">
                <mat-icon>payment</mat-icon>
                <span>{{ labelMetodo(pago()!.metodoPago) }}</span>
              </div>
              <div class="info-row">
                <mat-icon [style.color]="colorEstadoPago(pago()!.estado)">
                  {{ iconoPago(pago()!.estado) }}
                </mat-icon>
                <span>{{ labelEstadoPago(pago()!.estado) }}</span>
              </div>
              <div *ngIf="pago()!.referenciaExterna" class="info-row">
                <mat-icon>tag</mat-icon>
                <span>Ref: {{ pago()!.referenciaExterna }}</span>
              </div>
            </div>
          </ng-container>

          <!-- Botón pagar si no tiene pago aún -->
          <div *ngIf="!pago() && orden()!.tipo !== 'SALON'" style="margin-top: 16px">
            <button mat-raised-button color="primary" [routerLink]="['/pago', orden()!.id]">
              <mat-icon>payment</mat-icon> Ir a pagar
            </button>
          </div>

        </mat-card-content>
      </mat-card>

      <p *ngIf="error()" class="error">{{ error() }}</p>
    </div>

    <ng-template #loading>
      <div class="loading"><mat-spinner diameter="48"></mat-spinner></div>
    </ng-template>
  `,
  styles: [`
    .container { max-width: 640px; margin: 32px auto; padding: 0 16px; }
    .back-btn { margin-bottom: 16px; }
    .estado-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .tipo-label { font-size: 0.85rem; color: #666; }
    .info-row { display: flex; align-items: center; gap: 8px; margin: 6px 0; color: #444; }
    .section-title { font-size: 1rem; font-weight: 600; margin: 8px 0 0; }
    .notas { font-style: italic; color: #888; }
    .total-row { display: flex; justify-content: space-between; font-size: 1.1rem; padding: 0 16px; }
    .pago-info { padding: 0 4px; }
    .loading { display: flex; justify-content: center; padding: 80px; }
    .error { color: red; text-align: center; margin-top: 16px; }

    .chip-recibido      { background: #e3f2fd !important; color: #1565c0 !important; }
    .chip-en_preparacion{ background: #fff3e0 !important; color: #e65100 !important; }
    .chip-listo         { background: #e8f5e9 !important; color: #2e7d32 !important; }
    .chip-en_camino     { background: #f3e5f5 !important; color: #6a1b9a !important; }
    .chip-entregado     { background: #e8f5e9 !important; color: #1b5e20 !important; }
    .chip-cancelado     { background: #ffebee !important; color: #b71c1c !important; }
  `]
})
export class DetallePedidoComponent implements OnInit {

  private route    = inject(ActivatedRoute);
  private ordenSvc = inject(OrdenService);
  private pagoSvc  = inject(PagoService);

  orden    = signal<Orden | null>(null);
  pago     = signal<Pago | null>(null);
  cargando = signal(true);
  error    = signal<string | null>(null);

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.ordenSvc.obtener(id).subscribe({
      next: o => {
        this.orden.set(o);
        this.cargando.set(false);
        // intentar cargar el pago (puede no existir todavía)
        this.pagoSvc.porOrden(id).subscribe({
          next:  p => this.pago.set(p),
          error: () => { /* sin pago aún — normal */ },
        });
      },
      error: () => {
        this.error.set('No se pudo cargar el pedido');
        this.cargando.set(false);
      },
    });
  }

  iconoTipo(tipo: string)  { return tipo === 'DELIVERY' ? 'delivery_dining' : tipo === 'RECOJO' ? 'store' : 'table_restaurant'; }
  labelTipo(tipo: string)  { return ({ DELIVERY: 'Delivery', RECOJO: 'Recojo', SALON: 'Salón' } as any)[tipo] ?? tipo; }

  labelEstado(e: string)   {
    return ({ RECIBIDO:'Recibido', EN_PREPARACION:'En preparación', LISTO:'Listo',
              EN_CAMINO:'En camino', ENTREGADO:'Entregado', CANCELADO:'Cancelado' } as any)[e] ?? e;
  }

  labelMetodo(m: string)   {
    return ({ CONTRAENTREGA:'Contraentrega', TARJETA:'Tarjeta', YAPE_PLIN:'Yape/Plin' } as any)[m] ?? m;
  }

  labelEstadoPago(e: string) {
    return ({ PENDIENTE:'Pendiente', APROBADO:'Aprobado', RECHAZADO:'Rechazado', CANCELADO:'Cancelado' } as any)[e] ?? e;
  }

  iconoPago(e: string)  { return e === 'APROBADO' ? 'check_circle' : e === 'PENDIENTE' ? 'schedule' : 'cancel'; }
  colorEstadoPago(e: string) { return e === 'APROBADO' ? '#4caf50' : e === 'PENDIENTE' ? '#ff9800' : '#f44336'; }
}

export { DetallePedidoComponent as DetallePedido };
