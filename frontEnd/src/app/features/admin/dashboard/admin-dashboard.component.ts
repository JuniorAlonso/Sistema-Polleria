import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { OrdersService } from '../../../core/services/orders.service';
import { ProductsService } from '../../../core/services/products.service';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { NotificationService } from '../../../core/services/notification.service';
import { Order, OrderStatus } from '../../../core/models/order.model';
import { Product } from '../../../core/models/product.model';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CurrencyPENPipe],
  template: `
    <div class="min-h-screen bg-[#0d0e11] text-slate-100 font-sans selection:bg-polleria-gold selection:text-slate-900 flex flex-col">
      
      <!-- ================= TOP ADMIN NAVIGATION BAR (FIGMA EXACT) ================= -->
      <header class="h-16 bg-[#14161a] border-b border-white/10 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-40 shadow-lg">
        
        <!-- Left: Brand + Tabs -->
        <div class="flex items-center gap-6 sm:gap-10">
          
          <!-- Logo Display -->
          <a routerLink="/" class="flex items-center gap-1.5 leading-none">
            <span class="font-display text-2xl font-black text-polleria-crimson tracking-wider">
              SAN POLLO
            </span>
            <span class="font-display text-2xl font-black text-polleria-gold tracking-wider">
              ADMIN
            </span>
          </a>

          <!-- Navigation Tabs (Figma Exact) -->
          <nav class="flex items-center gap-6 text-xs sm:text-sm">
            <button 
              type="button"
              (click)="activeTab.set('ORDENES')"
              class="flex items-center gap-2 font-bold tracking-wide transition cursor-pointer"
              [ngClass]="activeTab() === 'ORDENES' ? 'text-polleria-gold border-b-2 border-polleria-gold pb-1' : 'text-slate-400 hover:text-white'"
            >
              <svg class="w-4 h-4 text-polleria-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/>
              </svg>
              <span>Órdenes</span>
            </button>

            <button 
              type="button"
              (click)="activeTab.set('INVENTARIO')"
              class="flex items-center gap-1.5 font-bold tracking-wide transition cursor-pointer"
              [ngClass]="activeTab() === 'INVENTARIO' ? 'text-polleria-gold border-b-2 border-polleria-gold pb-1' : 'text-slate-400 hover:text-white'"
            >
              <span>Inventario</span>
            </button>

            <button 
              type="button"
              (click)="activeTab.set('SOPORTE')"
              class="flex items-center gap-1.5 font-bold tracking-wide transition cursor-pointer"
              [ngClass]="activeTab() === 'SOPORTE' ? 'text-polleria-gold border-b-2 border-polleria-gold pb-1' : 'text-slate-400 hover:text-white'"
            >
              <span>Soporte</span>
            </button>
          </nav>

        </div>

        <!-- Right: Search + Notifications + Settings + Avatar (Figma Exact) -->
        <div class="flex items-center gap-3 sm:gap-4">
          
          <!-- Search input -->
          <div class="relative hidden sm:block">
            <input 
              type="text" 
              [(ngModel)]="searchQuery" 
              placeholder="Search orders..."
              class="w-48 lg:w-64 pl-9 pr-4 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-polleria-gold transition font-medium"
            />
            <svg class="w-4 h-4 text-slate-500 absolute left-3 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
          </div>

          <!-- Notification Bell with Counter -->
          <button 
            type="button"
            class="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
            </svg>
            <span class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500"></span>
          </button>

          <!-- Settings Icon -->
          <button 
            type="button"
            class="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer hidden sm:block"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </button>

          <!-- User Avatar -->
          <div class="w-8 h-8 rounded-full ring-2 ring-polleria-crimson overflow-hidden bg-slate-800 flex items-center justify-center text-xs font-bold text-white">
            <span>ADM</span>
          </div>

        </div>

      </header>


      <!-- ================= TAB 1: KANBAN PRODUCTION BOARD (FIGMA EXACT) ================= -->
      @if (activeTab() === 'ORDENES') {
        <main class="flex-1 p-4 sm:p-6 overflow-x-auto">
          
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 min-w-[960px] h-[calc(100vh-100px)]">
            
            <!-- COLUMN 1: NUEVAS ORDENES (Figma Exact) -->
            <div class="bg-[#121418] rounded-2xl border border-white/5 flex flex-col overflow-hidden shadow-xl">
              
              <!-- Column Header -->
              <div class="p-4 border-b border-white/5 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                  <h2 class="font-display text-lg tracking-wider uppercase text-white font-bold">
                    NUEVAS ORDENES
                  </h2>
                </div>
                <span class="w-6 h-6 rounded-full bg-rose-600 text-white text-xs font-black flex items-center justify-center font-mono">
                  {{ getNewOrders().length }}
                </span>
              </div>

              <!-- Orders Cards List -->
              <div class="flex-1 p-3 space-y-3 overflow-y-auto">
                @for (order of getNewOrders(); track order.id) {
                  <div class="p-4 rounded-xl bg-[#1c1f24] border border-white/5 hover:border-slate-600 transition space-y-3 shadow-md">
                    
                    <!-- Card Header -->
                    <div class="flex items-center justify-between">
                      <span class="font-mono text-base font-black text-white">
                        #{{ getCodeNum(order.codigoSeguimiento) }}
                      </span>
                      <span class="px-2 py-0.5 rounded bg-white/10 text-slate-300 text-[10px] font-mono font-bold">
                        2m
                      </span>
                    </div>

                    <!-- Items -->
                    <div class="text-xs text-slate-300 space-y-1">
                      @for (item of order.items; track item.product.id) {
                        <p class="line-clamp-1">
                          <strong class="text-white">{{ item.cantidad }}x</strong> {{ item.product.nombre }}
                        </p>
                      }
                      @if (order.cliente.referencia) {
                        <p class="text-[11px] text-slate-400 italic">
                          Note: {{ order.cliente.referencia }}
                        </p>
                      }
                    </div>

                    <!-- Price & Action Button (ACCEPT) -->
                    <div class="pt-2 border-t border-white/5 flex items-center justify-between">
                      <span class="font-display text-xl font-bold text-polleria-gold">
                        {{ order.total | currencyPEN }}
                      </span>

                      <button 
                        (click)="advanceOrderStatus(order, 'EN_PREPARACION')"
                        class="px-4 py-1.5 rounded-lg bg-[#2a2e36] hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-xs"
                      >
                        ACCEPT
                      </button>
                    </div>

                  </div>
                }
              </div>

            </div>


            <!-- COLUMN 2: PREPARANDOSE (Figma Exact) -->
            <div class="bg-[#383a42] rounded-2xl border border-white/10 flex flex-col overflow-hidden shadow-xl">
              
              <!-- Column Header -->
              <div class="p-4 border-b border-white/10 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                  <h2 class="font-display text-lg tracking-wider uppercase text-white font-bold">
                    PREPARANDOSE
                  </h2>
                </div>
                <span class="w-6 h-6 rounded-full bg-black/40 text-white text-xs font-black flex items-center justify-center font-mono">
                  {{ getPreparingOrders().length }}
                </span>
              </div>

              <!-- Orders Cards List -->
              <div class="flex-1 p-3 space-y-3 overflow-y-auto">
                @for (order of getPreparingOrders(); track order.id) {
                  <div class="p-4 rounded-xl bg-[#1c1f24] border-l-4 border-l-amber-400 border-white/5 space-y-3 shadow-md">
                    
                    <!-- Card Header -->
                    <div class="flex items-center justify-between">
                      <span class="font-mono text-base font-black text-white">
                        #{{ getCodeNum(order.codigoSeguimiento) }}
                      </span>
                      <span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">
                        12m prep
                      </span>
                    </div>

                    <!-- Items -->
                    <div class="text-xs text-slate-300 space-y-1">
                      @for (item of order.items; track item.product.id) {
                        <p class="line-clamp-1">
                          <strong class="text-white">{{ item.cantidad }}x</strong> {{ item.product.nombre }}
                        </p>
                      }
                    </div>

                    <!-- Bottom: Chef indicator & LISTO button -->
                    <div class="pt-2 border-t border-white/5 flex items-center justify-between">
                      <div class="flex items-center gap-1.5 text-xs text-slate-400">
                        <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"/>
                        </svg>
                        <span>Horno</span>
                      </div>

                      <button 
                        (click)="advanceOrderStatus(order, 'EN_REPARTO')"
                        class="px-4 py-1.5 rounded-lg bg-[#2a2e36] hover:bg-purple-600 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-xs"
                      >
                        LISTO
                      </button>
                    </div>

                  </div>
                }
              </div>

            </div>


            <!-- COLUMN 3: ENVIADO (Figma Exact) -->
            <div class="bg-[#eceef1] text-slate-900 rounded-2xl border border-slate-300 flex flex-col overflow-hidden shadow-xl">
              
              <!-- Column Header -->
              <div class="p-4 border-b border-slate-300 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <svg class="w-5 h-5 text-slate-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h2m-6 0a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/>
                  </svg>
                  <h2 class="font-display text-lg tracking-wider uppercase text-slate-950 font-bold">
                    ENVIADO
                  </h2>
                </div>
                <span class="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-black flex items-center justify-center font-mono">
                  {{ getDispatchedOrders().length }}
                </span>
              </div>

              <!-- Orders Cards List -->
              <div class="flex-1 p-3 space-y-3 overflow-y-auto">
                @for (order of getDispatchedOrders(); track order.id) {
                  <div class="p-4 rounded-xl bg-[#1c1f24] text-white border border-white/5 space-y-3 shadow-md">
                    
                    <!-- Card Header -->
                    <div class="flex items-center justify-between">
                      <span class="font-bold text-xs text-slate-200">
                        {{ order.tipo === 'DELIVERY' ? 'Motorizado - John D.' : 'Salón / Tienda' }}
                      </span>
                      <span class="px-2 py-0.5 rounded bg-white/10 text-slate-300 text-[10px] font-mono font-bold">
                        En camino
                      </span>
                    </div>

                    <!-- Items -->
                    <div class="text-xs text-slate-400 space-y-1">
                      @for (item of order.items; track item.product.id) {
                        <p class="line-clamp-1">{{ item.cantidad }}x {{ item.product.nombre }}</p>
                      }
                    </div>

                    <!-- Bottom -->
                    <div class="pt-2 border-t border-white/5 flex items-center justify-between">
                      <span class="font-display text-xl font-bold text-rose-500">
                        {{ order.total | currencyPEN }}
                      </span>

                      <button 
                        (click)="advanceOrderStatus(order, 'COMPLETADO')"
                        class="px-3.5 py-1 rounded bg-rose-600 hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                        title="Marcar como entregado"
                      >
                        LIBRE
                      </button>
                    </div>

                  </div>
                }
              </div>

            </div>


            <!-- COLUMN 4: COMPLETADO (Figma Exact Golden Column) -->
            <div class="bg-[#f59e0b] text-slate-950 rounded-2xl border border-amber-600 flex flex-col overflow-hidden shadow-2xl">
              
              <!-- Column Header (Figma Exact) -->
              <div class="p-4 border-b border-amber-600/30 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <svg class="w-5 h-5 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <h2 class="font-display text-lg tracking-wider uppercase text-slate-950 font-black">
                    COMPLETADO
                  </h2>
                </div>
                <span class="w-6 h-6 rounded-full bg-slate-950 text-white text-xs font-black flex items-center justify-center font-mono">
                  {{ getCompletedOrders().length + 22 }}
                </span>
              </div>

              <!-- Orders Cards List (Dark Cards inside Gold Column) -->
              <div class="flex-1 p-3 space-y-3 overflow-y-auto">
                
                <!-- Demo Card 1034 -->
                <div class="p-4 rounded-xl bg-[#26282e] text-white border border-white/10 space-y-2 shadow-md">
                  <div class="flex items-center justify-between">
                    <span class="font-mono text-base font-black text-white">#1034</span>
                    <span class="text-[11px] text-slate-400 font-mono">14:22</span>
                  </div>
                  <p class="text-xs text-slate-300">Completado: Mesa 4</p>
                  <div class="text-right text-polleria-gold">
                    <svg class="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
                    </svg>
                  </div>
                </div>

                <!-- Demo Card 1033 -->
                <div class="p-4 rounded-xl bg-[#26282e] text-white border border-white/10 space-y-2 shadow-md">
                  <div class="flex items-center justify-between">
                    <span class="font-mono text-base font-black text-white">#1033</span>
                    <span class="text-[11px] text-slate-400 font-mono">14:15</span>
                  </div>
                  <p class="text-xs text-slate-300">Recogido: Sarah M.</p>
                  <div class="text-right text-polleria-gold">
                    <svg class="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
                    </svg>
                  </div>
                </div>

                @for (order of getCompletedOrders(); track order.id) {
                  <div class="p-4 rounded-xl bg-[#26282e] text-white border border-white/10 space-y-2 shadow-md">
                    <div class="flex items-center justify-between">
                      <span class="font-mono text-base font-black text-white">
                        #{{ getCodeNum(order.codigoSeguimiento) }}
                      </span>
                      <span class="text-[11px] text-slate-400 font-mono">Entregado</span>
                    </div>
                    <p class="text-xs text-slate-300">{{ order.cliente.nombre }}</p>
                    <div class="flex justify-between items-center pt-1 border-t border-white/5">
                      <span class="font-display text-sm text-polleria-gold">{{ order.total | currencyPEN }}</span>
                      <svg class="w-4 h-4 text-polleria-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
                      </svg>
                    </div>
                  </div>
                }

              </div>

            </div>

          </div>

        </main>
      }


      <!-- ================= TAB 2: INVENTARIO & STOCK ================= -->
      @if (activeTab() === 'INVENTARIO') {
        <main class="flex-1 p-6 max-w-6xl mx-auto w-full space-y-6">
          <div class="flex justify-between items-center">
            <div>
              <h2 class="text-2xl font-bold text-white">Inventario & Control de Carta</h2>
              <p class="text-xs text-slate-400">Control de platos agotados y precios en tiempo real.</p>
            </div>
          </div>

          <div class="bg-[#14161a] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
            <table class="w-full text-left text-xs">
              <thead class="bg-black/40 border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th class="p-4">Plato</th>
                  <th class="p-4">Categoría</th>
                  <th class="p-4">Precio</th>
                  <th class="p-4 text-center">Disponibilidad</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5">
                @for (p of productsService.products(); track p.id) {
                  <tr class="hover:bg-white/5 transition">
                    <td class="p-4 font-bold text-white">{{ p.nombre }}</td>
                    <td class="p-4 text-slate-400">{{ p.categoria }}</td>
                    <td class="p-4 font-mono font-bold text-polleria-gold">{{ p.precio | currencyPEN }}</td>
                    <td class="p-4 text-center">
                      <button 
                        (click)="productsService.toggleAgotado(p.id)"
                        class="px-3.5 py-1 rounded-full text-xs font-bold transition cursor-pointer"
                        [ngClass]="p.agotado ? 'bg-rose-600/30 text-rose-400 border border-rose-500/30' : 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/30'"
                      >
                        {{ p.agotado ? 'AGOTADO' : 'DISPONIBLE' }}
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </main>
      }

      <!-- ================= TAB 3: SOPORTE ================= -->
      @if (activeTab() === 'SOPORTE') {
        <main class="flex-1 p-8 max-w-3xl mx-auto w-full text-center space-y-4">
          <div class="w-16 h-16 rounded-full bg-polleria-crimson/20 text-polleria-crimson flex items-center justify-center mx-auto">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"/>
            </svg>
          </div>
          <h2 class="text-2xl font-bold text-white">Centro de Operaciones San Pollo</h2>
          <p class="text-sm text-slate-400 max-w-md mx-auto">
            Línea directa con el equipo de soporte técnico y caja.
          </p>
          <div class="p-4 rounded-xl bg-[#14161a] border border-white/10 text-xs font-mono text-slate-300">
            Soporte Central: +51 987 654 321 • Anexo 104
          </div>
        </main>
      }

    </div>
  `
})
export class AdminDashboardComponent {
  readonly ordersService = inject(OrdersService);
  readonly productsService = inject(ProductsService);
  private notify = inject(NotificationService);

  readonly activeTab = signal<'ORDENES' | 'INVENTARIO' | 'SOPORTE'>('ORDENES');
  searchQuery = '';

  getCodeNum(code: string): string {
    return code ? code.replace('POL-', '') : '1001';
  }

  getNewOrders(): Order[] {
    return this.ordersService.orders().filter(o => 
      o.estado === 'PENDIENTE_PAGO' || o.estado === 'PAGADO'
    );
  }

  getPreparingOrders(): Order[] {
    return this.ordersService.orders().filter(o => 
      o.estado === 'EN_PREPARACION' || o.estado === 'LISTO_COCINA'
    );
  }

  getDispatchedOrders(): Order[] {
    return this.ordersService.orders().filter(o => 
      o.estado === 'EN_REPARTO'
    );
  }

  getCompletedOrders(): Order[] {
    return this.ordersService.orders().filter(o => 
      o.estado === 'COMPLETADO'
    );
  }

  advanceOrderStatus(order: Order, nextStatus: OrderStatus): void {
    this.ordersService.updateOrderStatus(order.id, nextStatus);
    this.notify.showSuccess(`Orden #${this.getCodeNum(order.codigoSeguimiento)} movida a ${nextStatus}`);
  }
}
