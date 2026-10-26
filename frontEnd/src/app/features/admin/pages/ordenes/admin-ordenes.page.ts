import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { tap, catchError, of } from 'rxjs';
import { OrdersService } from '../../../../core/services/orders.service';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PaymentService, PagoOrdenAdmin } from '../../../../core/services/payment.service';
import { Order, OrderStatus } from '../../../../core/models/order.model';
import { AdminShellStore } from '../../state/admin-shell.store';
import { OrderStateFilter } from '../../models/admin-forms';
import { getCodeNum } from '../../shared/admin-format.util';
import { OrdersFilterBarComponent } from '../../components/ordenes/orders-filter-bar.component';
import { OrdersNewColumnComponent } from '../../components/ordenes/orders-new-column.component';
import { OrdersPreparingColumnComponent } from '../../components/ordenes/orders-preparing-column.component';
import { OrdersDispatchedColumnComponent } from '../../components/ordenes/orders-dispatched-column.component';
import { OrdersCompletedColumnComponent } from '../../components/ordenes/orders-completed-column.component';
import { OrderDetailModalComponent } from '../../components/ordenes/order-detail-modal.component';

/**
 * Contenedor (smart) de la pestaña ÓRDENES: tablero Kanban en vivo. El admin conserva el flujo
 * principal de pedidos (aceptar, listo, despachar, entregar, cancelar) por si necesita intervenir.
 */
@Component({
  selector: 'app-admin-ordenes-page',
  standalone: true,
  imports: [
    CommonModule,
    OrdersFilterBarComponent,
    OrdersNewColumnComponent,
    OrdersPreparingColumnComponent,
    OrdersDispatchedColumnComponent,
    OrdersCompletedColumnComponent,
    OrderDetailModalComponent
  ],
  host: { class: 'contents' },
  template: `
    <main class="flex-1 p-4 sm:p-6 overflow-x-auto space-y-4">

          @if (ordersService.hasError()) {
            <div class="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3" role="alert">
              <span>Sin conexión con el servicio de pedidos. Los pedidos pueden estar desactualizados.</span>
              <button
                type="button"
                (click)="ordersService.loadActiveOrders()"
                class="px-2.5 py-1 rounded bg-rose-600/30 hover:bg-rose-600 text-white font-bold transition text-[11px] cursor-pointer shrink-0"
              >
                Reintentar
              </button>
            </div>
          }

      <app-orders-filter-bar
        [orderStateFilter]="orderStateFilter()"
        [totalCount]="ordersService.orders().length"
        [newCount]="getNewOrdersRawCount()"
        [preparingCount]="getPreparingOrdersRawCount()"
        [dispatchedCount]="getDispatchedOrdersRawCount()"
        [completedCount]="getCompletedOrdersRawCount()"
        (filterChange)="orderStateFilter.set($event)"
        (newOrder)="store.abrirModalNuevaOrden()"
      />

          <div [ngClass]="orderStateFilter() === 'TODAS' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 min-w-[960px] h-[calc(100vh-175px)]' : 'grid grid-cols-1 max-w-xl mx-auto w-full gap-4 h-[calc(100vh-175px)]'">
        @if (orderStateFilter() === 'TODAS' || orderStateFilter() === 'NUEVAS') {
          <app-orders-new-column
            [orders]="newOrders()"
            [paidIds]="store.idsOrdenesPagadas()"
            (orderSelected)="selectedOrderForModal.set($event)"
            (cancelled)="cancelarOrden($event)"
            (advance)="advanceOrderStatus($event.order, $event.status)"
          />
        }

        @if (orderStateFilter() === 'TODAS' || orderStateFilter() === 'PREPARANDOSE') {
          <app-orders-preparing-column
            [orders]="preparingOrders()"
            [paidIds]="store.idsOrdenesPagadas()"
            (orderSelected)="selectedOrderForModal.set($event)"
            (markReady)="marcarListo($event)"
            (advanceAfterReady)="advanceAfterReady($event)"
          />
        }

        @if (orderStateFilter() === 'TODAS' || orderStateFilter() === 'EN_CAMINO') {
          <app-orders-dispatched-column
            [orders]="dispatchedOrders()"
            [paidIds]="store.idsOrdenesPagadas()"
            [motorizadoNames]="store.nombresMotorizado()"
            (orderSelected)="selectedOrderForModal.set($event)"
            (advance)="advanceOrderStatus($event.order, $event.status)"
          />
        }

        @if (orderStateFilter() === 'TODAS' || orderStateFilter() === 'COMPLETADO') {
          <app-orders-completed-column
            [orders]="completedOrders()"
            (orderSelected)="selectedOrderForModal.set($event)"
          />
        }
      </div>
    </main>

    <!-- Modal: detalle de pedido (inspector de orden) -->
    @if (selectedOrderForModal(); as order) {
      <app-order-detail-modal
        [order]="order"
        [isAdmin]="authService.isAdmin()"
        [isPaid]="store.estaOrdenPagada(order)"
        [motorizadoName]="store.nombreMotorizado(order)"
        [comprobanteCargando]="comprobanteCargando()"
        [comprobantePendiente]="comprobantePendiente()"
        [motivoRechazo]="motivoRechazo()"
        [errorVerificacion]="errorVerificacion()"
        [verificandoComprobante]="verificandoComprobante()"
        [decisionVerificacion]="decisionVerificacion()"
        (closed)="selectedOrderForModal.set(null)"
        (cancelled)="cancelarOrden($event)"
        (advance)="advanceOrderStatus($event.order, $event.status)"
        (markReady)="marcarListo($event)"
        (advanceAfterReady)="advanceAfterReady($event)"
        (motivoRechazoChange)="motivoRechazo.set($event)"
        (approveProof)="aprobarComprobante()"
        (rejectProof)="rechazarComprobante()"
      />
    }
  `
})
export class AdminOrdenesPage {
  readonly ordersService = inject(OrdersService);
  readonly authService = inject(AuthService);
  readonly paymentService = inject(PaymentService);
  readonly notify = inject(NotificationService);
  readonly store = inject(AdminShellStore);

  readonly getCodeNum = getCodeNum;

  readonly orderStateFilter = signal<OrderStateFilter>('TODAS');
  readonly searchQuery = signal('');

  // Modal de Detalle de Orden (Inspector)
  readonly selectedOrderForModal = signal<Order | null>(null);

  // ── T6e (S6/S7) — verificación del comprobante de Yape, solo para ADMIN ──────────────
  /** Pago de la orden abierta en el detalle. Se pide al abrir el modal y NO se reusa su URL firmada. */
  readonly pagoDeOrden = signal<PagoOrdenAdmin | null>(null);
  readonly comprobanteCargando = signal<boolean>(false);
  readonly verificandoComprobante = signal<boolean>(false);
  readonly motivoRechazo = signal<string>('');
  readonly errorVerificacion = signal<string | null>(null);

  /** Resultado de la decisión que acaba de responder el backend (sin optimismo local). */
  readonly decisionVerificacion = signal<{ aprobado: boolean } | null>(null);

  /** Solo hay algo que verificar si el backend confirmó que está pendiente y mandó la URL firmada. */
  readonly comprobantePendiente = computed(() => {
    const pago = this.pagoDeOrden();
    return pago && pago.estado === 'PENDIENTE_VERIFICACION' && !!pago.comprobanteUrl ? pago : null;
  });

  /** Rechazar exige motivo: sin él el botón queda deshabilitado y se explica por qué. */
  readonly puedeRechazarComprobante = computed(() => this.motivoRechazo().trim().length > 0);

  /**
   * La URL firmada del comprobante vive 300 s, así que se pide al abrir el detalle y se descarta al
   * cerrarlo. El estado se reinicia con cada pedido: nada de reusar la imagen del anterior.
   */
  private readonly cargarComprobanteAlAbrirDetalle = effect(() => {
    const order = this.selectedOrderForModal();
    untracked(() => {
      this.pagoDeOrden.set(null);
      this.comprobanteCargando.set(false);
      this.errorVerificacion.set(null);
      this.motivoRechazo.set('');
      this.verificandoComprobante.set(false);
      this.decisionVerificacion.set(null);
      if (order && this.authService.isAdmin()) {
        this.cargarComprobanteDeOrden(order);
      }
    });
  });

  /** Pide el pago tal cual lo devuelve el backend. Un 404 (orden sin pago) deja todo en vacío. */
  private cargarComprobanteDeOrden(order: Order): void {
    // Solo el pedido abierto manda: una respuesta que llega tarde no pisa el detalle actual.
    const esElPedidoAbierto = () => String(this.selectedOrderForModal()?.id) === String(order.id);

    this.comprobanteCargando.set(true);
    this.paymentService.obtenerPagoParaVerificacion(order.id).pipe(
      tap(pago => {
        if (esElPedidoAbierto()) {
          this.pagoDeOrden.set(pago);
          this.comprobanteCargando.set(false);
        }
      }),
      catchError(() => {
        // Sin pago no hay comprobante que verificar: no se muestra nada ni se inventa un estado.
        if (esElPedidoAbierto()) {
          this.comprobanteCargando.set(false);
        }
        return of(null);
      })
    ).subscribe();
  }

  /** Aprueba el comprobante y refleja el estado que devuelve el backend. */
  aprobarComprobante(): void {
    this.decidirComprobante(true);
  }

  /** Rechaza el comprobante con el motivo escrito; sin motivo no se llama al backend. */
  rechazarComprobante(): void {
    this.decidirComprobante(false, this.motivoRechazo());
  }

  private decidirComprobante(aprobado: boolean, motivo?: string): void {
    const pago = this.comprobantePendiente();
    if (!pago || this.verificandoComprobante()) return;
    if (!aprobado && !this.puedeRechazarComprobante()) return;

    this.verificandoComprobante.set(true);
    this.errorVerificacion.set(null);
    this.paymentService.verificarComprobante(pago.id, aprobado, motivo).pipe(
      tap(actualizado => {
        // Nada de optimismo local: se muestra el estado que respondió el backend.
        this.pagoDeOrden.set(actualizado);
        this.verificandoComprobante.set(false);
        this.motivoRechazo.set('');
        this.decisionVerificacion.set({ aprobado });
        if (aprobado) {
          this.ordersService.loadActiveOrders();
          this.notify.showSuccess('Comprobante aprobado. La orden pasó a preparación.');
        } else {
          this.notify.showSuccess('Comprobante rechazado. Se notificó al cliente por WhatsApp.');
        }
      }),
      catchError(err => {
        this.verificandoComprobante.set(false);
        this.errorVerificacion.set(
          err?.message || 'No se pudo verificar el comprobante de Yape.'
        );
        return of(null);
      })
    ).subscribe();
  }

  getNewOrdersRawCount(): number {
    return this.ordersService.orders().filter(o => 
      o.estado === 'PENDIENTE_PAGO' || o.estado === 'PAGADO'
    ).length;
  }

  getPreparingOrdersRawCount(): number {
    return this.ordersService.orders().filter(o => 
      o.estado === 'EN_PREPARACION' || o.estado === 'LISTO_COCINA'
    ).length;
  }

  getDispatchedOrdersRawCount(): number {
    return this.ordersService.orders().filter(o => 
      o.estado === 'EN_REPARTO'
    ).length;
  }

  getCompletedOrdersRawCount(): number {
    return this.ordersService.orders().filter(o => 
      o.estado === 'COMPLETADO'
    ).length;
  }

  private filterByQuery(orders: Order[]): Order[] {
    const q = (this.searchQuery() || '').toLowerCase().trim();
    if (!q) return orders;

    return orders.filter(o =>
      (o.codigoSeguimiento && o.codigoSeguimiento.toLowerCase().includes(q)) ||
      (o.cliente?.nombre && o.cliente.nombre.toLowerCase().includes(q)) ||
      (o.cliente?.celular && o.cliente.celular.includes(q))
    );
  }

  readonly newOrders = computed(() => this.filterByQuery(this.ordersService.orders().filter(o =>
    o.estado === 'PENDIENTE_PAGO' || o.estado === 'PAGADO'
  )));

  readonly preparingOrders = computed(() => this.filterByQuery(this.ordersService.orders().filter(o =>
    o.estado === 'EN_PREPARACION' || o.estado === 'LISTO_COCINA'
  )));

  readonly dispatchedOrders = computed(() => this.filterByQuery(this.ordersService.orders().filter(o =>
    o.estado === 'EN_REPARTO'
  )));

  readonly completedOrders = computed(() => this.filterByQuery(this.ordersService.orders().filter(o =>
    o.estado === 'COMPLETADO'
  )));

  advanceOrderStatus(order: Order, nextStatus: OrderStatus): void {
    this.ordersService.updateOrderStatus(order.id, nextStatus).subscribe({
      next: () => {
        this.notify.showSuccess(`Orden #${this.getCodeNum(order.codigoSeguimiento)} actualizada a ${nextStatus}`);
      },
      error: () => {
        this.notify.showError(`Error al actualizar estado de la orden #${this.getCodeNum(order.codigoSeguimiento)}`);
      }
    });
  }

  /**
   * El backend solo acepta `EN_PREPARACION -> LISTO`. Sin este paso, un pedido de salón o de
   * recojo en preparación no se podía cerrar desde el panel: el botón único intentaba
   * `EN_PREPARACION -> ENTREGADO` y el backend lo rechazaba.
   */
  marcarListo(order: Order): void {
    this.advanceOrderStatus(order, 'LISTO_COCINA');
  }

  advanceAfterReady(order: Order): void {
    if (order.tipo === 'DELIVERY') {
      this.store.abrirModalAsignarMotorizado(order);
    } else {
      this.advanceOrderStatus(order, 'COMPLETADO');
    }
  }

  cancelarOrden(order: Order): void {
    this.ordersService.updateOrderStatus(order.id, 'CANCELADO').subscribe({
      next: () => {
        this.notify.showInfo(`Orden #${this.getCodeNum(order.codigoSeguimiento)} cancelada`);
      },
      error: () => {
        this.notify.showError('No se pudo cancelar la orden');
      }
    });
  }
}
