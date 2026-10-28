import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { tap, catchError, of, timer, map } from 'rxjs';
import { OrdersService } from '../../../../core/services/orders.service';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PaymentService, PagoOrdenAdmin } from '../../../../core/services/payment.service';
import { Order, OrderStatus } from '../../../../core/models/order.model';
import { AdminShellStore } from '../../state/admin-shell.store';
import { OrderStateFilter, ProofState } from '../../models/admin-forms';
import { getCodeNum, ghostWindow } from '../../shared/admin-format.util';
import { OrdersFilterBarComponent } from '../../components/ordenes/orders-filter-bar.component';
import { OrdersAttentionColumnComponent } from '../../components/ordenes/orders-attention-column.component';
import { OrdersIncidentsColumnComponent } from '../../components/ordenes/orders-incidents-column.component';
import { OrdersNewColumnComponent } from '../../components/ordenes/orders-new-column.component';
import { OrdersPreparingColumnComponent } from '../../components/ordenes/orders-preparing-column.component';
import { OrdersDispatchedColumnComponent } from '../../components/ordenes/orders-dispatched-column.component';
import { OrdersCompletedColumnComponent } from '../../components/ordenes/orders-completed-column.component';
import { OrderDetailModalComponent } from '../../components/ordenes/order-detail-modal.component';
import { normalizarCodigoTicket } from '../../../cajero/models/cajero-plazos.helpers';

/**
 * Contenedor (smart) de la pestaña ÓRDENES: tablero Kanban en vivo. Cada acción llama al endpoint
 * real y la vista solo cambia con la respuesta del backend; las compuertas de negocio (comprobante,
 * llamada de confirmación, pedido fantasma) nunca se saltan con un PATCH genérico.
 */
@Component({
  selector: 'app-admin-ordenes-page',
  standalone: true,
  imports: [
    CommonModule,
    OrdersFilterBarComponent,
    OrdersAttentionColumnComponent,
    OrdersIncidentsColumnComponent,
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
        [attentionCount]="attentionCount()"
        [incidentsCount]="incidentsCount()"
        [newCount]="newCount()"
        [preparingCount]="preparingCount()"
        [dispatchedCount]="dispatchedCount()"
        [completedCount]="completedCount()"
        (filterChange)="orderStateFilter.set($event)"
        (newOrder)="store.abrirModalNuevaOrden()"
      />

          <div [ngClass]="orderStateFilter() === 'TODAS' ? 'grid grid-cols-[repeat(6,minmax(300px,1fr))] gap-4 overflow-x-auto board-scrollbar pb-3 h-[calc(100vh-175px)]' : 'grid grid-cols-1 max-w-xl mx-auto w-full gap-4 h-[calc(100vh-175px)]'">
        @if (orderStateFilter() === 'TODAS' || orderStateFilter() === 'ATENCION') {
          <app-orders-attention-column
            [orders]="attentionOrders()"
            [now]="now()"
            [proofStates]="proofStates()"
            (orderSelected)="selectedOrderForModal.set($event)"
            (cancelled)="cancelarOrden($event)"
            (confirmCall)="confirmarLlamada($event)"
            (callAttempt)="registrarIntentoLlamada($event)"
            (declareGhost)="declararFantasma($event)"
            (advance)="advanceOrderStatus($event.order, $event.status)"
          />
        }

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

        @if (orderStateFilter() === 'TODAS' || orderStateFilter() === 'INCIDENCIAS') {
          <app-orders-incidents-column
            [orders]="incidentOrders()"
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
        [pagoConComprobante]="pagoConComprobante()"
        [now]="now()"
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
        (declareGhost)="declararFantasma($event)"
      />
    }
  `
})
export class AdminOrdenesPage implements OnInit {
  readonly ordersService = inject(OrdersService);
  readonly authService = inject(AuthService);
  readonly paymentService = inject(PaymentService);
  readonly notify = inject(NotificationService);
  readonly store = inject(AdminShellStore);

  readonly getCodeNum = getCodeNum;

  /** Reloj del tablero (cada 30 s) para los temporizadores de comprobante, llamada y pedido fantasma. */
  readonly now = toSignal(timer(0, 30_000).pipe(map(() => Date.now())), { initialValue: Date.now() });

  ngOnInit(): void {
    // Pagos reales: sin ellos no se sabe qué órdenes en PENDIENTE_PAGO tienen comprobante.
    this.paymentService.cargarPagos().subscribe();
  }

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

  /** Pago con imagen de comprobante, en cualquier estado (aprobado, rechazado, pendiente). */
  readonly pagoConComprobante = computed(() => {
    const pago = this.pagoDeOrden();
    return pago && !!pago.comprobanteUrl ? pago : null;
  });

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
        this.paymentService.cargarPagos().subscribe();
        this.ordersService.loadActiveOrders();
        if (aprobado) {
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

  private filterByQuery(orders: Order[]): Order[] {
    const q = (this.searchQuery() || '').toLowerCase().trim();
    if (!q) return orders;

    return orders.filter(o =>
      (o.codigoSeguimiento && o.codigoSeguimiento.toLowerCase().includes(q)) ||
      (o.cliente?.nombre && o.cliente.nombre.toLowerCase().includes(q)) ||
      (o.cliente?.celular && o.cliente.celular.includes(q))
    );
  }

  private ordersIn(...states: OrderStatus[]): Order[] {
    return this.ordersService.orders().filter(o => states.includes(o.estado));
  }

  /** Orders that wait for a human action before they can move (proof, confirmation call, customer at the door). */
  readonly attentionOrders = computed(() =>
    this.filterByQuery(this.ordersIn('PENDIENTE_CONFIRMACION', 'PENDIENTE_PAGO', 'EN_PUERTA')));

  /** Received and paid (or confirmed): ready to be accepted into the kitchen. */
  readonly newOrders = computed(() => this.filterByQuery(this.ordersIn('PAGADO')));

  readonly preparingOrders = computed(() =>
    this.filterByQuery(this.ordersIn('EN_PREPARACION', 'LISTO_COCINA')));

  readonly dispatchedOrders = computed(() => this.filterByQuery(this.ordersIn('EN_REPARTO')));

  readonly completedOrders = computed(() => this.filterByQuery(this.ordersIn('COMPLETADO')));

  readonly incidentOrders = computed(() =>
    this.filterByQuery(this.ordersIn('PEDIDO_FANTASMA', 'CANCELADO')));

  readonly attentionCount = computed(() =>
    this.ordersIn('PENDIENTE_CONFIRMACION', 'PENDIENTE_PAGO', 'EN_PUERTA').length);
  readonly newCount = computed(() => this.ordersIn('PAGADO').length);
  readonly preparingCount = computed(() => this.ordersIn('EN_PREPARACION', 'LISTO_COCINA').length);
  readonly dispatchedCount = computed(() => this.ordersIn('EN_REPARTO').length);
  readonly completedCount = computed(() => this.ordersIn('COMPLETADO').length);
  readonly incidentsCount = computed(() => this.ordersIn('PEDIDO_FANTASMA', 'CANCELADO').length);

  /** Proof status per PENDIENTE_PAGO order, taken from payments-service. */
  readonly proofStates = computed<Record<string, ProofState>>(() => {
    const pagos = this.paymentService.pagosPorOrdenMap();
    const result: Record<string, ProofState> = {};
    for (const o of this.ordersIn('PENDIENTE_PAGO')) {
      const estado = pagos.get(String(o.id))?.estado;
      result[String(o.id)] =
        estado === 'PENDIENTE_VERIFICACION' ? 'PENDIENTE_VERIFICACION'
        : estado === 'RECHAZADO' ? 'RECHAZADO'
        : 'SIN_COMPROBANTE';
    }
    return result;
  });

  private mensajeError(err: unknown, fallback: string): string {
    const e = err as { error?: { error?: string; message?: string; detail?: string }; message?: string } | null;
    return e?.error?.error || e?.error?.message || e?.error?.detail || e?.message || fallback;
  }

  advanceOrderStatus(order: Order, nextStatus: OrderStatus, codigoTicket?: string): void {
    // Los estados con compuerta de negocio tienen su propio flujo: nada de PATCH genérico para saltarlos.
    if (order.estado === 'PENDIENTE_PAGO' || order.estado === 'PENDIENTE_CONFIRMACION' || nextStatus === 'PEDIDO_FANTASMA') {
      this.notify.showWarning(
        'Esta orden requiere su flujo propio',
        'Aprobá el comprobante, confirmá la llamada o declará el pedido fantasma desde la columna Atención.'
      );
      return;
    }
    const code = this.getCodeNum(order.codigoSeguimiento);
    this.ordersService.updateOrderStatus(order.id, nextStatus, undefined, codigoTicket).subscribe({
      next: () => this.notify.showSuccess(`Orden #${code} actualizada a ${nextStatus}`),
      error: err => this.notify.showError(this.mensajeError(err, `Error al actualizar estado de la orden #${code}`))
    });
  }

  confirmarLlamada(order: Order): void {
    const code = this.getCodeNum(order.codigoSeguimiento);
    this.ordersService.confirmarLlamada(order.id).subscribe({
      next: () => this.notify.showSuccess(`Llamada confirmada: la orden #${code} pasó a cocina`),
      error: err => this.notify.showError(this.mensajeError(err, `No se pudo confirmar la llamada de la orden #${code}`))
    });
  }

  registrarIntentoLlamada(order: Order): void {
    const code = this.getCodeNum(order.codigoSeguimiento);
    this.ordersService.registrarIntentoLlamada(order.id).subscribe({
      next: () => this.notify.showInfo(`Intento de llamada registrado para la orden #${code}`),
      error: err => this.notify.showError(this.mensajeError(err, `No se pudo registrar el intento de la orden #${code}`))
    });
  }

  /** Pedido fantasma solo tras 30 min en la puerta (delivery) o 1 h listo (recojo); el backend lo vuelve a validar. */
  declararFantasma(order: Order): void {
    const window = ghostWindow(order, Date.now());
    if (!window?.canDeclare) {
      this.notify.showWarning('Todavía no se puede declarar pedido fantasma', 'Falta cumplir el tiempo de espera.');
      return;
    }
    const code = this.getCodeNum(order.codigoSeguimiento);
    this.ordersService.declararPedidoFantasma(order.id, 'Declarado por el administrador').subscribe({
      next: () => this.notify.showSuccess(`Orden #${code} declarada pedido fantasma`),
      error: err => this.notify.showError(this.mensajeError(err, `No se pudo declarar la orden #${code}`))
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
    } else if (order.tipo === 'RECOJO_EN_TIENDA') {
      this.entregarRecojo(order);
    } else {
      this.advanceOrderStatus(order, 'COMPLETADO');
    }
  }

  /**
   * A pickup order is handed over only against its ticket POL-<id> (same rule as the cashier
   * dashboard); the backend checks it again and answers 409 when the cash must be collected at
   * the cashier first, which is shown as is.
   */
  private entregarRecojo(order: Order): void {
    const ingresado = prompt(`Ticket de recojo del cliente (orden #${this.getCodeNum(order.codigoSeguimiento)}):`);
    if (ingresado === null) return;
    const esperado = normalizarCodigoTicket(String(order.id).replace(/^ord-/, ''));
    const recibido = normalizarCodigoTicket(ingresado);
    if (!recibido || recibido !== esperado) {
      this.notify.showError('Ticket no coincide', `El código no corresponde al pedido ${order.codigoSeguimiento || 'POL-' + order.id}.`);
      return;
    }
    this.advanceOrderStatus(order, 'COMPLETADO', `POL-${recibido}`);
  }

  cancelarOrden(order: Order): void {
    this.ordersService.updateOrderStatus(order.id, 'CANCELADO').subscribe({
      next: () => {
        this.notify.showInfo(`Orden #${this.getCodeNum(order.codigoSeguimiento)} cancelada`);
      },
      error: err => {
        this.notify.showError(this.mensajeError(err, 'No se pudo cancelar la orden'));
      }
    });
  }
}
