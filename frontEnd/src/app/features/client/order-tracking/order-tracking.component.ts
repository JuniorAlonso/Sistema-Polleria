import { Component, inject, signal, computed, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { OrdersService } from '../../../core/services/orders.service';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { NotificationService } from '../../../core/services/notification.service';
import { Order, OrderStatus } from '../../../core/models/order.model';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-order-tracking',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CurrencyPENPipe],
  template: `
    <div class="min-h-screen bg-[#0f1013] text-white py-8 sm:py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans selection:bg-polleria-gold selection:text-slate-900">
      
      <!-- Ambient Glow & Heat Vignette Background -->
      <div class="absolute inset-0 bg-radial-vignette pointer-events-none opacity-60"></div>
      <div class="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div class="max-w-4xl mx-auto space-y-8 relative z-10 animate-slide-up">
        
        <!-- ================= LISTA DE PEDIDOS DISPONIBLES ================= -->
        @if (availableOrders().length > 0) {
          <div class="bg-[#181a1e]/90 p-4 sm:p-5 rounded-2xl border border-white/10 shadow-xl backdrop-blur-md">
            <div class="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
              <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                <svg class="w-4 h-4 text-polleria-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                </svg>
                <span>Pedidos ({{ availableOrders().length }})</span>
              </div>
              <span class="text-[11px] text-slate-400 font-mono hidden sm:inline">
                Selecciona una orden para rastrearla en tiempo real
              </span>
            </div>

            <!-- Horizontal Scrollable Order Pills List -->
            <div class="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
              @for (order of availableOrders(); track order.id) {
                <button
                  type="button"
                  (click)="selectOrder(order)"
                  class="shrink-0 p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer flex items-center gap-3"
                  [ngClass]="currentOrder()?.id === order.id ? 
                    'bg-amber-500/15 border-polleria-gold ring-1 ring-polleria-gold shadow-lg shadow-amber-500/10' : 
                    'bg-black/30 border-white/10 hover:border-white/20 hover:bg-white/5'"
                >
                  <div class="flex flex-col">
                    <div class="flex items-center gap-2">
                      <span class="font-mono text-xs font-black" [ngClass]="currentOrder()?.id === order.id ? 'text-polleria-gold' : 'text-white'">
                        {{ order.codigoSeguimiento }}
                      </span>
                      <!-- Badge Estado -->
                      <span 
                        class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide"
                        [ngClass]="{
                          'bg-amber-500/20 text-amber-400 border border-amber-500/30': order.estado === 'EN_PREPARACION' || order.estado === 'PAGADO',
                          'bg-purple-500/20 text-purple-300 border border-purple-500/30': order.estado === 'LISTO_COCINA',
                          'bg-sky-500/20 text-sky-300 border border-sky-500/30': order.estado === 'EN_REPARTO',
                          'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30': order.estado === 'COMPLETADO',
                          'bg-rose-500/20 text-rose-300 border border-rose-500/30': order.estado === 'CANCELADO'
                        }"
                      >
                        {{ getStatusLabel(order.estado) }}
                      </span>
                    </div>

                    <div class="flex items-center justify-between gap-4 mt-1 text-[11px] text-slate-400">
                      <span>{{ order.total | currencyPEN }}</span>
                      <span class="text-[10px]">{{ order.tipo }}</span>
                    </div>
                  </div>
                </button>
              }
            </div>
          </div>
        }

        @if (currentOrder()) {
          <!-- ================= TOP HEADER EN VIVO ================= -->
          <div class="text-center space-y-3">
            
            <!-- Order Code Badge -->
            <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono tracking-widest text-slate-300 shadow">
              <span class="w-2 h-2 rounded-full bg-polleria-gold"></span>
              <span>ORDEN {{ currentOrder()?.codigoSeguimiento }}</span>
              <span class="text-white/40">|</span>
              <span class="text-polleria-gold font-bold uppercase">{{ currentOrder()?.tipo || 'DELIVERY' }}</span>
            </div>

            <!-- Dynamic Slogan Display -->
            <h1 class="font-display text-3xl sm:text-5xl lg:text-6xl font-black tracking-wide uppercase text-polleria-gold drop-shadow-[0_2px_15px_rgba(245,158,11,0.35)] leading-tight">
              {{ getMainTitle() }}
            </h1>

            <!-- Dynamic Subtitle -->
            <p class="text-slate-300 text-sm sm:text-base font-normal tracking-wide max-w-xl mx-auto">
              {{ getSubtitle() }}
            </p>

          </div>

          <!-- ================= DYNAMIC STEPPER PROGRESS CARD ================= -->
          <div class="p-6 sm:p-10 rounded-3xl bg-[#181a1e]/90 border border-white/10 shadow-2xl backdrop-blur-md">
            
            <div class="relative">
              
              <!-- Progress Connecting Line Track -->
              <div class="hidden sm:block absolute top-7 left-12 right-12 h-1 bg-slate-800 rounded-full">
                <!-- Active Progress Golden Glow Bar -->
                <div 
                  class="h-full bg-polleria-gold shadow-[0_0_15px_rgba(245,158,11,0.8)] rounded-full transition-all duration-700 ease-out"
                  [style.width]="getProgressWidth()"
                ></div>
              </div>

              <!-- Steps Grid (4 Steps) -->
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-4 relative z-10">
                
                <!-- STEP 1: RECIBIDO -->
                <div class="flex flex-col items-center text-center space-y-3">
                  <div 
                    class="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500"
                    [ngClass]="getStepBadgeClass(1)"
                  >
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 
                      class="font-display text-lg sm:text-xl tracking-wide uppercase transition-colors"
                      [ngClass]="getStepTextClass(1)"
                    >
                      Recibido
                    </h3>
                    <p class="text-xs text-slate-400 font-mono mt-0.5">
                      {{ getStepSubtitle(1) }}
                    </p>
                  </div>
                </div>

                <!-- STEP 2: EN PREPARACIÓN -->
                <div class="flex flex-col items-center text-center space-y-3">
                  <div 
                    class="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500"
                    [ngClass]="getStepBadgeClass(2)"
                  >
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 
                      class="font-display text-lg sm:text-xl tracking-wide uppercase transition-colors"
                      [ngClass]="getStepTextClass(2)"
                    >
                      En preparación
                    </h3>
                    <p class="text-xs text-slate-400 font-mono mt-0.5">
                      {{ getStepSubtitle(2) }}
                    </p>
                  </div>
                </div>

                <!-- STEP 3: EN CAMINO (O LISTO SALÓN) -->
                <div class="flex flex-col items-center text-center space-y-3">
                  <div 
                    class="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500"
                    [ngClass]="getStepBadgeClass(3)"
                  >
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h2m-6 0a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/>
                    </svg>
                  </div>
                  <div>
                    <h3 
                      class="font-display text-lg sm:text-xl tracking-wide uppercase transition-colors"
                      [ngClass]="getStepTextClass(3)"
                    >
                      {{ currentOrder()?.tipo === 'SALON' ? 'Listo en Mesa' : 'En camino' }}
                    </h3>
                    <p class="text-xs font-mono mt-0.5" [ngClass]="isStepActive(3) ? 'text-sky-300 font-bold' : 'text-slate-400'">
                      {{ getStepSubtitle(3) }}
                    </p>
                  </div>
                </div>

                <!-- STEP 4: ENTREGADO / COMPLETADO -->
                <div class="flex flex-col items-center text-center space-y-3">
                  <div 
                    class="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500"
                    [ngClass]="getStepBadgeClass(4)"
                  >
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                    </svg>
                  </div>
                  <div>
                    <h3 
                      class="font-display text-lg sm:text-xl tracking-wide uppercase transition-colors"
                      [ngClass]="getStepTextClass(4)"
                    >
                      Entregado
                    </h3>
                    <p class="text-xs font-mono mt-0.5" [ngClass]="isStepActive(4) || isStepCompleted(4) ? 'text-emerald-400 font-bold' : 'text-slate-500'">
                      {{ getStepSubtitle(4) }}
                    </p>
                  </div>
                </div>

              </div>

            </div>

          </div>

          <!-- ================= BOTTOM ACTION BUTTONS ================= -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            
            <!-- Button 1: CONTACTAR CON EL RIDER -->
            <button 
              type="button"
              (click)="contactRider()"
              class="w-full py-4 px-6 rounded-xl border-2 border-polleria-gold bg-[#141618] hover:bg-white/5 active:scale-98 text-polleria-gold font-display text-lg sm:text-xl tracking-wider uppercase font-bold transition duration-200 shadow-lg flex items-center justify-center gap-3 cursor-pointer"
            >
              <svg class="w-5 h-5 text-polleria-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
              </svg>
              <span>CONTACTAR CON EL RIDER</span>
            </button>

            <!-- Button 2: VER DETALLES -->
            <button 
              type="button"
              (click)="toggleDetailsModal(true)"
              class="w-full py-4 px-6 rounded-xl bg-polleria-crimson hover:bg-[#a81125] active:scale-98 text-white font-display text-lg sm:text-xl tracking-wider uppercase font-bold transition duration-200 shadow-lg shadow-black/60 flex items-center justify-center gap-3 cursor-pointer"
            >
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              <span>VER DETALLES</span>
            </button>

          </div>
        } @else {
          <!-- ================= EMPTY STATE ================= -->
          <div class="bg-[#181a1e]/90 p-8 sm:p-12 rounded-3xl border border-white/10 shadow-2xl text-center space-y-4">
            <div class="w-20 h-20 rounded-full bg-polleria-gold/10 border border-polleria-gold/20 flex items-center justify-center mx-auto text-polleria-gold">
              <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
              </svg>
            </div>
            <h2 class="font-display text-2xl sm:text-3xl text-white uppercase tracking-wider">Aún no has seleccionado un pedido</h2>
            <p class="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
              Ingresa el código de tu pedido o haz clic en Explorar Menú para realizar tu primer pedido.
            </p>
            <div class="pt-2">
              <a 
                routerLink="/menu" 
                class="inline-block px-8 py-3.5 rounded-full bg-polleria-crimson hover:bg-[#a81125] text-white font-bold text-xs sm:text-sm uppercase tracking-wider transition shadow-lg shadow-black/40 cursor-pointer"
              >
                Explorar Menú y Pedir
              </a>
            </div>
          </div>
        }

        <!-- Search other order code shortcut -->
        <div class="pt-4 text-center">
          <form (ngSubmit)="searchOrder()" class="inline-flex items-center gap-2 p-1.5 rounded-full bg-white/5 border border-white/10">
            <input 
              type="text" 
              [(ngModel)]="searchCode" 
              name="searchCode"
              placeholder="Buscar #POL-1, 2, 3..." 
              class="px-4 py-1.5 bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none uppercase font-mono tracking-wider w-44"
            />
            <button type="submit" class="px-4 py-1.5 rounded-full bg-polleria-gold text-slate-950 text-xs font-bold uppercase cursor-pointer hover:bg-amber-400 transition">
              Buscar
            </button>
          </form>
        </div>

      </div>


      <!-- ================= DETAILS MODAL ================= -->
      @if (showDetailsModal()) {
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div class="w-full max-w-lg bg-[#181a1e] rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl space-y-6 animate-slide-up text-white">
            
            <div class="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 class="font-display text-2xl uppercase tracking-wider text-polleria-gold">
                  Detalle de Comanda {{ currentOrder()?.codigoSeguimiento }}
                </h3>
                <p class="text-xs text-slate-400 mt-0.5">
                  Cliente: <strong class="text-white">{{ currentOrder()?.cliente?.nombre || 'Cliente San Pollo' }}</strong>
                </p>
                <p class="text-xs text-slate-400">
                  Dirección: {{ currentOrder()?.cliente?.direccion || 'Entrega en local' }}
                </p>
              </div>
              <button 
                (click)="toggleDetailsModal(false)"
                class="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <!-- Items List -->
            <div class="space-y-3 max-h-60 overflow-y-auto pr-1">
              @for (item of currentOrder()?.items; track item.product.id) {
                <div class="flex items-center justify-between text-xs py-2 border-b border-slate-800/60">
                  <div class="flex items-center gap-3">
                    <span class="px-2 py-0.5 rounded bg-polleria-crimson text-white font-mono font-bold">{{ item.cantidad }}x</span>
                    <div class="flex flex-col">
                      <span class="font-bold text-slate-200">{{ item.product.nombre }}</span>
                      @if (item.notas) {
                        <span class="text-[10px] text-amber-400/80 italic">Nota: {{ item.notas }}</span>
                      }
                    </div>
                  </div>
                  <span class="font-bold text-polleria-gold">{{ item.subtotal | currencyPEN }}</span>
                </div>
              }
            </div>

            <!-- Totals Breakdown -->
            <div class="pt-2 border-t border-slate-800 space-y-1.5 text-xs text-slate-300">
              <div class="flex justify-between">
                <span>Subtotal:</span>
                <span>{{ currentOrder()?.subtotal | currencyPEN }}</span>
              </div>
              <div class="flex justify-between">
                <span>Delivery:</span>
                <span>{{ currentOrder()?.costoEnvio | currencyPEN }}</span>
              </div>
              <div class="flex justify-between pt-2 border-t border-slate-700 text-sm font-bold text-white">
                <span>Total Facturado:</span>
                <span class="text-polleria-gold font-display text-xl">{{ currentOrder()?.total | currencyPEN }}</span>
              </div>
            </div>

            <button 
              type="button"
              (click)="toggleDetailsModal(false)"
              class="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase cursor-pointer transition"
            >
              Cerrar
            </button>

          </div>
        </div>
      }

    </div>
  `
})
export class OrderTrackingComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  readonly ordersService = inject(OrdersService);
  private auth = inject(AuthService);
  private notify = inject(NotificationService);

  readonly currentOrder = signal<Order | null>(null);
  readonly showDetailsModal = signal<boolean>(false);
  searchCode = '';

  readonly availableOrders = computed<Order[]>(() => {
    return this.ordersService.myOrders();
  });

  constructor() {
    effect(() => {
      const list = this.availableOrders();
      if (list.length > 0 && !this.currentOrder()) {
        this.currentOrder.set(list[0]);
        this.searchCode = list[0].codigoSeguimiento;
      }
    });
  }

  ngOnInit(): void {
    // 1. Cargar las órdenes del backend y del cliente
    this.ordersService.loadActiveOrders();
    this.ordersService.loadMyOrders();

    // 2. Comprobar parámetros de la URL
    this.route.queryParams.subscribe(params => {
      if (params['code']) {
        this.searchCode = params['code'];
        this.loadOrder(this.searchCode);
      }
    });
  }

  selectOrder(order: Order): void {
    this.currentOrder.set(order);
    this.searchCode = order.codigoSeguimiento;
  }

  loadOrder(code: string): void {
    if (!code) return;
    this.ordersService.getOrderByTrackingCode(code).subscribe({
      next: (found) => {
        if (found) {
          this.currentOrder.set(found);
          this.ordersService.registerClientOrder(found);
        } else {
          const matching = this.availableOrders().find(
            o => o.codigoSeguimiento.toUpperCase() === code.toUpperCase() || o.id === code.replace('POL-', '')
          );
          if (matching) {
            this.currentOrder.set(matching);
          }
        }
      },
      error: () => {
        const matching = this.availableOrders().find(
          o => o.codigoSeguimiento.toUpperCase() === code.toUpperCase() || o.id === code.replace('POL-', '')
        );
        if (matching) {
          this.currentOrder.set(matching);
        }
      }
    });
  }

  // ================= DYNAMIC STATUS HELPERS =================

  getMainTitle(): string {
    const status = this.currentOrder()?.estado;
    switch (status) {
      case 'COMPLETADO':
        return '¡PEDIDO ENTREGADO CON ÉXITO!';
      case 'EN_REPARTO':
        return 'EL FUEGO ESTÁ EN CAMINO';
      case 'LISTO_COCINA':
        return '¡PEDIDO LISTO EN SALIDA!';
      case 'EN_PREPARACION':
        return 'EL FUEGO ESTÁ EN LA COCINA';
      case 'PAGADO':
      case 'PENDIENTE_PAGO':
        return 'PEDIDO RECIBIDO Y CONFIRMADO';
      case 'CANCELADO':
        return 'PEDIDO CANCELADO';
      default:
        return 'ESTADO DEL PEDIDO';
    }
  }

  getSubtitle(): string {
    const status = this.currentOrder()?.estado;
    switch (status) {
      case 'COMPLETADO':
        return 'Tu pedido ha sido entregado. ¡Buen provecho y gracias por elegir San Pollo!';
      case 'EN_REPARTO':
        return 'Tu repartidor va en ruta a tu dirección. Tiempo estimado de entrega: 10 - 15 min.';
      case 'LISTO_COCINA':
        return 'Tu pedido ha salido del horno y está listo para ser despachado inmediatamente.';
      case 'EN_PREPARACION':
        return 'Nuestros maestros polleros están dorando tu pedido a la leña con papas crujientes.';
      case 'PAGADO':
      case 'PENDIENTE_PAGO':
        return 'Hemos registrado tu pedido y entra a comanda en cocina.';
      case 'CANCELADO':
        return 'Este pedido ha sido cancelado.';
      default:
        return 'Monitoreo en tiempo real del estado de tu comanda.';
    }
  }

  getProgressWidth(): string {
    const status = this.currentOrder()?.estado;
    switch (status) {
      case 'PENDIENTE_PAGO':
        return '10%';
      case 'PAGADO':
        return '25%';
      case 'EN_PREPARACION':
        return '50%';
      case 'LISTO_COCINA':
        return '65%';
      case 'EN_REPARTO':
        return '75%';
      case 'COMPLETADO':
        return '100%';
      case 'CANCELADO':
        return '0%';
      default:
        return '50%';
    }
  }

  isStepCompleted(step: number): boolean {
    const status = this.currentOrder()?.estado;
    if (!status) return false;

    switch (step) {
      case 1:
        return ['PAGADO', 'EN_PREPARACION', 'LISTO_COCINA', 'EN_REPARTO', 'COMPLETADO'].includes(status);
      case 2:
        return ['LISTO_COCINA', 'EN_REPARTO', 'COMPLETADO'].includes(status);
      case 3:
        return ['COMPLETADO'].includes(status);
      case 4:
        return status === 'COMPLETADO';
      default:
        return false;
    }
  }

  isStepActive(step: number): boolean {
    const status = this.currentOrder()?.estado;
    if (!status) return false;

    switch (step) {
      case 1:
        return status === 'PENDIENTE_PAGO' || status === 'PAGADO';
      case 2:
        return status === 'EN_PREPARACION';
      case 3:
        return status === 'LISTO_COCINA' || status === 'EN_REPARTO';
      case 4:
        return status === 'COMPLETADO';
      default:
        return false;
    }
  }

  getStepBadgeClass(step: number): string {
    if (this.isStepCompleted(step) && !this.isStepActive(step)) {
      return 'bg-polleria-gold text-slate-950 font-bold shadow-lg shadow-amber-500/30 ring-2 ring-polleria-gold/50';
    }
    if (this.isStepActive(step)) {
      if (step === 4) {
        return 'bg-emerald-500 text-slate-950 font-bold shadow-[0_0_20px_rgba(16,185,129,0.5)] ring-2 ring-emerald-400/50';
      }
      return 'bg-black border-2 border-polleria-gold text-polleria-gold shadow-[0_0_15px_rgba(245,158,11,0.4)]';
    }
    return 'bg-slate-800 text-slate-500 border border-slate-700 opacity-60';
  }

  getStepTextClass(step: number): string {
    if (this.isStepActive(step)) {
      return step === 4 ? 'text-emerald-400 font-extrabold' : 'text-polleria-gold font-extrabold';
    }
    if (this.isStepCompleted(step)) {
      return 'text-white font-bold';
    }
    return 'text-slate-500';
  }

  getStepSubtitle(step: number): string {
    const status = this.currentOrder()?.estado;
    switch (step) {
      case 1:
        return this.isStepCompleted(1) ? 'Confirmado' : 'Pendiente';
      case 2:
        return this.isStepActive(2) ? 'En el horno...' : (this.isStepCompleted(2) ? 'Listo' : 'Pendiente');
      case 3:
        return this.isStepActive(3) ? 'En ruta' : (this.isStepCompleted(3) ? 'Entregado' : 'Pendiente');
      case 4:
        return status === 'COMPLETADO' ? '¡Entregado!' : '--:--';
      default:
        return '';
    }
  }

  getStatusLabel(status: OrderStatus): string {
    switch (status) {
      case 'PENDIENTE_PAGO': return 'Pendiente';
      case 'PAGADO': return 'Pagado';
      case 'EN_PREPARACION': return 'En Preparación';
      case 'LISTO_COCINA': return 'Listo Cocina';
      case 'EN_REPARTO': return 'En Camino';
      case 'COMPLETADO': return 'Completado';
      case 'CANCELADO': return 'Cancelado';
      default: return status;
    }
  }

  toggleDetailsModal(open: boolean): void {
    this.showDetailsModal.set(open);
  }

  contactRider(): void {
    const repartidor = this.currentOrder()?.repartidorAsignado;
    const nombre = repartidor?.nombre || 'Carlos M.';
    const cel = repartidor?.celular || '+51 987 112 233';

    this.notify.showInfo(
      'Contacto con Motorizado',
      `Llamando al Rider: ${nombre} (${cel}) asignado a tu entrega.`
    );
  }

  searchOrder(): void {
    if (!this.searchCode) return;
    this.loadOrder(this.searchCode);
  }
}
