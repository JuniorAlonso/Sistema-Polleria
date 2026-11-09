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
import { DeliveryTab } from './components/delivery.types';
import { cantidadItems, esContraPago, getCodeNum, mensajeBackend } from './components/delivery.utils';
import { FinanceService } from '../../core/services/finance.service';
import { BackendEfectivoPendienteLiquidacion } from '../../core/models/api-contracts.model';
import { DeliverySidebarComponent } from './components/delivery-sidebar.component';
import { DeliveryHeaderComponent } from './components/delivery-header.component';
import { DeliveryOrderCardComponent } from './components/delivery-order-card.component';
import { RouteMapComponent } from './components/route-map.component';
import { CashSettlementComponent } from './components/cash-settlement.component';
import { DeliveryHistoryComponent } from './components/delivery-history.component';
import { DeliveryConfirmModalComponent } from './components/delivery-confirm-modal.component';
import { CurrencyPENPipe } from '../../shared/pipes/currency-pen.pipe';

export type { DeliveryTab };

/**
 * Contenedor (smart) del módulo repartidor: orquesta estado y servicios;
 * la presentación vive en `./components` (componentes tontos con input()/output()).
 */
@Component({
  selector: 'app-repartidor-delivery',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPENPipe,
    DeliverySidebarComponent,
    DeliveryHeaderComponent,
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
        (onTabChange)="cambiarTab($event)"
        (onLogout)="cerrarSesion()"
      />

      <!-- ================= MAIN CONTENT WRAPPER ================= -->
      <div class="flex-1 flex flex-col min-w-0 min-h-screen bg-[#0d0e11] overflow-y-auto">

        <app-delivery-header
          [title]="getActiveTabLabel()"
          [totalEfectivo]="totalEfectivoARendir()"
          [sencilloRequerido]="sencilloRequeridoRuta()"
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

            @if (sencilloRequeridoRuta() > 0) {
              <div class="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs">
                <div class="flex items-center gap-2 text-amber-200">
                  <svg class="w-4 h-4 shrink-0 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  <span>Sencillo requerido para pedidos contraentrega en curso: <strong class="text-amber-400 font-mono text-sm">{{ sencilloRequeridoRuta() | currencyPEN }}</strong>. Lleva cambio suficiente antes de salir en moto.</span>
                </div>
              </div>
            }

            <!-- 1. Lo que ya es mío: primero, porque es lo que el motorizado está haciendo -->
            <section data-testid="seccion-mis-entregas" class="space-y-3">
              <div class="flex items-center justify-between">
                <h2 class="text-sm font-extrabold text-emerald-300 uppercase tracking-wide">Mis entregas</h2>
                <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                  {{ misEntregasActivas().length }}
                </span>
              </div>
              @for (order of misEntregasActivas(); track order.id) {
                <app-delivery-order-card
                  [order]="order"
                  modo="MIA"
                  [procesando]="procesandoId() === order.id"
                  [recienTomado]="recienTomadoId() === order.id"
                  [minutosEnPuerta]="calcularMinutosEnPuerta(order)"
                  (onStartRoute)="salirARepartir($event)"
                  (onArrivedAtDoor)="marcarLlegadaEnPuerta($event)"
                  (onMarkDelivered)="abrirModalCobroEntrega($event)"
                  (onDeclareGhost)="declararFantasma($event)"
                  (onSendWhatsApp)="enviarWhatsAppCliente($event)"
                />
              } @empty {
                <p class="p-6 text-center text-xs text-slate-400 bg-[#14161a] rounded-2xl border border-white/10">
                  No tienes entregas en curso.
                  @if (auth.isRepartidor()) { Toma un pedido de la lista «Por tomar». }
                </p>
              }
            </section>

            <!-- 2. Pedidos listos que nadie tomó todavía (solo REPARTIDOR). Un pedido vive en UNA sola lista. -->
            @if (auth.isRepartidor()) {
              <section data-testid="seccion-por-tomar" class="space-y-3 pt-2">
                <div class="flex items-center justify-between">
                  <h2 class="text-sm font-extrabold text-sky-300 uppercase tracking-wide flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>Por tomar
                  </h2>
                  <span class="px-2.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 text-xs font-bold">
                    {{ porTomar().length }}
                  </span>
                </div>
                @for (order of porTomar(); track order.id) {
                  <app-delivery-order-card
                    [order]="order"
                    modo="DISPONIBLE"
                    [canClaim]="!!miIdMotorizado()"
                    [procesando]="procesandoId() === order.id"
                    (onClaimOrder)="tomarPedido($event)"
                  />
                } @empty {
                  <p class="p-6 text-center text-xs text-slate-400 bg-[#14161a] rounded-2xl border border-white/10">
                    No hay pedidos listos esperando repartidor. Aparecerán aquí cuando cocina los termine.
                  </p>
                }
              </section>
            }

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
            [pendiente]="efectivoPendiente()"
            [errorPendiente]="errorEfectivoPendiente()"
            (refrescar)="cargarEfectivoPendiente()"
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
  private readonly financeService = inject(FinanceService);
  readonly efectivoPendiente = signal<BackendEfectivoPendienteLiquidacion | null>(null);
  readonly errorEfectivoPendiente = signal<string | null>(null);
  readonly auth = inject(AuthService);
  private notify = inject(NotificationService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private pollingSub?: Subscription;

  readonly activeTab = signal<DeliveryTab>('ENTREGAS_ACTIVAS');
  /** Order whose take / start-route request is in flight: its button shows it and is disabled. */
  readonly procesandoId = signal<string | null>(null);
  /** Order this courier just took: highlighted in «Mis entregas» for a few seconds. */
  readonly recienTomadoId = signal<string | null>(null);
  private recienTomadoTimer?: ReturnType<typeof setTimeout>;
  readonly selectedOrderModal = signal<Order | null>(null);

  montoPagaCliente = 100;

  readonly deliveryOrders = computed(() =>
    this.ordersService.orders().filter(o => o.tipo === 'DELIVERY')
  );

  /** Identidad real del motorizado autenticado (claim `userId` del JWT). */
  readonly miIdMotorizado = computed(() => leerUserIdDelToken(this.auth.getAccessToken()));

  /**
   * Por tomar: what the backend offers (delivery LISTO without courier). An order already mine is
   * never listed here, so each order lives in exactly one list.
   * Se combina la respuesta de /ordenes/disponibles con las órdenes activas de delivery en estado listo
   * para evitar huecos por desfase de sondeo.
   */
  readonly porTomar = computed(() => {
    const mias = new Set(this.misEntregasActivas().map(o => o.id));
    const deDisponibles = this.ordersService.pedidosDisponibles().filter(o =>
      o.tipo === 'DELIVERY' && (o.repartidorId == null || o.repartidorId === 0) && !mias.has(o.id));
    const deDisponiblesIds = new Set(deDisponibles.map(o => o.id));
    const deActivas = this.deliveryOrders().filter(o =>
      (o.estado === 'LISTO_COCINA' || o.estado === 'LISTO' || o.estado === 'LISTO_PARA_ENTREGAR') &&
      (o.repartidorId == null || o.repartidorId === 0) &&
      !mias.has(o.id) &&
      !deDisponiblesIds.has(o.id)
    );
    return [...deDisponibles, ...deActivas];
  });

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

  /** Vuelto total acumulado que debe llevar el repartidor para sus órdenes activas en curso. */
  readonly sencilloRequeridoRuta = computed(() => {
    return this.misEntregasActivas()
      .filter(o => o.requiereCobroEfectivo)
      .reduce((acc, o) => acc + (o.vueltoEstimado || 0), 0);
  });

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.ordersService.loadActiveOrders();
      this.cargarDisponibles();
      this.cargarEfectivoPendiente();
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
    clearTimeout(this.recienTomadoTimer);
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
      case 'ENTREGAS_ACTIVAS': return 'Mis entregas y pedidos por tomar';
      case 'MAPA_RUTA': return 'Ruta Satelital y Cobertura';
      case 'COBROS_RENDICION': return 'Arqueo & Rendición de Caja';
      case 'HISTORIAL': return 'Historial de Entregas del Día';
      default: return 'Panel Repartidor';
    }
  }

  totalEfectivoARendir(): number {
    const p = this.efectivoPendiente();
    if (p !== null && p !== undefined) {
      return p.total;
    }
    return this.completedDeliveryOrders()
      .filter(o => esContraPago(o))
      .reduce((acc, o) => acc + o.total, 0);
  }

  totalDigitalCobrado(): number {
    return this.completedDeliveryOrders()
      .filter(o => !esContraPago(o))
      .reduce((acc, o) => acc + o.total, 0);
  }

  encodeUri(str: string): string {
    return encodeURIComponent(str);
  }

  /**
   * S10 — the courier takes a ready order from «Por tomar» with the atomic claim
   * (`POST /ordenes/{id}/reclamo`): the backend assigns the courier from the token (a second
   * attempt gets 409) and does not change the state. The order then shows up in «Mis entregas»,
   * highlighted, with the next step. An order already mine starts the route instead.
   *
   * Without identity nothing is sent: a null `repartidorId` would leave the order without owner.
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
    if (order.estado !== 'LISTO_COCINA' && order.estado !== 'LISTO' && order.estado !== 'LISTO_PARA_ENTREGAR') {
      this.notify.showError('El pedido aún está en preparación en cocina. Espera que esté listo.');
      return;
    }
    if (order.repartidorId != null && order.repartidorId !== miId) {
      this.refrescar();
      this.notify.showError(`La orden #${this.getCodeNum(order.codigoSeguimiento)} ya fue tomada por otro motorizado.`);
      return;
    }
    if (order.repartidorId === miId) {
      this.salirARepartir(order);
      return;
    }
    if (this.procesandoId()) return;

    const codigo = this.getCodeNum(order.codigoSeguimiento);
    this.procesandoId.set(order.id);
    this.ordersService.reclamarPedido(order.id).subscribe({
      next: () => {
        this.procesandoId.set(null);
        this.marcarRecienTomado(order.id);
        this.refrescar();
        this.notify.showSuccess(`Pedido #${codigo} asignado a ti`,
          'Recógelo en el mostrador y toca «Salir a repartir» cuando salgas.');
      },
      error: (err: Error) => {
        // A 409 may be another courier first, the order no longer LISTO, or a retry of this same
        // courier. The truth is read back; if the order ended up mine it is shown as mine.
        this.ordersService.obtenerOrden(order.id).subscribe({
          next: actual => {
            this.procesandoId.set(null);
            if (actual.repartidorId != null && actual.repartidorId === miId) {
              this.ordersService.orders.update(prev =>
                prev.some(o => o.id === actual.id)
                  ? prev.map(o => o.id === actual.id ? actual : o)
                  : [actual, ...prev]);
              this.marcarRecienTomado(order.id);
              this.notify.showSuccess(`La orden #${codigo} ya está asignada a ti`,
                'Recógelo en el mostrador y toca «Salir a repartir» cuando salgas.');
            } else {
              this.notify.showError(err.message);
            }
            this.refrescar();
          },
          error: () => {
            this.procesandoId.set(null);
            this.notify.showError(err.message);
            this.refrescar();
          }
        });
      }
    });
  }

  /** The courier has the order in hand and leaves: LISTO → EN_REPARTO with their id. */
  salirARepartir(order: Order): void {
    const miId = this.miIdMotorizado();
    if (!miId || this.procesandoId()) return;
    const codigo = this.getCodeNum(order.codigoSeguimiento);
    this.procesandoId.set(order.id);
    this.ordersService.updateOrderStatus(order.id, 'EN_REPARTO', miId).subscribe({
      next: () => {
        this.procesandoId.set(null);
        this.notify.showSuccess(`¡En camino con el pedido #${codigo}!`, 'Avisamos al cliente que su pedido salió.');
      },
      error: (err) => {
        this.procesandoId.set(null);
        this.notify.showError(`No se pudo iniciar el reparto de la orden #${codigo}`, mensajeBackend(err, ''));
      }
    });
  }

  private marcarRecienTomado(id: string): void {
    this.recienTomadoId.set(id);
    clearTimeout(this.recienTomadoTimer);
    this.recienTomadoTimer = setTimeout(() => this.recienTomadoId.set(null), 10000);
  }

  private refrescar(): void {
    this.cargarDisponibles();
    this.ordersService.loadActiveOrders();
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
    this.montoPagaCliente = order.montoPagaCon ? Number(order.montoPagaCon) : order.total;
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
        this.notify.showInfo('Pedido Fantasma declarado', 'Devuelve el producto al local.');
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

    if (esContraPago(order)) {
      if (this.montoPagaCliente < order.total) {
        this.notify.showError('El monto recibido no cubre el total del pedido');
        return;
      }

      // Registro obligatorio de cobro en efectivo en payments-service
      const vuelto = this.calcularVuelto();
      this.paymentService.registrarCobroEfectivo(order.id, order.total, this.montoPagaCliente, vuelto).subscribe({
        next: () => {
          this.selectedOrderModal.set(null);
          this.notify.showSuccess(`¡Cobro de S/ ${order.total.toFixed(2)} registrado y pedido ENTREGADO!`);
          this.ordersService.loadActiveOrders();
          this.cargarEfectivoPendiente();
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

  cambiarTab(tab: DeliveryTab): void {
    this.activeTab.set(tab);
    if (tab === 'COBROS_RENDICION') this.cargarEfectivoPendiente();
  }

  /** Cash still to hand in, computed by finance-service from the registered cash payments (S6). */
  cargarEfectivoPendiente(): void {
    const miId = this.miIdMotorizado();
    if (!miId) return;
    this.errorEfectivoPendiente.set(null);
    this.financeService.obtenerEfectivoPendienteLiquidacion(miId).subscribe({
      next: (pendiente) => this.efectivoPendiente.set(pendiente),
      error: (err) => {
        this.efectivoPendiente.set(null);
        this.errorEfectivoPendiente.set(err?.status === 404
          ? 'No tienes una liquidación abierta. Pide al Cajero que la abra antes de salir a repartir.'
          : mensajeBackend(err, 'No se pudo obtener el efectivo pendiente de liquidar'));
      }
    });
  }

  cerrarSesion(): void {
    this.auth.logout();
    this.notify.showInfo('Sesión finalizada', 'Has salido del módulo de repartidor.');
    this.router.navigate(['/login']);
  }
}
