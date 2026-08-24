import { Component, inject, signal, computed, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { OrdersService } from '../../core/services/orders.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { OrderStatusBadgeComponent } from '../../shared/components/order-status-badge/order-status-badge.component';
import { CurrencyPENPipe } from '../../shared/pipes/currency-pen.pipe';
import { Order, OrderStatus } from '../../core/models/order.model';

export type KitchenTab = 'KDS' | 'DESPACHO_INSUMOS' | 'MERMAS';
export type KdsFilter = 'TODAS' | 'POR_PREPARAR' | 'EN_PREPARACION' | 'LISTOS';

export interface DespachoLoteInsumo {
  id: string;
  codigoLote: string;
  insumo: string;
  cantidad: string;
  solicitadoPor: string;
  hora: string;
  estado: 'DESPACHADO' | 'EN_TRANSITO' | 'PENDIENTE';
}

export interface MermaCierre {
  id: string;
  insumo: string;
  cantidad: string;
  motivo: string;
  costoEstimado: number;
  registradoPor: string;
  hora: string;
}

@Component({
  selector: 'app-kitchen-kds',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, OrderStatusBadgeComponent, CurrencyPENPipe],
  template: `
    <div class="min-h-screen bg-[#0d0e11] text-slate-100 font-sans selection:bg-polleria-gold selection:text-slate-900 flex flex-col md:flex-row">
      
      <!-- ================= SIDEBAR LATERAL COCINA / CHEF ================= -->
      <aside class="w-full md:w-64 bg-[#14161a] border-r border-white/10 flex flex-col shrink-0 md:sticky md:top-0 md:h-screen z-40">
        
        <!-- Sidebar Brand Header -->
        <div class="h-16 px-5 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
          <a routerLink="/" class="flex items-center gap-1.5 leading-none">
            <span class="font-display text-2xl font-black text-polleria-crimson tracking-wider">
              SAN POLLO
            </span>
            <span class="font-display text-2xl font-black text-amber-400 tracking-wider">
              COCINA
            </span>
          </a>
        </div>

        <!-- Sidebar Navigation Menu -->
        <nav class="flex-1 p-3.5 space-y-1 overflow-y-auto no-scrollbar">
          <div class="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 px-3 py-1.5">
            Producción & KDS
          </div>

          <button 
            type="button"
            (click)="activeTab.set('KDS')"
            class="w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold transition cursor-pointer"
            [ngClass]="activeTab() === 'KDS' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"/>
              </svg>
              <span>Comandas KDS</span>
            </div>
            <span class="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-xs">
              {{ kitchenOrdersCount() }}
            </span>
          </button>

          <button 
            type="button"
            (click)="activeTab.set('DESPACHO_INSUMOS')"
            class="w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold transition cursor-pointer"
            [ngClass]="activeTab() === 'DESPACHO_INSUMOS' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
              </svg>
              <span>Despacho de Insumos</span>
            </div>
          </button>

          <button 
            type="button"
            (click)="activeTab.set('MERMAS')"
            class="w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold transition cursor-pointer"
            [ngClass]="activeTab() === 'MERMAS' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
              <span>Registro de Mermas</span>
            </div>
          </button>
        </nav>

        <!-- Sidebar User Footer -->
        <div class="p-3 border-t border-white/10 bg-[#101215] shrink-0">
          <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/5">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-8 h-8 rounded-full ring-2 ring-amber-400 overflow-hidden bg-slate-800 flex items-center justify-center text-xs font-black text-amber-400 shrink-0 shadow">
                <span>{{ (authService.currentUser()?.nombre?.substring(0, 2) || 'CH') | uppercase }}</span>
              </div>
              <div class="flex flex-col text-left leading-tight min-w-0">
                <span class="text-xs font-bold text-white truncate">
                  {{ authService.currentUser()?.nombre || 'Chef Cocina' }}
                </span>
                <span class="text-[10px] font-mono text-amber-400 font-bold">
                  COCINA / HORNO
                </span>
              </div>
            </div>
            <button 
              type="button"
              (click)="cerrarSesion()"
              class="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/20 transition cursor-pointer shrink-0"
              title="Cerrar Sesión"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
            </button>
          </div>
        </div>

      </aside>

      <!-- ================= MAIN CONTENT WRAPPER ================= -->
      <div class="flex-1 flex flex-col min-w-0 min-h-screen bg-[#0d0e11] overflow-y-auto">
        
        <!-- Top Bar with Stats & Actions -->
        <header class="h-16 bg-[#14161a]/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-md">
          
          <div class="flex items-center gap-2.5">
            <h1 class="text-base sm:text-lg font-extrabold text-white tracking-wide uppercase">
              {{ getActiveTabLabel() }}
            </h1>
          </div>

          <div class="flex items-center gap-3">
            <div class="hidden sm:flex items-center gap-3 text-xs">
              <span class="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                🍳 En Preparación: {{ preparingCount() }}
              </span>
              <span class="px-3 py-1 rounded-xl bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                🔔 Listos para Reparto: {{ readyCount() }}
              </span>
            </div>

            @if (activeTab() === 'DESPACHO_INSUMOS') {
              <button 
                (click)="solicitarDespachoModal()"
                class="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow"
              >
                <span>+ Solicitar Lote</span>
              </button>
            } @else if (activeTab() === 'MERMAS') {
              <button 
                (click)="registrarMermaModal()"
                class="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow"
              >
                <span>+ Registrar Merma</span>
              </button>
            }
          </div>

        </header>

        <!-- ================= TAB 1: KDS COMANDAS EN VIVO ================= -->
        @if (activeTab() === 'KDS') {
          <main class="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-4">
            
            <!-- Filters Toolbar -->
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#14161a] p-3.5 rounded-2xl border border-white/10 shadow">
              <div class="flex items-center gap-1.5 text-xs bg-black/40 p-1 rounded-xl border border-white/5">
                <button 
                  type="button"
                  (click)="kdsFilter.set('TODAS')"
                  class="px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5"
                  [ngClass]="kdsFilter() === 'TODAS' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'"
                >
                  <span>Todas</span>
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" [ngClass]="kdsFilter() === 'TODAS' ? 'bg-black/20 text-slate-950' : 'bg-white/10 text-slate-300'">{{ kitchenOrdersCount() }}</span>
                </button>

                <button 
                  type="button"
                  (click)="kdsFilter.set('POR_PREPARAR')"
                  class="px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5"
                  [ngClass]="kdsFilter() === 'POR_PREPARAR' ? 'bg-rose-500 text-white shadow' : 'text-slate-400 hover:text-white'"
                >
                  <span>Por Preparar</span>
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" [ngClass]="kdsFilter() === 'POR_PREPARAR' ? 'bg-black/30 text-white' : 'bg-white/10 text-slate-300'">{{ pendingCount() }}</span>
                </button>

                <button 
                  type="button"
                  (click)="kdsFilter.set('EN_PREPARACION')"
                  class="px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5"
                  [ngClass]="kdsFilter() === 'EN_PREPARACION' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'"
                >
                  <span>En Horno / Fritura</span>
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" [ngClass]="kdsFilter() === 'EN_PREPARACION' ? 'bg-black/30 text-slate-950' : 'bg-white/10 text-slate-300'">{{ preparingCount() }}</span>
                </button>

                <button 
                  type="button"
                  (click)="kdsFilter.set('LISTOS')"
                  class="px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5"
                  [ngClass]="kdsFilter() === 'LISTOS' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'"
                >
                  <span>Listos en Empaque</span>
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" [ngClass]="kdsFilter() === 'LISTOS' ? 'bg-black/30 text-white' : 'bg-white/10 text-slate-300'">{{ readyCount() }}</span>
                </button>
              </div>

              <div class="text-xs text-slate-400 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Actualizado en tiempo real</span>
              </div>
            </div>

            <!-- Orders Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
              @for (order of filteredKitchenOrders(); track order.id) {
                <div 
                  class="rounded-3xl border flex flex-col justify-between transition-all duration-300 shadow-xl overflow-hidden"
                  [ngClass]="{
                    'border-rose-500/40 ring-1 ring-rose-500/20': order.estado === 'PAGADO' || order.estado === 'PENDIENTE_PAGO',
                    'border-amber-500/50 ring-1 ring-amber-500/30': order.estado === 'EN_PREPARACION',
                    'border-purple-500/50 ring-1 ring-purple-500/30': order.estado === 'LISTO_COCINA'
                  }"
                  style="background-color: #14161a;"
                >
                  <!-- Card Header -->
                  <div class="p-4 border-b border-white/10 flex justify-between items-start bg-black/40">
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="font-mono text-base font-black text-white">
                          #{{ getCodeNum(order.codigoSeguimiento) }}
                        </span>
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-slate-300">
                          {{ order.tipo }}
                        </span>
                      </div>
                      <h3 class="font-bold text-sm text-slate-200 mt-1">
                        {{ order.cliente.nombre || 'Cliente San Pollo' }}
                      </h3>
                      @if (order.cliente.direccion) {
                        <p class="text-[11px] text-slate-400 line-clamp-1">📍 {{ order.cliente.direccion }}</p>
                      }
                    </div>

                    <app-order-status-badge [status]="order.estado" />
                  </div>

                  <!-- Items List -->
                  <div class="p-4 flex-1 space-y-2.5 overflow-y-auto max-h-64">
                    @for (item of order.items; track item.product.id) {
                      <div class="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-start gap-3 text-xs">
                        <span class="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-extrabold text-sm shrink-0">
                          {{ item.cantidad }}x
                        </span>
                        <div class="flex-1">
                          <p class="font-bold text-slate-100 text-sm">{{ item.product.nombre }}</p>
                          @if (item.notas) {
                            <p class="text-amber-300 font-medium italic mt-0.5 bg-amber-950/40 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                              <span>⚠️ {{ item.notas }}</span>
                            </p>
                          }
                        </div>
                      </div>
                    }
                    @if (order.notasGenerales || order.cliente.referencia) {
                      <div class="p-2 rounded-lg bg-white/5 text-[11px] text-slate-400 italic">
                        Nota: {{ order.notasGenerales || order.cliente.referencia }}
                      </div>
                    }
                  </div>

                  <!-- Footer Action Button -->
                  <div class="p-4 border-t border-white/10 bg-black/40">
                    @if (order.estado === 'PAGADO' || order.estado === 'PENDIENTE_PAGO') {
                      <button 
                        (click)="cambiarEstadoOrden(order, 'EN_PREPARACION')"
                        class="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                      >
                        <span>🔥 Empezar a Preparar</span>
                      </button>
                    } @else if (order.estado === 'EN_PREPARACION') {
                      <button 
                        (click)="cambiarEstadoOrden(order, 'LISTO_COCINA')"
                        class="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg cursor-pointer animate-pulse"
                      >
                        <span>🔔 Listo para Reparto / Empacado</span>
                      </button>
                    } @else if (order.estado === 'LISTO_COCINA') {
                      <div class="flex items-center justify-center p-3 rounded-xl bg-purple-500/10 border border-purple-500/30">
                        <span class="text-xs text-purple-300 font-bold flex items-center gap-2">
                          <span class="w-2.5 h-2.5 rounded-full bg-purple-400 animate-ping"></span>
                          <span>📦 Empacado y Listo — Esperando que el motorizado retire el pedido</span>
                        </span>
                      </div>
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
                  <p class="text-xs text-slate-500 mt-1">Los nuevos pedidos de delivery aparecerán aquí automáticamente.</p>
                </div>
              }
            </div>

          </main>
        }

        <!-- ================= TAB 2: DESPACHO DE INSUMOS & LOTES ================= -->
        @if (activeTab() === 'DESPACHO_INSUMOS') {
          <main class="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
            
            <div class="bg-[#14161a] p-5 rounded-2xl border border-white/10 shadow flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h2 class="text-xl font-bold text-white flex items-center gap-2">
                  <span>Solicitud y Control de Lotes de Insumos hacia Cocina</span>
                </h2>
                <p class="text-xs text-slate-400">Registro de transferencia de materia prima perecible desde Almacén Central hacia la zona de producción.</p>
              </div>

              <button 
                (click)="solicitarDespachoModal()"
                class="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition cursor-pointer shadow"
              >
                + Solicitar Lote de Insumo
              </button>
            </div>

            <!-- Insumos Despachados Table -->
            <div class="bg-[#14161a] rounded-2xl border border-white/10 overflow-hidden shadow">
              <div class="p-4 border-b border-white/10 flex justify-between items-center">
                <h3 class="text-sm font-bold text-white">Lotes de Producción del Día</h3>
                <span class="text-xs text-slate-400">Turno Actual</span>
              </div>

              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs text-slate-300">
                  <thead class="bg-black/40 text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/10">
                    <tr>
                      <th class="p-3">Código Lote</th>
                      <th class="p-3">Insumo</th>
                      <th class="p-3">Cantidad</th>
                      <th class="p-3">Solicitante</th>
                      <th class="p-3">Hora Despacho</th>
                      <th class="p-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/5">
                    @for (d of despachos; track d.id) {
                      <tr class="hover:bg-white/5">
                        <td class="p-3 font-mono font-bold text-amber-400">{{ d.codigoLote }}</td>
                        <td class="p-3 font-bold text-white">{{ d.insumo }}</td>
                        <td class="p-3 font-mono">{{ d.cantidad }}</td>
                        <td class="p-3 text-slate-400">{{ d.solicitadoPor }}</td>
                        <td class="p-3 text-slate-400">{{ d.hora }}</td>
                        <td class="p-3">
                          <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                            {{ d.estado }}
                          </span>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>

          </main>
        }

        <!-- ================= TAB 3: REGISTRO DE MERMAS DEL CIERRE ================= -->
        @if (activeTab() === 'MERMAS') {
          <main class="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
            
            <div class="bg-[#14161a] p-5 rounded-2xl border border-white/10 shadow flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h2 class="text-xl font-bold text-white flex items-center gap-2">
                  <span>Registro de Mermas de Insumos Perecibles</span>
                </h2>
                <p class="text-xs text-slate-400">Declaración de productos no vendidos, mermas de cocción y descartes para cruce con finanzas e inventario.</p>
              </div>

              <button 
                (click)="registrarMermaModal()"
                class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition cursor-pointer shadow"
              >
                + Registrar Merma de Cierre
              </button>
            </div>

            <!-- Mermas Table -->
            <div class="bg-[#14161a] rounded-2xl border border-white/10 overflow-hidden shadow">
              <div class="p-4 border-b border-white/10 flex justify-between items-center">
                <h3 class="text-sm font-bold text-white">Mermas Declaradas de la Jornada</h3>
                <span class="text-xs text-rose-400 font-bold">Total Costo Pérdida: S/. 82.00</span>
              </div>

              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs text-slate-300">
                  <thead class="bg-black/40 text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/10">
                    <tr>
                      <th class="p-3">Insumo</th>
                      <th class="p-3">Cantidad Merma</th>
                      <th class="p-3">Motivo de Descarte</th>
                      <th class="p-3">Costo Pérdida</th>
                      <th class="p-3">Responsable</th>
                      <th class="p-3">Hora</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/5">
                    @for (m of mermas; track m.id) {
                      <tr class="hover:bg-white/5">
                        <td class="p-3 font-bold text-white">{{ m.insumo }}</td>
                        <td class="p-3 font-mono text-rose-300">{{ m.cantidad }}</td>
                        <td class="p-3 text-slate-300">{{ m.motivo }}</td>
                        <td class="p-3 font-display font-bold text-polleria-gold">{{ m.costoEstimado | currencyPEN }}</td>
                        <td class="p-3 text-slate-400">{{ m.registradoPor }}</td>
                        <td class="p-3 text-slate-400">{{ m.hora }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>

          </main>
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
  private pollingSub?: Subscription;

  readonly activeTab = signal<KitchenTab>('KDS');
  readonly kdsFilter = signal<KdsFilter>('TODAS');

  // Despachos Mock
  despachos: DespachoLoteInsumo[] = [
    { id: 'DSP-01', codigoLote: 'LOT-POL-2408', insumo: 'Pollos Frescos Eviscerados (Calibre 2.2kg)', cantidad: '30 unidades', solicitadoPor: 'Chef Mijael', hora: '14:30', estado: 'DESPACHADO' },
    { id: 'DSP-02', codigoLote: 'LOT-PAP-1102', insumo: 'Papa Amarilla Seleccionada para Fritura', cantidad: '50 kg', solicitadoPor: 'Chef Mijael', hora: '14:30', estado: 'DESPACHADO' },
    { id: 'DSP-03', codigoLote: 'LOT-CAR-0044', insumo: 'Carbón Vegetal de Algarrobo', cantidad: '3 sacos (75kg)', solicitadoPor: 'Chef Mijael', hora: '12:00', estado: 'DESPACHADO' }
  ];

  // Mermas Mock
  mermas: MermaCierre[] = [
    { id: 'MRM-01', insumo: 'Papa Amarilla Cortada', cantidad: '2.5 kg', motivo: 'Oxidación por tiempo de corte', costoEstimado: 18.00, registradoPor: 'Chef Mijael', hora: '15:30' },
    { id: 'MRM-02', insumo: 'Pollo a la Brasa (1/2)', cantidad: '1/2 unidad', motivo: 'Cocción excesiva / piel sobrecalentada', costoEstimado: 32.00, registradoPor: 'Chef Mijael', hora: '16:00' },
    { id: 'MRM-03', insumo: 'Ensalada Fresca Preparada', cantidad: '3 porciones', motivo: 'No comercializada / cierre de turno almuerzo', costoEstimado: 12.00, registradoPor: 'Chef Mijael', hora: '16:15' }
  ];

  readonly rawKitchenOrders = computed(() =>
    this.ordersService.orders().filter(o =>
      ['PAGADO', 'PENDIENTE_PAGO', 'EN_PREPARACION', 'LISTO_COCINA'].includes(o.estado)
    )
  );

  readonly kitchenOrdersCount = computed(() => this.rawKitchenOrders().length);

  readonly pendingCount = computed(() =>
    this.rawKitchenOrders().filter(o => o.estado === 'PAGADO' || o.estado === 'PENDIENTE_PAGO').length
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
      return list.filter(o => o.estado === 'PAGADO' || o.estado === 'PENDIENTE_PAGO');
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
        this.ordersService.loadActiveOrders();
      });
    }
  }

  ngOnDestroy(): void {
    if (this.pollingSub) {
      this.pollingSub.unsubscribe();
    }
  }

  getCodeNum(code: string): string {
    return code ? code.replace('POL-', '') : '1001';
  }

  getActiveTabLabel(): string {
    switch (this.activeTab()) {
      case 'KDS': return 'Comandas de Cocina & Horno en Vivo';
      case 'DESPACHO_INSUMOS': return 'Despacho de Lotes de Insumos';
      case 'MERMAS': return 'Registro de Mermas de Cierre';
      default: return 'Panel Cocina';
    }
  }

  cambiarEstadoOrden(order: Order, nuevoEstado: OrderStatus): void {
    this.ordersService.updateOrderStatus(order.id, nuevoEstado).subscribe({
      next: () => {
        this.notify.showSuccess(`Orden #${this.getCodeNum(order.codigoSeguimiento)} actualizada a ${nuevoEstado}`);
      },
      error: () => {
        this.notify.showError(`Error al actualizar la orden #${this.getCodeNum(order.codigoSeguimiento)}`);
      }
    });
  }

  solicitarDespachoModal(): void {
    this.despachos.unshift({
      id: `DSP-${Date.now()}`,
      codigoLote: `LOT-POL-${Math.floor(1000 + Math.random() * 9000)}`,
      insumo: 'Pollos Frescos Eviscerados',
      cantidad: '20 unidades',
      solicitadoPor: this.authService.currentUser()?.nombre || 'Chef Mijael',
      hora: new Date().toLocaleTimeString().slice(0, 5),
      estado: 'DESPACHADO'
    });
    this.notify.showSuccess('Despacho de Lote Solicitado', 'Almacén ha registrado la salida hacia cocina.');
  }

  registrarMermaModal(): void {
    this.mermas.unshift({
      id: `MRM-${Date.now()}`,
      insumo: 'Papa Amarilla Frita',
      cantidad: '1.5 kg',
      motivo: 'Merma por calibración de freidora',
      costoEstimado: 20.00,
      registradoPor: this.authService.currentUser()?.nombre || 'Chef Mijael',
      hora: new Date().toLocaleTimeString().slice(0, 5)
    });
    this.notify.showSuccess('Merma Registrada', 'Declaración enviada al balance de inventario y costos.');
  }

  cerrarSesion(): void {
    this.authService.logout();
    this.notify.showInfo('Sesión finalizada', 'Has salido de la vista de cocina.');
    this.router.navigate(['/login']);
  }
}
