import { Component, inject, signal, computed, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { OrdersService } from '../../core/services/orders.service';
import { PaymentService } from '../../core/services/payment.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { Order } from '../../core/models/order.model';
import { leerUserIdDelToken } from '../../core/utils/jwt.util';
import { DeliveryTab, DeliverySubFilter } from './components/delivery.types';
import { cantidadItems, getCodeNum } from './components/delivery.utils';
import { DeliverySidebarComponent } from './components/delivery-sidebar.component';
import { DeliveryHeaderComponent } from './components/delivery-header.component';
import { AvailableOrdersListComponent } from './components/available-orders-list.component';
import { DeliveryFiltersComponent } from './components/delivery-filters.component';
import { DeliveryOrderCardComponent } from './components/delivery-order-card.component';
import { RouteMapComponent } from './components/route-map.component';
import { CashSettlementComponent } from './components/cash-settlement.component';
import { DeliveryHistoryComponent } from './components/delivery-history.component';
import { DeliveryConfirmModalComponent } from './components/delivery-confirm-modal.component';

export type { DeliveryTab, DeliverySubFilter };

/**
 * Contenedor (smart) del módulo repartidor: orquesta estado y servicios;
 * la presentación vive en `./components` (componentes tontos con input()/output()).
 */
@Component({
  selector: 'app-repartidor-delivery',
  standalone: true,
  imports: [
    CommonModule,
    DeliverySidebarComponent,
    DeliveryHeaderComponent,
    AvailableOrdersListComponent,
    DeliveryFiltersComponent,
    DeliveryOrderCardComponent,
    RouteMapComponent,
    CashSettlementComponent,
    DeliveryHistoryComponent,
    DeliveryConfirmModalComponent
  ],
  template: `
    <div class="min-h-screen bg-[#0d0e11] text-slate-100 font-sans selection:bg-polleria-gold selection:text-slate-900 flex flex-col md:flex-row">

      <app-delivery-sidebar
        [activeTab]="activeTab()"
        [entregasActivasCount]="misEntregasActivas().length"
        [completadasCount]="completedDeliveryOrders().length"
        [userName]="auth.currentUser()?.nombre"
        (onTabChange)="activeTab.set($event)"
        (onLogout)="cerrarSesion()"
      />

      <!-- ================= MAIN CONTENT WRAPPER ================= -->
      <div class="flex-1 flex flex-col min-w-0 min-h-screen bg-[#0d0e11] overflow-y-auto">

        <app-delivery-header
          [title]="getActiveTabLabel()"
          [totalEfectivo]="totalEfectivoARendir()"
        />

        <!-- ================= TAB 1: ENTREGAS ACTIVAS ================= -->
        @if (activeTab() === 'ENTREGAS_ACTIVAS') {
          <main class="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-4">

            @if (miIdMotorizado() === null) {
              <div class="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-start gap-2.5">
                <svg class="w-4 h-4 shrink-0 mt-0.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                <span>No se pudo identificar tu usuario en la sesión. Vuelve a iniciar sesión para poder tomar pedidos.</span>
              </div>
            }

            <!-- S10 — Pedidos disponibles para entregar (solo REPARTIDOR) -->
            @if (auth.isRepartidor()) {
              <app-available-orders-list
                [orders]="pedidosDisponibles()"
                [canClaim]="!!miIdMotorizado()"
                (onClaimOrder)="tomarPedido($event)"
              />
            }

            <app-delivery-filters
              [subFilter]="subFilter()"
              [activasCount]="activeDeliveryOrders().length"
              [porRecogerCount]="readyForPickupOrders().length"
              [misEntregasCount]="misEntregasActivas().length"
              (onFilterChange)="subFilter.set($event)"
            />

            <!-- Entregas Cards -->
            <div class="space-y-4 pt-1">
              @if (filteredActiveDeliveryOrders().length === 0) {
                <div class="p-12 text-center bg-[#14161a] rounded-2xl border border-white/10 space-y-3">
                  <div class="w-16 h-16 rounded-full bg-sky-500/10 text-sky-400 mx-auto flex items-center justify-center">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                    </svg>
                  </div>
                  <h3 class="text-lg font-bold text-white">¡No hay entregas pendientes en esta sección!</h3>
                  <p class="text-xs text-slate-400 max-w-sm mx-auto">
                    Los pedidos marcados como listos en cocina aparecerán aquí automáticamente para ser recogidos.
                  </p>
                </div>
              }

              @for (order of filteredActiveDeliveryOrders(); track order.id) {
                <app-delivery-order-card
                  [order]="order"
                  [canClaim]="!!miIdMotorizado()"
                  [minutosEnPuerta]="calcularMinutosEnPuerta(order)"
                  (onClaimOrder)="tomarPedido($event)"
                  (onArrivedAtDoor)="marcarLlegadaEnPuerta($event)"
                  (onMarkDelivered)="abrirModalCobroEntrega($event)"
                  (onDeclareGhost)="declararFantasma($event)"
                  (onSendWhatsApp)="enviarWhatsAppCliente($event)"
                />
              }
            </div>

          </main>
        }

        <!-- ================= TAB 2: MAPA DE RUTA ================= -->
        @if (activeTab() === 'MAPA_RUTA') {
          <app-route-map [orders]="misEntregasActivas()" />
        }

        <!-- ================= TAB 3: COBROS & ARQUEO DE EFECTIVO ================= -->
        @if (activeTab() === 'COBROS_RENDICION') {
          <app-cash-settlement
            [totalEfectivo]="totalEfectivoARendir()"
            [totalDigital]="totalDigitalCobrado()"
            [completadasCount]="completedDeliveryOrders().length"
            (onSettle)="rendirCajaModal()"
          />
        }

        <!-- ================= TAB 4: HISTORIAL DE ENTREGAS DEL DÍA ================= -->
        @if (activeTab() === 'HISTORIAL') {
          <app-delivery-history [orders]="completedDeliveryOrders()" />
        }

        <!-- ================= MODAL COBRO CONTRAENTREGA ================= -->
        @if (selectedOrderModal(); as modalOrder) {
          <app-delivery-confirm-modal
            [order]="modalOrder"
            [montoPagaCliente]="montoPagaCliente"
            [vuelto]="calcularVuelto()"
            (onClose)="selectedOrderModal.set(null)"
            (onMontoChange)="montoPagaCliente = $event"
            (onConfirm)="confirmarCobroYEntrega()"
          />
        }

      </div>
    </div>
  `
})
export class RepartidorDeliveryComponent implements OnInit, OnDestroy {
  readonly ordersService = inject(OrdersService);
  readonly paymentService = inject(PaymentService);
  readonly auth = inject(AuthService);
  private notify = inject(NotificationService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private pollingSub?: Subscription;

  readonly activeTab = signal<DeliveryTab>('ENTREGAS_ACTIVAS');
  readonly subFilter = signal<DeliverySubFilter>('TODAS');
  readonly selectedOrderModal = signal<Order | null>(null);

  montoPagaCliente = 100;

  readonly deliveryOrders = computed(() =>
    this.ordersService.orders().filter(o => o.tipo === 'DELIVERY')
  );

  /** Identidad real del motorizado autenticado (claim `userId` del JWT). */
  readonly miIdMotorizado = computed(() => leerUserIdDelToken(this.auth.getAccessToken()));

  /** S10 — pedidos que el backend ofrece al repartidor (delivery LISTO sin repartidor). */
  readonly pedidosDisponibles = computed(() => this.ordersService.pedidosDisponibles());

  /**
   * S6.6 — Cola compartida: pedidos DELIVERY listos en cocina que todavía no tienen motorizado.
   * Un pedido ya asignado (a mí o a otro) no es un pedido disponible.
   */
  readonly readyForPickupOrders = computed(() =>
    this.deliveryOrders().filter(o => o.estado === 'LISTO_COCINA' && o.repartidorId == null)
  );

  /**
   * S6.6 — Mis entregas activas: lo que ya es mío, en ruta o asignado y todavía listo.
   * Si el admin me lo asignó antes de despachar, tiene que verlo aquí aunque siga LISTO.
   */
  readonly misEntregasActivas = computed(() => {
    const miId = this.miIdMotorizado();
    if (!miId) return [];
    return this.deliveryOrders().filter(
      o => o.repartidorId === miId && (o.estado === 'EN_REPARTO' || o.estado === 'EN_PUERTA' || o.estado === 'LISTO_COCINA')
    );
  });

  /** S6.6 — Historial del día: entregas completadas por mí. */
  readonly completedDeliveryOrders = computed(() => {
    const miId = this.miIdMotorizado();
    if (!miId) return [];
    return this.deliveryOrders().filter(o => o.estado === 'COMPLETADO' && o.repartidorId === miId);
  });

  /** `TODAS` = disponibles + mis entregas activas. */
  readonly activeDeliveryOrders = computed(() => [
    ...this.readyForPickupOrders(),
    ...this.misEntregasActivas()
  ]);

  readonly filteredActiveDeliveryOrders = computed(() => {
    const filter = this.subFilter();
    if (filter === 'POR_RECOGER') {
      return this.readyForPickupOrders();
    }
    if (filter === 'EN_RUTA') {
      return this.misEntregasActivas();
    }
    return this.activeDeliveryOrders();
  });

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.ordersService.loadActiveOrders();
      this.cargarDisponibles();
      this.pollingSub = interval(2500).subscribe(() => {
        this.ordersService.loadActiveOrders();
        this.cargarDisponibles();
      });
    }
  }

  /** S10 — recarga la lista de disponibles con el mismo sondeo de la pantalla (sin tiempo real nuevo). */
  private cargarDisponibles(): void {
    this.ordersService.listarDisponiblesParaEntrega().subscribe({
      next: () => undefined,
      error: () => undefined
    });
  }

  ngOnDestroy(): void {
    if (this.pollingSub) {
      this.pollingSub.unsubscribe();
    }
  }

  getCodeNum(code: string): string {
    return getCodeNum(code);
  }

  /** Cantidad total de unidades del pedido (suma de cantidades, no líneas del carrito). */
  cantidadItems(order: Order): number {
    return cantidadItems(order);
  }

  getActiveTabLabel(): string {
    switch (this.activeTab()) {
      case 'ENTREGAS_ACTIVAS': return 'Bandeja de Repartos Asignados';
      case 'MAPA_RUTA': return 'Ruta Satelital y Cobertura';
      case 'COBROS_RENDICION': return 'Arqueo & Rendición de Caja';
      case 'HISTORIAL': return 'Historial de Entregas del Día';
      default: return 'Panel Repartidor';
    }
  }

  totalEfectivoARendir(): number {
    return this.completedDeliveryOrders()
      .filter(o => o.metodoPago === 'EFECTIVO_CONTRAENTREGA' || !o.metodoPago)
      .reduce((acc, o) => acc + o.total, 0);
  }

  totalDigitalCobrado(): number {
    return this.completedDeliveryOrders()
      .filter(o => o.metodoPago && o.metodoPago !== 'EFECTIVO_CONTRAENTREGA')
      .reduce((acc, o) => acc + o.total, 0);
  }

  encodeUri(str: string): string {
    return encodeURIComponent(str);
  }

  /**
   * S10 — el motorizado toma un pedido listo de la cola compartida.
   *
   * Un pedido **sin dueño** se reclama con `POST /ordenes/{id}/reclamo`: el backend asigna el
   * repartidor del token de forma atómica (el segundo intento recibe 409) y **no cambia el estado**.
   * Un pedido **ya asignado a mí** inicia la ruta (LISTO → EN_REPARTO), que es el paso explícito
   * del repartidor con el pedido ya en mano.
   *
   * Si no hay identidad no se envía nada: un `repartidorId` nulo dejaría el pedido sin dueño.
   */
  tomarPedido(order: Order): void {
    const miId = this.miIdMotorizado();
    if (!miId) {
      this.notify.showError('No se pudo identificar tu usuario. Vuelve a iniciar sesión para tomar pedidos.');
      return;
    }
    if (order.tipo !== 'DELIVERY') {
      this.notify.showError('Esta orden pertenece a salón o recojo y no puede ser tomada para delivery.');
      return;
    }
    if (order.estado !== 'LISTO_COCINA') {
      this.notify.showError('El pedido aún está en preparación en cocina. Espera que esté listo.');
      return;
    }
    if (order.repartidorId != null && order.repartidorId !== miId) {
      this.ordersService.loadActiveOrders();
      this.cargarDisponibles();
      this.notify.showError(`La orden #${this.getCodeNum(order.codigoSeguimiento)} ya fue tomada por otro motorizado.`);
      return;
    }

    if (order.repartidorId === miId) {
      // Ya es mío: corresponde iniciar la ruta. Comportamiento previo de este botón.
      this.ordersService.updateOrderStatus(order.id, 'EN_REPARTO', miId).subscribe({
        next: () => {
          this.notify.showSuccess(`Tomaste la orden #${this.getCodeNum(order.codigoSeguimiento)} e iniciaste el reparto`);
        },
        error: () => {
          this.notify.showError(`Error al tomar la orden #${this.getCodeNum(order.codigoSeguimiento)}`);
        }
      });
      return;
    }

    // Sin dueño: reclamo atómico. La pantalla se refresca con lo que responde el backend.
    this.ordersService.reclamarPedido(order.id).subscribe({
      next: () => {
        this.cargarDisponibles();
        this.ordersService.loadActiveOrders();
        this.notify.showSuccess(`Tomaste la orden #${this.getCodeNum(order.codigoSeguimiento)}`);
      },
      error: (err: Error) => {
        // El 409 puede ser que otro llegó primero, que el pedido dejó de estar LISTO, o un
        // reintento del mismo repartidor. Se consulta la verdad y se refresca; si el pedido
        // quedó asignado a él, se muestra como suyo en vez de como un error.
        this.ordersService.obtenerOrden(order.id).subscribe({
          next: actual => {
            const esMio = actual.repartidorId != null && actual.repartidorId === miId;
            if (esMio) {
              this.ordersService.orders.update(prev =>
                prev.some(o => o.id === actual.id)
                  ? prev.map(o => o.id === actual.id ? actual : o)
                  : [actual, ...prev]);
              this.notify.showSuccess(`La orden #${this.getCodeNum(order.codigoSeguimiento)} ya está asignada a ti`);
            } else {
              this.notify.showError(err.message);
            }
            this.cargarDisponibles();
            this.ordersService.loadActiveOrders();
          },
          error: () => {
            this.notify.showError(err.message);
            this.cargarDisponibles();
            this.ordersService.loadActiveOrders();
          }
        });
      }
    });
  }

  enviarWhatsAppCliente(order: Order): void {
    if (!order.cliente?.celular) {
      this.notify.showError('El cliente no tiene celular registrado');
      return;
    }
    const msg = `Hola ${order.cliente.nombre}, soy tu repartidor de San Pollo. Estoy en camino con tu pedido #${this.getCodeNum(order.codigoSeguimiento)}.`;
    const url = `https://api.whatsapp.com/send?phone=51${order.cliente.celular}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    this.notify.showSuccess('WhatsApp abierto para enviar al cliente');
  }

  abrirModalCobroEntrega(order: Order): void {
    this.selectedOrderModal.set(order);
    this.montoPagaCliente = order.montoPagaCon ? Number(order.montoPagaCon) : (order.total <= 50 ? 50 : 100);
  }

  marcarLlegadaEnPuerta(order: Order): void {
    this.ordersService.marcarEnPuerta(order.id).subscribe({
      next: () => {
        this.notify.showSuccess('¡Estás en la puerta!', 'Inició el cronómetro de 30 min y se avisó al cliente por WhatsApp.');
        this.ordersService.loadActiveOrders();
      },
      error: (err) => {
        this.notify.showError('Error al marcar en puerta', err?.message);
      }
    });
  }

  calcularMinutosEnPuerta(order: Order): number {
    if (!order.enPuertaAt) return 0;
    const inicio = new Date(order.enPuertaAt).getTime();
    const ahora = Date.now();
    const difMin = Math.floor((ahora - inicio) / 60000);
    return difMin > 0 ? difMin : 0;
  }

  declararFantasma(order: Order): void {
    const confirmar = confirm(`¿Declarar el Pedido #${this.getCodeNum(order.codigoSeguimiento)} como Pedido Fantasma?\nEsto bloqueará al cliente y devolverás el producto al local.`);
    if (!confirmar) return;

    this.ordersService.declararPedidoFantasma(order.id, 'NO_ENTREGADO: Cliente no salió a la puerta tras 30 min').subscribe({
      next: () => {
        this.notify.showInfo('Pedido Fantasma declarado', 'Devuelve el producto a caja para registro de merma.');
        this.ordersService.loadActiveOrders();
      },
      error: (err) => {
        this.notify.showError('Error al declarar pedido fantasma', err?.message);
      }
    });
  }

  calcularVuelto(): number {
    const o = this.selectedOrderModal();
    if (!o) return 0;
    const vuelto = this.montoPagaCliente - o.total;
    return vuelto > 0 ? Math.round(vuelto * 100) / 100 : 0;
  }

  confirmarCobroYEntrega(): void {
    const order = this.selectedOrderModal();
    if (!order) return;

    if (order.metodoPago === 'EFECTIVO_CONTRAENTREGA' || !order.metodoPago) {
      // Registro obligatorio de cobro en efectivo en payments-service
      const vuelto = this.calcularVuelto();
      this.paymentService.registrarCobroEfectivo(order.id, order.total, this.montoPagaCliente, vuelto).subscribe({
        next: () => {
          this.selectedOrderModal.set(null);
          this.notify.showSuccess(`¡Cobro de S/ ${order.total.toFixed(2)} registrado y pedido ENTREGADO!`);
          this.ordersService.loadActiveOrders();
        },
        error: (err) => {
          this.notify.showError('Error al registrar cobro en efectivo', err?.message);
        }
      });
    } else {
      // Pedido ya pagado digitalmente
      this.ordersService.updateOrderStatus(order.id, 'COMPLETADO').subscribe({
        next: () => {
          this.selectedOrderModal.set(null);
          this.notify.showSuccess(`¡Pedido #${this.getCodeNum(order.codigoSeguimiento)} ENTREGADO con éxito!`);
        },
        error: () => {
          this.notify.showError(`Error al finalizar la entrega de la orden #${this.getCodeNum(order.codigoSeguimiento)}`);
        }
      });
    }
  }

  rendirCajaModal(): void {
    // No existe endpoint de rendición de caja para el repartidor: no se anuncia una
    // acción que no ocurre.
    this.notify.showInfo(
      'Rendición de caja no disponible',
      'El backend todavía no expone un endpoint para rendir el efectivo del repartidor. Coordina el arqueo con el administrador.'
    );
  }

  cerrarSesion(): void {
    this.auth.logout();
    this.notify.showInfo('Sesión finalizada', 'Has salido del módulo de repartidor.');
    this.router.navigate(['/login']);
  }
}
