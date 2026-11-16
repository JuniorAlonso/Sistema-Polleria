import { Component, inject, signal, computed, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { OrdersService } from '../../core/services/orders.service';
import { ProductsService } from '../../core/services/products.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { Order, OrderStatus } from '../../core/models/order.model';
import { Product } from '../../core/models/product.model';
import {
  KitchenTab,
  KdsFilter,
  codigoNumerico,
  esTransicionCocinaPermitida
} from './kitchen.types';
import { KitchenSidebarComponent } from './components/kitchen-sidebar.component';
import { KitchenHeaderComponent } from './components/kitchen-header.component';
import { KitchenFilterBarComponent } from './components/kitchen-filter-bar.component';
import { KitchenOrderCardComponent } from './components/kitchen-order-card.component';
import { KitchenDisponibilidadComponent } from './components/kitchen-disponibilidad.component';

export type { KitchenTab, KdsFilter } from './kitchen.types';

@Component({
  selector: 'app-kitchen-kds',
  standalone: true,
  imports: [
    KitchenSidebarComponent,
    KitchenHeaderComponent,
    KitchenFilterBarComponent,
    KitchenOrderCardComponent,
    KitchenDisponibilidadComponent
  ],
  template: `
    <div class="min-h-screen bg-[#0d0e11] text-slate-100 font-sans selection:bg-polleria-gold selection:text-slate-900 flex flex-col md:flex-row">

      <app-kitchen-sidebar
        [activeTab]="activeTab()"
        [kitchenOrdersCount]="kitchenOrdersCount()"
        [agotadosCount]="agotadosCount()"
        [userName]="authService.currentUser()?.nombre"
        (tabChange)="onTabChange($event)"
        (logout)="cerrarSesion()"
      />

      <div class="flex-1 flex flex-col min-w-0 min-h-screen bg-[#0d0e11] overflow-y-auto">

        <app-kitchen-header
          [label]="getActiveTabLabel()"
          [activeTab]="activeTab()"
          [preparingCount]="preparingCount()"
          [readyCount]="readyCount()"
          [agotadosCount]="agotadosCount()"
          [totalProductsCount]="productsService.products().length"
        />

        @if (activeTab() === 'KDS') {
          <main class="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-4">

            @if (ordersService.hasError()) {
              <div class="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3" role="alert">
                <span>Sin conexión con el servicio de pedidos. Las comandas pueden estar desactualizadas.</span>
                <button
                  type="button"
                  (click)="ordersService.loadActiveOrders()"
                  class="px-2.5 py-1 rounded bg-rose-600/30 hover:bg-rose-600 text-white font-bold transition text-[11px] cursor-pointer shrink-0"
                >
                  Reintentar
                </button>
              </div>
            }

            <app-kitchen-filter-bar
              [filter]="kdsFilter()"
              [totalCount]="kitchenOrdersCount()"
              [pendingCount]="pendingCount()"
              [preparingCount]="preparingCount()"
              [readyCount]="readyCount()"
              (filterChange)="kdsFilter.set($event)"
            />

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
              @for (order of filteredKitchenOrders(); track order.id) {
                <app-kitchen-order-card
                  [order]="order"
                  [minutosEspera]="minutosEspera(order)"
                  [procesando]="estaProcesandoOrden(order.id)"
                  (cambiarEstado)="cambiarEstadoOrden(order, $event)"
                />
              } @empty {
                <div class="col-span-full py-20 text-center text-slate-500">
                  <div class="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-400">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                    </svg>
                  </div>
                  <p class="text-xl font-bold text-slate-300">No hay comandas pendientes en cocina</p>
                  <p class="text-xs text-slate-500 mt-1">Las nuevas comandas de salón, recojo y delivery aparecerán aquí automáticamente.</p>
                </div>
              }
            </div>

          </main>
        } @else if (activeTab() === 'DISPONIBILIDAD') {
          <app-kitchen-disponibilidad
            [productos]="productsService.products()"
            [cargando]="productsService.isLoading()"
            [modificandoIds]="procesandoProductoIds()"
            (toggleDisponibilidad)="alternarDisponibilidadProducto($event)"
            (recargar)="recargarProductos()"
          />
        }

      </div>
    </div>
  `
})
export class KitchenKdsComponent implements OnInit, OnDestroy {
  readonly ordersService = inject(OrdersService);
  readonly productsService = inject(ProductsService);
  readonly authService = inject(AuthService);
  private notify = inject(NotificationService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private pollingSub?: Subscription;

  readonly activeTab = signal<KitchenTab>('KDS');
  readonly kdsFilter = signal<KdsFilter>('TODAS');
  /** Guarda de órdenes con actualización de estado en curso para evitar doble clic / peticiones simultáneas. */
  readonly procesandoOrdenIds = signal<Set<string>>(new Set());
  /** Guarda de productos con alternancia de disponibilidad en curso para evitar solicitudes duplicadas por clics repetidos. */
  readonly procesandoProductoIds = signal<Set<string>>(new Set());

  readonly rawKitchenOrders = computed(() =>
    this.ordersService.orders()
      .filter(o => ['PAGADO', 'PENDIENTE_PAGO', 'PENDIENTE_CONFIRMACION', 'EN_PREPARACION', 'LISTO_COCINA'].includes(o.estado))
      // Cocina atiende por orden de llegada: la comanda más vieja primero (no la más nueva).
      .slice()
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  );

  readonly kitchenOrdersCount = computed(() => this.rawKitchenOrders().length);

  readonly agotadosCount = computed(() =>
    this.productsService.products().filter(p => p.agotado).length
  );

  readonly pendingCount = computed(() =>
    this.rawKitchenOrders().filter(o => o.estado === 'PAGADO').length
  );

  readonly preparingCount = computed(() =>
    this.rawKitchenOrders().filter(o => o.estado === 'EN_PREPARACION').length
  );

  readonly readyCount = computed(() =>
    this.rawKitchenOrders().filter(o => o.estado === 'LISTO_COCINA').length
  );

  readonly filteredKitchenOrders = computed(() => {
    const f = this.kdsFilter();
    const list = this.rawKitchenOrders();
    if (f === 'POR_PREPARAR') {
      return list.filter(o => o.estado === 'PAGADO');
    }
    if (f === 'EN_PREPARACION') {
      return list.filter(o => o.estado === 'EN_PREPARACION');
    }
    if (f === 'LISTOS') {
      return list.filter(o => o.estado === 'LISTO_COCINA');
    }
    return list;
  });

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.ordersService.loadActiveOrders();
      this.pollingSub = interval(2500).subscribe(() => {
        // Pestaña oculta: no se consulta el backend hasta que el usuario vuelva.
        if (typeof document !== 'undefined' && document.hidden) return;
        this.ordersService.loadActiveOrders();
      });
    }
  }

  ngOnDestroy(): void {
    if (this.pollingSub) {
      this.pollingSub.unsubscribe();
    }
  }

  onTabChange(tab: KitchenTab): void {
    this.activeTab.set(tab);
    if (tab === 'DISPONIBILIDAD') {
      // Requisito 5: Refrescar información mediante loadProducts() al entrar en la sección
      this.recargarProductos();
    }
  }

  recargarProductos(): void {
    this.productsService.loadProducts();
  }

  estaProcesandoProducto(productId: string): boolean {
    return this.procesandoProductoIds().has(String(productId));
  }

  private marcarProcesandoProducto(productId: string, enCurso: boolean): void {
    const clave = String(productId);
    this.procesandoProductoIds.update(prev => {
      const siguiente = new Set(prev);
      if (enCurso) {
        siguiente.add(clave);
      } else {
        siguiente.delete(clave);
      }
      return siguiente;
    });
  }

  alternarDisponibilidadProducto(producto: Product): void {
    // Requisito 7: Evitar solicitudes duplicadas al hacer clic repetidamente
    if (this.estaProcesandoProducto(producto.id)) {
      return;
    }

    const estadoDestino = producto.agotado ? 'DISPONIBLE' : 'AGOTADO';
    this.marcarProcesandoProducto(producto.id, true);

    this.productsService.toggleAgotado(producto.id, errorMsg => {
      this.marcarProcesandoProducto(producto.id, false);
      if (errorMsg) {
        // Requisito 8: Mostrar mensajes de error sin ocultar fallos del backend
        this.notify.showError(errorMsg);
      } else {
        // Requisito 8: Mostrar mensajes de éxito
        const detalle = estadoDestino === 'DISPONIBLE'
          ? `"${producto.nombre}" ahora está disponible para la venta.`
          : `"${producto.nombre}" marcado como agotado.`;
        this.notify.showSuccess(detalle);
      }
    });
  }

  estaProcesandoOrden(orderId: string): boolean {
    return this.procesandoOrdenIds().has(String(orderId));
  }

  private marcarProcesando(orderId: string, enCurso: boolean): void {
    const clave = String(orderId);
    this.procesandoOrdenIds.update(prev => {
      const siguiente = new Set(prev);
      if (enCurso) {
        siguiente.add(clave);
      } else {
        siguiente.delete(clave);
      }
      return siguiente;
    });
  }

  getCodeNum(code: string): string {
    return codigoNumerico(code);
  }

  /** Minutos transcurridos desde que entró la comanda; 0 si la fecha no es válida. */
  minutosEspera(order: Order): number {
    const inicio = new Date(order.createdAt).getTime();
    if (!Number.isFinite(inicio)) return 0;
    return Math.max(0, Math.floor((Date.now() - inicio) / 60000));
  }

  /** Una comanda recién recibida (todavía sin empezar) se marca como nueva. */
  esNueva(order: Order): boolean {
    return order.estado === 'PAGADO';
  }

  claseEspera(order: Order): string {
    return this.minutosEspera(order) >= 10
      ? 'text-rose-300 bg-rose-500/15 border-rose-500/30'
      : 'text-slate-300 bg-white/5 border-white/10';
  }

  getActiveTabLabel(): string {
    switch (this.activeTab()) {
      case 'KDS': return 'Comandas de Cocina & Horno en Vivo';
      case 'DISPONIBILIDAD': return 'Disponibilidad de Platos & Carta';
      default: return 'Panel Cocina';
    }
  }

  cambiarEstadoOrden(order: Order, nuevoEstado: OrderStatus): void {
    if (this.estaProcesandoOrden(order.id)) {
      return;
    }

    // D1.2 / R1.7: La cocina nunca puede cerrar (COMPLETADO/ENTREGADO), cancelar ni despachar una comanda.
    const estadosProhibidosCocina: OrderStatus[] = [
      'COMPLETADO',
      'ENTREGADO',
      'CANCELADO',
      'PEDIDO_FANTASMA',
      'EN_REPARTO',
      'EN_CAMINO',
      'EN_PUERTA'
    ];
    if (estadosProhibidosCocina.includes(nuevoEstado)) {
      this.notify.showWarning(`La cocina no tiene permisos para pasar la orden #${this.getCodeNum(order.codigoSeguimiento)} a ${nuevoEstado}`);
      return;
    }

    // Cocina solo avanza lo que ya está en cola o en preparación: PAGADO -> EN_PREPARACION -> LISTO_COCINA.
    if (!esTransicionCocinaPermitida(order.estado, nuevoEstado)) {
      this.notify.showWarning(`La orden #${this.getCodeNum(order.codigoSeguimiento)} todavía no se puede cocinar`);
      return;
    }

    this.marcarProcesando(order.id, true);
    this.ordersService.updateOrderStatus(order.id, nuevoEstado).subscribe({
      next: () => {
        this.marcarProcesando(order.id, false);
        this.notify.showSuccess(`Orden #${this.getCodeNum(order.codigoSeguimiento)} actualizada a ${nuevoEstado}`);
      },
      error: err => {
        this.marcarProcesando(order.id, false);
        const motivo =
          err?.error?.error ||
          err?.error?.mensaje ||
          err?.error?.message ||
          err?.error?.detail ||
          err?.message ||
          `Error al actualizar la orden #${this.getCodeNum(order.codigoSeguimiento)}`;
        this.notify.showError(motivo);
      }
    });
  }

  cerrarSesion(): void {
    this.authService.logout();
    this.notify.showInfo('Sesión finalizada', 'Has salido de la vista de cocina.');
    this.router.navigate(['/login']);
  }
}
