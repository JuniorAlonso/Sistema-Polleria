import { Component, inject, computed, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { OrdersService } from '../../core/services/orders.service';
import { AuthService } from '../../core/services/auth.service';
import { OrderStatusBadgeComponent } from '../../shared/components/order-status-badge/order-status-badge.component';
import { NotificationService } from '../../core/services/notification.service';
import { Order } from '../../core/models/order.model';

@Component({
  selector: 'app-kitchen-kds',
  standalone: true,
  imports: [CommonModule, OrderStatusBadgeComponent],
  template: `
    <div class="bg-slate-900 text-white min-h-[calc(100vh-80px)] p-6 font-sans">
      
      <!-- Top Bar with Stats -->
      <div class="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold mb-1">
            <svg class="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"/>
            </svg>
            <span>KDS Cocina & Horno Pollero</span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight">Comandas de Cocina en Vivo</h1>
        </div>

        <div class="flex items-center gap-3">
          <div class="px-4 py-2 rounded-2xl bg-slate-800 border border-slate-700 text-xs">
            <span class="text-slate-400 block font-medium">En Preparación:</span>
            <span class="text-xl font-extrabold text-amber-400">{{ preparingCount() }}</span>
          </div>
          <div class="px-4 py-2 rounded-2xl bg-slate-800 border border-slate-700 text-xs">
            <span class="text-slate-400 block font-medium">Listos para Servir:</span>
            <span class="text-xl font-extrabold text-purple-400">{{ readyCount() }}</span>
          </div>

          <!-- User Info & Logout Button -->
          <div class="flex items-center gap-2 pl-3 border-l border-slate-700">
            <button 
              type="button"
              (click)="cerrarSesion()"
              class="px-3 py-2 rounded-2xl bg-rose-500/10 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/20 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow"
              title="Cerrar Sesión"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
              <span>Salir</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Orders Kanban Grid -->
      <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-8">
        @for (order of ordersService.kitchenOrders(); track order.id) {
          <div 
            class="rounded-3xl border flex flex-col justify-between transition-all duration-300 shadow-xl overflow-hidden"
            [ngClass]="{
              'border-amber-500/50 ring-1 ring-amber-500/30': order.estado === 'EN_PREPARACION',
              'border-purple-500/50 ring-1 ring-purple-500/30': order.estado === 'LISTO_COCINA',
              'border-slate-700': order.estado === 'PAGADO'
            }"
            style="background-color: #1a1e24;"
          >
            <!-- Card Header -->
            <div class="p-5 border-b border-slate-800 flex justify-between items-start bg-slate-900/50">
              <div>
                <span class="font-mono text-xs font-extrabold text-amber-400 tracking-wider">
                  {{ order.codigoSeguimiento }}
                </span>
                <h3 class="font-bold text-base text-white mt-0.5 flex items-center gap-1.5">
                  @if (order.tipo === 'SALON') {
                    <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                    </svg>
                    <span>Mesa #{{ order.cliente.mesaNumero }}</span>
                  } @else if (order.tipo === 'DELIVERY') {
                    <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h2m-6 0a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/>
                    </svg>
                    <span>Delivery ({{ order.cliente.nombre }})</span>
                  } @else {
                    <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
                    </svg>
                    <span>Para Llevar</span>
                  }
                </h3>
              </div>

              <app-order-status-badge [status]="order.estado" />
            </div>

            <!-- Items List -->
            <div class="p-5 flex-1 space-y-3 overflow-y-auto max-h-64">
              @for (item of order.items; track item.product.id) {
                <div class="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-start gap-3 text-xs">
                  <span class="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-extrabold text-sm shrink-0">
                    {{ item.cantidad }}
                  </span>
                  <div class="flex-1">
                    <p class="font-bold text-slate-100 text-sm">{{ item.product.nombre }}</p>
                    @if (item.notas) {
                      <p class="text-amber-300/90 font-medium italic mt-0.5 bg-amber-950/40 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                        <svg class="w-3 h-3 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                        </svg>
                        <span>{{ item.notas }}</span>
                      </p>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- Footer Action Button -->
            <div class="p-4 border-t border-slate-800 bg-slate-900/80">
              @if (order.estado === 'PAGADO') {
                <button 
                  (click)="advanceStatus(order)"
                  class="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  <svg class="w-4 h-4 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"/>
                  </svg>
                  <span>Empezar a Preparar</span>
                </button>
              } @else if (order.estado === 'EN_PREPARACION') {
                <button 
                  (click)="advanceStatus(order)"
                  class="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 cursor-pointer"
                >
                  <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span>Marcar Listo en Cocina</span>
                </button>
              } @else if (order.estado === 'LISTO_COCINA') {
                <button 
                  (click)="advanceStatus(order)"
                  class="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h2m-6 0a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/>
                  </svg>
                  <span>Despachar ({{ order.tipo === 'DELIVERY' ? 'A Reparto' : 'Completar' }})</span>
                </button>
              }
            </div>

          </div>
        } @empty {
          <div class="col-span-full py-20 text-center text-slate-500">
            <div class="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-400">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
            </div>
            <p class="text-xl font-bold text-slate-300">No hay comandas pendientes en cocina</p>
            <p class="text-xs text-slate-500 mt-1">Los nuevos pedidos pagados aparecerán aquí automáticamente.</p>
          </div>
        }
      </div>

    </div>
  `
})
export class KitchenKdsComponent implements OnInit, OnDestroy {
  readonly ordersService = inject(OrdersService);
  readonly authService = inject(AuthService);
  private notify = inject(NotificationService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private pollInterval?: any;

  readonly preparingCount = computed(() =>
    this.ordersService.orders().filter(o => o.estado === 'EN_PREPARACION').length
  );

  readonly readyCount = computed(() =>
    this.ordersService.orders().filter(o => o.estado === 'LISTO_COCINA').length
  );

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.ordersService.loadKitchenOrders();
      this.pollInterval = setInterval(() => {
        this.ordersService.loadKitchenOrders();
      }, 2500);
    }
  }

  ngOnDestroy(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  advanceStatus(order: Order): void {
    this.ordersService.advanceKitchenStatus(order.id);
    this.notify.showSuccess(`Orden ${order.codigoSeguimiento} actualizada`);
  }

  cerrarSesion(): void {
    this.authService.logout();
    this.notify.showInfo('Sesión finalizada', 'Has salido de la vista de cocina.');
    this.router.navigate(['/login']);
  }
}
