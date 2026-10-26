import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../core/services/auth.service';
import { FinanceService } from '../../../../core/services/finance.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { TipoMovimiento } from '../../../../core/models/finance.model';
import { CashHeaderComponent } from '../../components/finanzas/cash-header.component';
import { CashSummaryComponent } from '../../components/finanzas/cash-summary.component';
import { CashMovementsTableComponent } from '../../components/finanzas/cash-movements-table.component';
import { CashOpenModalComponent } from '../../components/finanzas/cash-open-modal.component';
import { CashCloseModalComponent } from '../../components/finanzas/cash-close-modal.component';
import { CashMovementModalComponent } from '../../components/finanzas/cash-movement-modal.component';

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
    CashMovementModalComponent
  ],
  host: { class: 'contents' },
  template: `
    <main class="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
      <app-cash-header
        [cajaActual]="financeService.cajaActual()"
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

    <!-- Modal: abrir caja -->
    @if (showAbrirCajaModal) {
      <app-cash-open-modal
        [initialAmount]="montoApertura"
        (closed)="showAbrirCajaModal = false"
        (confirmed)="montoApertura = $event; confirmarAperturaCaja()"
      />
    }

    <!-- Modal: arqueo y cierre de caja -->
    @if (showCerrarCajaModal) {
      <app-cash-close-modal
        [cajaActual]="financeService.cajaActual()"
        [initial]="{ efectivoReal: cierreEfectivoReal, observaciones: cierreObservaciones }"
        (closed)="showCerrarCajaModal = false"
        (confirmed)="cierreEfectivoReal = $event.efectivoReal; cierreObservaciones = $event.observaciones; confirmarCierreCaja()"
      />
    }

    <!-- Modal: movimiento de caja menor -->
    @if (showMovimientoCajaModal) {
      <app-cash-movement-modal
        [initial]="movimientoForm"
        (closed)="showMovimientoCajaModal = false"
        (confirmed)="movimientoForm = $event; confirmarMovimientoCaja()"
      />
    }
  `
})
export class AdminFinanzasPage implements OnInit {
  readonly authService = inject(AuthService);
  readonly financeService = inject(FinanceService);
  readonly notify = inject(NotificationService);

  ngOnInit(): void {
    this.financeService.cargarCajaActual();
    this.financeService.cargarBalanceDiario();
    this.financeService.cargarMovimientos();
  }

  // Modal de Apertura de Caja (Fase 6)
  showAbrirCajaModal = false;
  montoApertura = 200.00;

  // Modal de Cierre / Arqueo de Caja (Fase 6)
  showCerrarCajaModal = false;
  cierreEfectivoReal = 0;
  cierreObservaciones = '';

  // Modal de Movimiento de Caja Menor (Fase 6)
  showMovimientoCajaModal = false;
  movimientoForm = {
    tipo: 'EGRESO' as TipoMovimiento,
    concepto: '',
    monto: 0
  };

  confirmarAperturaCaja(): void {
    this.financeService.abrirCaja(this.montoApertura).subscribe({
      next: () => {
        this.notify.showSuccess(`Caja de turno abierta con S/. ${this.montoApertura.toFixed(2)}`);
        this.showAbrirCajaModal = false;
      },
      error: () => {
        this.notify.showError('No se pudo abrir la caja del turno');
      }
    });
  }

  abrirModalCierreCaja(): void {
    const caja = this.financeService.cajaActual();
    const esperado = (caja?.montoInicial || 0) + (caja?.ventasEfectivo || 0);
    this.cierreEfectivoReal = esperado;
    this.cierreObservaciones = 'Cierre de turno regular sin novedades';
    this.showCerrarCajaModal = true;
  }

  confirmarCierreCaja(): void {
    this.financeService.cerrarCaja(this.cierreEfectivoReal, this.cierreObservaciones).subscribe({
      next: (cierre) => {
        const disc = cierre.discrepancia || 0;
        if (Math.abs(disc) > 0.01) {
          this.notify.showWarning(`Caja cerrada con descuadre de S/. ${disc.toFixed(2)}`);
        } else {
          this.notify.showSuccess('Arqueo de caja cuadrado a la perfección');
        }
        this.showCerrarCajaModal = false;
      },
      error: () => {
        this.notify.showError('No se pudo cerrar la caja del turno');
      }
    });
  }

  confirmarMovimientoCaja(): void {
    if (!this.movimientoForm.concepto.trim() || this.movimientoForm.monto <= 0) {
      this.notify.showWarning('Ingresa concepto y monto válido');
      return;
    }
    this.financeService.registrarMovimiento({
      tipo: this.movimientoForm.tipo,
      concepto: this.movimientoForm.concepto,
      monto: Number(this.movimientoForm.monto)
    }).subscribe({
      next: () => {
        this.notify.showSuccess(`Movimiento de S/. ${this.movimientoForm.monto.toFixed(2)} registrado en caja menor`);
        this.showMovimientoCajaModal = false;
        this.movimientoForm.concepto = '';
        this.movimientoForm.monto = 0;
      },
      error: () => {
        this.notify.showError('No se pudo registrar el movimiento de caja chica');
      }
    });
  }
}
