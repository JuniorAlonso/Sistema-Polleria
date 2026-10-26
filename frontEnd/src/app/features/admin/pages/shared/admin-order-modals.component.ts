import { Component, inject } from '@angular/core';
import { ProductsService } from '../../../../core/services/products.service';
import { SalonService } from '../../../../core/services/salon.service';
import { RepartidoresService } from '../../../../core/services/repartidores.service';
import { AdminShellStore } from '../../state/admin-shell.store';
import { AssignDeliveryModalComponent } from '../../components/shared/assign-delivery-modal.component';
import { ManualOrderModalComponent } from '../../components/shared/manual-order-modal.component';

/**
 * Contenedor (smart) de los modales que abren varias pestañas: asignación de motorizado (Órdenes y
 * Reparto) y orden manual / segunda ronda de salón (Órdenes y Mesas). Su estado vive en `AdminShellStore`.
 */
@Component({
  selector: 'app-admin-order-modals',
  standalone: true,
  imports: [AssignDeliveryModalComponent, ManualOrderModalComponent],
  template: `
    @if (store.orderToAssignDelivery(); as order) {
      <app-assign-delivery-modal
        [order]="order"
        [isPaid]="store.estaOrdenPagada(order)"
        [repartidores]="repartidoresService.repartidores()"
        [rosterLoading]="repartidoresService.isLoading()"
        [rosterError]="repartidoresService.hasError()"
        [selectedRepartidorId]="store.selectedRepartidorId"
        [dispatching]="store.isDispatchingDelivery()"
        [canConfirm]="store.puedeConfirmarDespacho()"
        (repartidorSelected)="store.selectedRepartidorId = $event"
        (closed)="store.cerrarModalAsignarMotorizado()"
        (confirmed)="store.confirmarAsignacionYDespacho()"
      />
    }

    @if (store.showCreateOrderModal) {
      <app-manual-order-modal
        [initial]="store.manualOrder"
        [mesas]="salonService.mesas()"
        [products]="productsService.products()"
        (closed)="store.showCreateOrderModal = false"
        (confirmed)="store.manualOrder = $event; store.crearOrdenManual()"
      />
    }
  `
})
export class AdminOrderModalsComponent {
  readonly store = inject(AdminShellStore);
  readonly repartidoresService = inject(RepartidoresService);
  readonly salonService = inject(SalonService);
  readonly productsService = inject(ProductsService);
}
