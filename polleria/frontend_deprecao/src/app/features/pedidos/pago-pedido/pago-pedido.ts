import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';

import { PagoService } from '../../../core/services/pago';
import { OrdenService } from '../../../core/services/orden';
import { MetodoPago, Pago, Orden } from '../../../core/models/orden.models';

@Component({
  selector: 'app-pago-pedido',
  standalone: true,
  imports: [
    CommonModule, RouterModule, ReactiveFormsModule,
    MatCardModule, MatButtonModule, MatRadioModule,
    MatInputModule, MatFormFieldModule, MatIconModule,
    MatProgressSpinnerModule, MatDividerModule,
  ],
  template: `
    <div class="pago-container">
      <mat-card>
        <mat-card-header>
          <mat-icon mat-card-avatar>payment</mat-icon>
          <mat-card-title>Pagar Pedido #{{ ordenId() }}</mat-card-title>
          <mat-card-subtitle *ngIf="orden()">Total: S/ {{ orden()!.total | number:'1.2-2' }}</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>

          <!-- Estado final -->
          <div *ngIf="pago()" class="resultado">
            <mat-icon [class]="pago()!.estado === 'APROBADO' ? 'success' : pago()!.estado === 'PENDIENTE' ? 'warning' : 'error'">
              {{ pago()!.estado === 'APROBADO' ? 'check_circle' : pago()!.estado === 'PENDIENTE' ? 'schedule' : 'cancel' }}
            </mat-icon>
            <h2>{{ etiquetaEstado(pago()!.estado) }}</h2>
            <p>{{ pago()!.detalle }}</p>
            <p *ngIf="pago()!.referenciaExterna" class="ref">Ref: {{ pago()!.referenciaExterna }}</p>
            <button mat-raised-button color="primary" routerLink="/mis-pedidos">Ver mis pedidos</button>
          </div>

          <!-- Formulario de pago -->
          <form *ngIf="!pago()" [formGroup]="form" (ngSubmit)="pagar()">

            <h3>Método de pago</h3>
            <mat-radio-group formControlName="metodoPago" class="metodos">
              <mat-radio-button value="CONTRAENTREGA">
                <mat-icon>local_shipping</mat-icon> Contraentrega
              </mat-radio-button>
              <mat-radio-button value="TARJETA">
                <mat-icon>credit_card</mat-icon> Tarjeta de crédito/débito
              </mat-radio-button>
              <mat-radio-button value="YAPE_PLIN">
                <mat-icon>smartphone</mat-icon> Yape / Plin
              </mat-radio-button>
            </mat-radio-group>

            <!-- Tarjeta -->
            <div *ngIf="form.value.metodoPago === 'TARJETA'" class="extra-field">
              <mat-form-field appearance="outline" style="width:100%">
                <mat-label>Token de tarjeta (generado por el SDK)</mat-label>
                <input matInput formControlName="tokenPasarela" placeholder="tkn_live_...">
                <mat-hint>En producción este campo es generado automáticamente por el SDK de la pasarela</mat-hint>
              </mat-form-field>
            </div>

            <!-- Yape/Plin -->
            <div *ngIf="form.value.metodoPago === 'YAPE_PLIN'" class="extra-field">
              <mat-form-field appearance="outline" style="width:100%">
                <mat-label>Número de teléfono Yape/Plin</mat-label>
                <input matInput formControlName="telefonoYape" placeholder="9XXXXXXXX">
              </mat-form-field>
            </div>

            <mat-divider style="margin: 16px 0"></mat-divider>

            <button mat-raised-button color="primary" type="submit"
                    [disabled]="form.invalid || cargando()">
              <mat-spinner *ngIf="cargando()" diameter="20" style="display:inline-block; margin-right:8px"></mat-spinner>
              Confirmar pago
            </button>
          </form>

          <!-- Error -->
          <p *ngIf="error()" class="error-msg">{{ error() }}</p>

        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .pago-container { max-width: 500px; margin: 40px auto; padding: 0 16px; }
    .metodos { display: flex; flex-direction: column; gap: 12px; margin: 16px 0; }
    .metodos mat-radio-button { display: flex; align-items: center; gap: 8px; }
    .extra-field { margin-top: 12px; }
    .resultado { text-align: center; padding: 24px; }
    .resultado mat-icon { font-size: 64px; width: 64px; height: 64px; }
    .success { color: #4caf50; }
    .warning { color: #ff9800; }
    .error   { color: #f44336; }
    .ref { color: #666; font-size: 0.85em; }
    .error-msg { color: red; margin-top: 12px; }
  `]
})
export class PagoPedidoComponent implements OnInit {

  private route   = inject(ActivatedRoute);
  private router  = inject(Router);
  private fb      = inject(FormBuilder);
  private pagoSvc = inject(PagoService);
  private ordenSvc = inject(OrdenService);

  ordenId  = signal<number>(0);
  orden    = signal<Orden | null>(null);
  pago     = signal<Pago | null>(null);
  cargando = signal(false);
  error    = signal<string | null>(null);

  form!: FormGroup;

  ngOnInit() {
    this.ordenId.set(Number(this.route.snapshot.paramMap.get('id')));
    this.form = this.fb.group({
      metodoPago:    ['CONTRAENTREGA', Validators.required],
      tokenPasarela: [''],
      telefonoYape:  [''],
    });
    this.ordenSvc.obtener(this.ordenId()).subscribe({
      next: o => this.orden.set(o),
      error: () => this.error.set('No se pudo cargar la orden'),
    });
  }

  pagar() {
    if (this.form.invalid || !this.orden()) return;
    this.cargando.set(true);
    this.error.set(null);

    const v = this.form.value;
    this.pagoSvc.iniciar({
      ordenId:       this.ordenId(),
      monto:         this.orden()!.total,
      metodoPago:    v.metodoPago as MetodoPago,
      tokenPasarela: v.metodoPago === 'TARJETA' ? v.tokenPasarela : undefined,
      telefonoYape:  v.metodoPago === 'YAPE_PLIN' ? v.telefonoYape : undefined,
    }).subscribe({
      next:  p  => { this.pago.set(p); this.cargando.set(false); },
      error: err => {
        this.error.set(err.error?.detail ?? 'Error al procesar el pago');
        this.cargando.set(false);
      },
    });
  }

  etiquetaEstado(estado: string): string {
    const mapa: Record<string, string> = {
      APROBADO:   'Pago aprobado',
      PENDIENTE:  'Pago pendiente de confirmación',
      RECHAZADO:  'Pago rechazado',
      CANCELADO:  'Pago cancelado',
    };
    return mapa[estado] ?? estado;
  }
}
