import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { OrdenService } from '../../../core/services/orden';
import { CarritoItem, OrdenTipo } from '../../../core/models/orden.models';

@Component({
  selector: 'app-crear-pedido',
  standalone: true,
  imports: [
    CommonModule, RouterModule, ReactiveFormsModule,
    MatCardModule, MatButtonModule, MatRadioModule,
    MatInputModule, MatFormFieldModule, MatIconModule,
    MatDividerModule, MatListModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="pedido-container">

      <!-- Sin items -->
      <mat-card *ngIf="carrito().length === 0" class="empty-card">
        <mat-card-content>
          <mat-icon>remove_shopping_cart</mat-icon>
          <p>Tu carrito está vacío</p>
          <button mat-raised-button color="primary" routerLink="/carta">Ver la carta</button>
        </mat-card-content>
      </mat-card>

      <!-- Formulario de pedido -->
      <form *ngIf="carrito().length > 0" [formGroup]="form" (ngSubmit)="confirmar()">

        <!-- Resumen del carrito -->
        <mat-card class="seccion">
          <mat-card-header>
            <mat-icon mat-card-avatar>shopping_cart</mat-icon>
            <mat-card-title>Tu pedido</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <mat-list>
              <mat-list-item *ngFor="let item of carrito()">
                <span matListItemTitle>{{ item.producto.nombre }}</span>
                <span matListItemLine>x{{ item.cantidad }} — S/ {{ (item.producto.precio * item.cantidad) | number:'1.2-2' }}</span>
              </mat-list-item>
            </mat-list>
            <mat-divider></mat-divider>
            <p class="total"><strong>Total: S/ {{ total() | number:'1.2-2' }}</strong></p>
          </mat-card-content>
        </mat-card>

        <!-- Tipo de pedido -->
        <mat-card class="seccion">
          <mat-card-header>
            <mat-icon mat-card-avatar>local_shipping</mat-icon>
            <mat-card-title>Tipo de entrega</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <mat-radio-group formControlName="tipo" class="tipo-group">
              <mat-radio-button value="DELIVERY">
                <mat-icon>delivery_dining</mat-icon> Delivery
              </mat-radio-button>
              <mat-radio-button value="RECOJO">
                <mat-icon>store</mat-icon> Recojo en tienda
              </mat-radio-button>
            </mat-radio-group>
          </mat-card-content>
        </mat-card>

        <!-- Datos de delivery -->
        <mat-card class="seccion" *ngIf="form.value.tipo === 'DELIVERY'">
          <mat-card-header>
            <mat-icon mat-card-avatar>place</mat-icon>
            <mat-card-title>Dirección de entrega</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <mat-form-field appearance="outline" style="width:100%">
              <mat-label>Dirección</mat-label>
              <input matInput formControlName="direccionEntrega" placeholder="Av. Los Pinos 123, Miraflores">
            </mat-form-field>
            <mat-form-field appearance="outline" style="width:100%">
              <mat-label>Referencia</mat-label>
              <input matInput formControlName="referencia" placeholder="Cerca al parque, portón azul">
            </mat-form-field>
          </mat-card-content>
        </mat-card>

        <!-- Observaciones -->
        <mat-card class="seccion">
          <mat-card-content>
            <mat-form-field appearance="outline" style="width:100%">
              <mat-label>Observaciones (opcional)</mat-label>
              <textarea matInput formControlName="observaciones" rows="2"
                        placeholder="Sin cebolla, extra limón..."></textarea>
            </mat-form-field>
          </mat-card-content>
        </mat-card>

        <!-- Botón -->
        <button mat-raised-button color="primary" type="submit"
                [disabled]="form.invalid || cargando()" style="width:100%;padding:14px">
          <mat-spinner *ngIf="cargando()" diameter="20" style="display:inline-block;margin-right:8px"></mat-spinner>
          Continuar al pago
        </button>

        <p *ngIf="error()" class="error-msg">{{ error() }}</p>
      </form>

    </div>
  `,
  styles: [`
    .pedido-container { max-width: 600px; margin: 32px auto; padding: 0 16px; display: flex; flex-direction: column; gap: 16px; }
    .empty-card mat-card-content { text-align: center; padding: 40px; }
    .empty-card mat-icon { font-size: 64px; width: 64px; height: 64px; color: #9e9e9e; }
    .seccion { margin-bottom: 0; }
    .tipo-group { display: flex; gap: 24px; flex-wrap: wrap; margin-top: 8px; }
    .total { text-align: right; font-size: 1.1em; margin-top: 8px; }
    .error-msg { color: red; text-align: center; }
  `]
})
export class CrearPedidoComponent implements OnInit {

  private router  = inject(Router);
  private fb      = inject(FormBuilder);
  private ordenSvc = inject(OrdenService);

  carrito  = signal<CarritoItem[]>([]);
  cargando = signal(false);
  error    = signal<string | null>(null);

  total = computed(() =>
    this.carrito().reduce((s, i) => s + i.producto.precio * i.cantidad, 0)
  );

  form!: FormGroup;

  ngOnInit() {
    const state = this.router.getCurrentNavigation()?.extras.state
               ?? history.state;
    this.carrito.set(state?.['carrito'] ?? []);

    this.form = this.fb.group({
      tipo:             ['DELIVERY', Validators.required],
      direccionEntrega: [''],
      referencia:       [''],
      observaciones:    [''],
    });
  }

  confirmar() {
    if (this.form.invalid || this.carrito().length === 0) return;
    this.cargando.set(true);
    this.error.set(null);

    const v = this.form.value;
    this.ordenSvc.crear({
      tipo:             v.tipo as OrdenTipo,
      direccionEntrega: v.tipo === 'DELIVERY' ? v.direccionEntrega : undefined,
      referencia:       v.tipo === 'DELIVERY' ? v.referencia : undefined,
      observaciones:    v.observaciones || undefined,
      items: this.carrito().map(i => ({
        productoId: i.producto.id,
        cantidad:   i.cantidad,
        notas:      i.notas,
      })),
    }).subscribe({
      next: orden => {
        this.cargando.set(false);
        this.router.navigate(['/pago', orden.id]);
      },
      error: err => {
        this.error.set(err.error?.detail ?? 'Error al crear el pedido');
        this.cargando.set(false);
      },
    });
  }
}

export { CrearPedidoComponent as CrearPedido };
