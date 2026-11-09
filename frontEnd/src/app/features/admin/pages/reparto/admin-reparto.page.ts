import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { OrdersService } from '../../../../core/services/orders.service';
import { RepartidoresService } from '../../../../core/services/repartidores.service';
import { AdminShellStore } from '../../state/admin-shell.store';
import { GhostOrdersListComponent } from '../../components/reparto/ghost-orders-list.component';
import { DeliveryOrdersTableComponent } from '../../components/reparto/delivery-orders-table.component';
import { CajeroCobroRepartidorModalComponent } from '../../../cajero/components/cajero-cobro-repartidor-modal.component';

/** Contenedor (smart) de la pestaña REPARTO & DELIVERY (RF18): pedidos de delivery y despacho. */
@Component({
  selector: 'app-admin-reparto-page',
  standalone: true,
  imports: [CommonModule, DeliveryOrdersTableComponent, GhostOrdersListComponent, CajeroCobroRepartidorModalComponent],
  host: { class: 'contents' },
  template: `
    <main class="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
      <app-delivery-orders-table
        [pedidos]="pedidosDeliveryEnCurso()"
        [motorizadoNames]="store.nombresMotorizado()"
        (refreshRequested)="ordersService.loadActiveOrders()"
        (cobroRequested)="abrirCobro()"
        (assignRequested)="store.abrirModalAsignarMotorizado($event)"
      />

      <app-ghost-orders-list [pedidos]="pedidosFantasma()" />
    </main>

    @if (mostrarModalCobro()) {
      <app-cajero-cobro-repartidor-modal
        [repartidores]="repartidoresService.repartidores()"
        [(repartidorId)]="repartidorIdSeleccionado"
        (cancelar)="mostrarModalCobro.set(false)"
        (cobroExitoso)="mostrarModalCobro.set(false); ordersService.loadActiveOrders()"
      />
    }
  `
})
export class AdminRepartoPage implements OnInit {
  readonly ordersService = inject(OrdersService);
  readonly repartidoresService = inject(RepartidoresService);
  readonly store = inject(AdminShellStore);
  private platformId = inject(PLATFORM_ID);

  readonly mostrarModalCobro = signal<boolean>(false);
  repartidorIdSeleccionado: number | null = null;

  abrirCobro(repartidorId?: number): void {
    this.repartidorIdSeleccionado = repartidorId ?? null;
    this.repartidoresService.cargar();
    this.mostrarModalCobro.set(true);
  }

  /**
   * El roster de motorizados se pide al abrir la pestaña de reparto, no en el constructor:
   * el endpoint exige rol ADMIN y `/admin` también es accesible para MOZO, COCINA y REPARTIDOR.
   */
  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.repartidoresService.cargar();
    }
  }

  // Reparto (RF18): los pedidos y el repartidor salen del backend, sin roster local.
  readonly pedidosDeliveryEnCurso = computed(() =>
    this.ordersService.orders().filter(o =>
      o.tipo === 'DELIVERY' && !['COMPLETADO', 'CANCELADO', 'PEDIDO_FANTASMA'].includes(o.estado))
  );

  readonly pedidosFantasma = computed(() =>
    this.ordersService.orders().filter(o => o.tipo === 'DELIVERY' && o.estado === 'PEDIDO_FANTASMA')
  );
}
