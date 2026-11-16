import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../core/services/auth.service';
import { FinanceService } from '../../../../core/services/finance.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { TipoMovimiento } from '../../../../core/models/finance.model';
import { mensajeError } from '../../../../core/utils/api-error';
import { CashHeaderComponent } from '../../components/finanzas/cash-header.component';
import { CashSummaryComponent } from '../../components/finanzas/cash-summary.component';
import { CashMovementsTableComponent } from '../../components/finanzas/cash-movements-table.component';
import { CashOpenModalComponent } from '../../components/finanzas/cash-open-modal.component';
import { CashCloseModalComponent } from '../../components/finanzas/cash-close-modal.component';
import { CashMovementModalComponent } from '../../components/finanzas/cash-movement-modal.component';
import { CajeroCobroRepartidorModalComponent } from '../../../cajero/components/cajero-cobro-repartidor-modal.component';
import { RepartidoresService } from '../../../../core/services/repartidores.service';

/** Contenedor (smart) de la pestaña FINANZAS & CAJA: turno, arqueo y caja menor. */
@Component({
  selector: 'app-admin-finanzas-page',
  standalone: true,
  imports: [
    CommonModule,
    CashHeaderComponent,
    CashSummaryComponent,
    CashMovementsTableComponent,
    CashOpenModalComponent,
    CashCloseModalComponent,
    CashMovementModalComponent,
    CajeroCobroRepartidorModalComponent
  ],
  host: { class: 'contents' },
  template: `
    <main class="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
      <app-cash-header
        [cajaActual]="financeService.cajaActual()"
        (cobroRepartidorRequested)="abrirCobroRepartidor()"
        (movementRequested)="showMovimientoCajaModal = true"
        (closeRequested)="abrirModalCierreCaja()"
        (openRequested)="showAbrirCajaModal = true"
      />

      <app-cash-summary
        [cajaActual]="financeService.cajaActual()"
        [balanceDiario]="financeService.balanceDiario()"
        [userName]="authService.currentUser()?.nombre"
      />

      <app-cash-movements-table [movimientos]="financeService.movimientos()" />
    </main>

    <!-- Modal: cobrar efectivo a motorizado -->
    @if (showCobroRepartidorModal) {
      <app-cajero-cobro-repartidor-modal
        [repartidores]="repartidoresService.repartidores()"
        [(repartidorId)]="repartidorIdSeleccionado"
        (cancelar)="showCobroRepartidorModal = false"
        (cobroExitoso)="showCobroRepartidorModal = false; financeService.cargarCajaActual(); financeService.cargarMovimientos()"
      />
    }

    <!-- Modal: abrir caja -->
    @if (showAbrirCajaModal) {
      <app-cash-open-modal
        [initialAmount]="montoApertura"
        [procesando]="procesando"
        (closed)="showAbrirCajaModal = false"
        (confirmed)="montoApertura = $event; confirmarAperturaCaja()"
      />
    }

    <!-- Modal: arqueo y cierre de caja -->
    @if (showCerrarCajaModal) {
      <app-cash-close-modal
        [cajaActual]="financeService.cajaActual()"
        [initial]="{ efectivoReal: cierreEfectivoReal, observaciones: cierreObservaciones }"
        [errorMessage]="cierreError"
        [procesando]="procesando"
        (closed)="showCerrarCajaModal = false"
        (confirmed)="cierreEfectivoReal = $event.efectivoReal; cierreObservaciones = $event.observaciones; confirmarCierreCaja()"
      />
    }

    <!-- Modal: movimiento de caja menor -->
    @if (showMovimientoCajaModal) {
      <app-cash-movement-modal
        [initial]="movimientoForm"
        [procesando]="procesando"
        (closed)="showMovimientoCajaModal = false"
        (confirmed)="movimientoForm = $event; confirmarMovimientoCaja()"
      />
    }
  `
})
export class AdminFinanzasPage implements OnInit {
  readonly authService = inject(AuthService);
  readonly financeService = inject(FinanceService);
  readonly repartidoresService = inject(RepartidoresService);
  readonly notify = inject(NotificationService);

  ngOnInit(): void {
    this.financeService.cargarCajaActual();
    this.financeService.cargarBalanceDiario();
    this.financeService.cargarMovimientos();
  }

  showCobroRepartidorModal = false;
  repartidorIdSeleccionado: number | null = null;

  abrirCobroRepartidor(repartidorId?: number): void {
    this.repartidorIdSeleccionado = repartidorId ?? null;
    this.repartidoresService.cargar();
    this.showCobroRepartidorModal = true;
  }

  // Modal de Apertura de Caja (Fase 6)
  showAbrirCajaModal = false;
  montoApertura = 200.00;

  // Modal de Cierre / Arqueo de Caja (Fase 6)
  showCerrarCajaModal = false;
  /** Blind count (D3.12): starts empty, never pre-filled with the expected cash. */
  cierreEfectivoReal: number | null = null;
  cierreObservaciones = '';
  /** Backend message of the last failed close, shown inside the modal. */
  cierreError: string | null = null;

  // Modal de Movimiento de Caja Menor (Fase 6)
  showMovimientoCajaModal = false;
  procesando = false;
  movimientoForm = {
    tipo: 'EGRESO' as TipoMovimiento,
    concepto: '',
    monto: 0
  };

  confirmarAperturaCaja(): void {
    const monto = Number(this.montoApertura);
    if (!Number.isFinite(monto) || monto < 0) {
      this.notify.showWarning('Ingresa un monto inicial válido mayor o igual a 0');
      return;
    }
    if (this.procesando) return;
    this.procesando = true;
    this.financeService.abrirCaja(monto).subscribe({
      next: () => {
        this.procesando = false;
        this.notify.showSuccess(`Caja de turno abierta con S/. ${monto.toFixed(2)}`);
        this.showAbrirCajaModal = false;
      },
      error: (err: unknown) => {
        this.procesando = false;
        this.notify.showError(mensajeError(err, 'No se pudo abrir la caja del turno'));
      }
    });
  }

  abrirModalCierreCaja(): void {
    this.cierreEfectivoReal = null;
    this.cierreObservaciones = '';
    this.cierreError = null;
    this.showCerrarCajaModal = true;
  }

  confirmarCierreCaja(): void {
    if (
      this.cierreEfectivoReal === null ||
      !Number.isFinite(this.cierreEfectivoReal) ||
      this.cierreEfectivoReal < 0 ||
      this.procesando
    ) {
      return;
    }
    this.cierreError = null;
    this.procesando = true;
    this.financeService.cerrarCaja(this.cierreEfectivoReal, this.cierreObservaciones).subscribe({
      next: (cierre) => {
        this.procesando = false;
        const disc = cierre.discrepancia || 0;
        if (Math.abs(disc) > 0.01) {
          this.notify.showWarning(`Caja cerrada con descuadre de S/. ${disc.toFixed(2)}`);
        } else {
          this.notify.showSuccess('Arqueo de caja cuadrado a la perfección');
        }
        this.showCerrarCajaModal = false;
        this.financeService.cargarBalanceDiario();
        this.financeService.cargarCajaActual();
        this.financeService.cargarMovimientos();
      },
      error: (err: unknown) => {
        this.procesando = false;
        // Keep the modal open so the admin can recount or add the reason (400 without observaciones).
        this.cierreError = mensajeError(err, 'No se pudo cerrar la caja del turno');
        this.notify.showError(this.cierreError);
      }
    });
  }

  confirmarMovimientoCaja(): void {
    const monto = Number(this.movimientoForm.monto);
    if (!this.movimientoForm.concepto.trim() || !Number.isFinite(monto) || monto <= 0) {
      this.notify.showWarning('Ingresa concepto y monto válido');
      return;
    }
    if (this.procesando) return;
    this.procesando = true;
    this.financeService.registrarMovimiento({
      tipo: this.movimientoForm.tipo,
      concepto: this.movimientoForm.concepto.trim(),
      monto
    }).subscribe({
      next: () => {
        this.procesando = false;
        this.notify.showSuccess(`Movimiento de S/. ${monto.toFixed(2)} registrado en caja menor`);
        this.showMovimientoCajaModal = false;
        this.movimientoForm.concepto = '';
        this.movimientoForm.monto = 0;
      },
      error: (err: unknown) => {
        this.procesando = false;
        this.notify.showError(mensajeError(err, 'No se pudo registrar el movimiento de caja chica'));
      }
    });
  }
}
