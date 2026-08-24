import { Component, inject, signal, computed, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { OrdersService } from '../../core/services/orders.service';
import { PaymentService } from '../../core/services/payment.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { CurrencyPENPipe } from '../../shared/pipes/currency-pen.pipe';
import { Order, OrderStatus } from '../../core/models/order.model';

export type DeliveryTab = 'ENTREGAS_ACTIVAS' | 'MAPA_RUTA' | 'COBROS_RENDICION' | 'HISTORIAL';
export type DeliverySubFilter = 'TODAS' | 'POR_RECOGER' | 'EN_RUTA';

@Component({
  selector: 'app-repartidor-delivery',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CurrencyPENPipe],
  template: `
    <div class="min-h-screen bg-[#0d0e11] text-slate-100 font-sans selection:bg-polleria-gold selection:text-slate-900 flex flex-col md:flex-row">
      
      <!-- ================= SIDEBAR LATERAL REPARTIDOR ================= -->
      <aside class="w-full md:w-64 bg-[#14161a] border-r border-white/10 flex flex-col shrink-0 md:sticky md:top-0 md:h-screen z-40">
        
        <!-- Sidebar Header -->
        <div class="h-16 px-5 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
          <a routerLink="/" class="flex items-center gap-1.5 leading-none">
            <span class="font-display text-2xl font-black text-polleria-crimson tracking-wider">
              SAN POLLO
            </span>
            <span class="font-display text-2xl font-black text-sky-400 tracking-wider">
              REPARTO
            </span>
          </a>
        </div>

        <!-- Sidebar Navigation Menu -->
        <nav class="flex-1 p-3.5 space-y-1 overflow-y-auto no-scrollbar">
          <div class="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 px-3 py-1.5">
            Flota & Delivery
          </div>

          <button 
            type="button"
            (click)="activeTab.set('ENTREGAS_ACTIVAS')"
            class="w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold transition cursor-pointer"
            [ngClass]="activeTab() === 'ENTREGAS_ACTIVAS' ? 'bg-sky-500/15 text-sky-400 border border-sky-500/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-sky-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h2m-6 0a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/>
              </svg>
              <span>Mis Entregas Activas</span>
            </div>
            <span class="px-2 py-0.5 rounded-full bg-sky-500 text-slate-950 font-black text-xs">
              {{ activeDeliveryOrders().length }}
            </span>
          </button>

          <button 
            type="button"
            (click)="activeTab.set('MAPA_RUTA')"
            class="w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold transition cursor-pointer"
            [ngClass]="activeTab() === 'MAPA_RUTA' ? 'bg-sky-500/15 text-sky-400 border border-sky-500/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-sky-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
              </svg>
              <span>Ruta & GPS Ica</span>
            </div>
          </button>

          <div class="pt-3 pb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 px-3">
            Liquidación & Caja
          </div>

          <button 
            type="button"
            (click)="activeTab.set('COBROS_RENDICION')"
            class="w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold transition cursor-pointer"
            [ngClass]="activeTab() === 'COBROS_RENDICION' ? 'bg-sky-500/15 text-sky-400 border border-sky-500/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-polleria-gold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span>Arqueo de Efectivo</span>
            </div>
          </button>

          <button 
            type="button"
            (click)="activeTab.set('HISTORIAL')"
            class="w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold transition cursor-pointer"
            [ngClass]="activeTab() === 'HISTORIAL' ? 'bg-sky-500/15 text-sky-400 border border-sky-500/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span>Historial del Día</span>
            </div>
            <span class="px-2 py-0.5 rounded-md bg-black/40 text-[11px] font-bold text-slate-300">
              {{ completedDeliveryOrders().length }}
            </span>
          </button>
        </nav>

        <!-- Sidebar User Footer -->
        <div class="p-3 border-t border-white/10 bg-[#101215] shrink-0">
          <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/5">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-8 h-8 rounded-full ring-2 ring-sky-400 overflow-hidden bg-slate-800 flex items-center justify-center text-xs font-black text-sky-400 shrink-0 shadow">
                <span>{{ (auth.currentUser()?.nombre?.substring(0, 2) || 'RP') | uppercase }}</span>
              </div>
              <div class="flex flex-col text-left leading-tight min-w-0">
                <span class="text-xs font-bold text-white truncate">
                  {{ auth.currentUser()?.nombre || 'Mitrufely Repartidor' }}
                </span>
                <span class="text-[10px] font-mono text-sky-400 font-bold">
                  MOTORIZADO #04
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
        
        <!-- Top Bar -->
        <header class="h-16 bg-[#14161a]/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-md">
          
          <div class="flex items-center gap-2.5">
            <h1 class="text-base sm:text-lg font-extrabold text-white tracking-wide uppercase">
              {{ getActiveTabLabel() }}
            </h1>
          </div>

          <!-- Quick Stats Top -->
          <div class="flex items-center gap-3">
            <div class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs">
              <span class="text-slate-400">Total Efectivo a Rendir:</span>
              <span class="font-display font-bold text-polleria-gold">{{ totalEfectivoARendir() | currencyPEN }}</span>
            </div>

            <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-bold">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>GPS Activo (Ica)</span>
            </div>
          </div>

        </header>

        <!-- ================= TAB 1: ENTREGAS ACTIVAS ================= -->
        @if (activeTab() === 'ENTREGAS_ACTIVAS') {
          <main class="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-4">
            
            <!-- Filters Toolbar -->
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#14161a] p-3.5 rounded-2xl border border-white/10 shadow">
              <div class="flex items-center gap-1.5 text-xs bg-black/40 p-1 rounded-xl border border-white/5">
                <button 
                  type="button"
                  (click)="subFilter.set('TODAS')"
                  class="px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5"
                  [ngClass]="subFilter() === 'TODAS' ? 'bg-sky-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'"
                >
                  <span>Todas Activas</span>
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" [ngClass]="subFilter() === 'TODAS' ? 'bg-black/20 text-slate-950' : 'bg-white/10 text-slate-300'">{{ activeDeliveryOrders().length }}</span>
                </button>

                <button 
                  type="button"
                  (click)="subFilter.set('POR_RECOGER')"
                  class="px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5"
                  [ngClass]="subFilter() === 'POR_RECOGER' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'"
                >
                  <span>Por Recoger en Cocina</span>
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" [ngClass]="subFilter() === 'POR_RECOGER' ? 'bg-black/30 text-white' : 'bg-white/10 text-slate-300'">{{ readyForPickupOrders().length }}</span>
                </button>

                <button 
                  type="button"
                  (click)="subFilter.set('EN_RUTA')"
                  class="px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5"
                  [ngClass]="subFilter() === 'EN_RUTA' ? 'bg-sky-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'"
                >
                  <span>En Ruta</span>
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" [ngClass]="subFilter() === 'EN_RUTA' ? 'bg-black/30 text-slate-950' : 'bg-white/10 text-slate-300'">{{ inRouteOrders().length }}</span>
                </button>
              </div>

              <span class="text-xs text-slate-400">Actualización en vivo cada 2.5s</span>
            </div>

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
                <div class="p-5 rounded-2xl bg-[#14161a] border border-white/10 shadow-xl space-y-4 hover:border-sky-500/40 transition">
                  
                  <!-- Header Card -->
                  <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-3 border-b border-white/10">
                    <div class="flex items-center gap-3">
                      <span class="font-mono text-xl font-black text-white">
                        #{{ getCodeNum(order.codigoSeguimiento) }}
                      </span>
                      <span class="px-2.5 py-0.5 rounded-full text-xs font-bold" [ngClass]="{
                        'bg-rose-500/20 text-rose-300': order.estado === 'PAGADO' || order.estado === 'PENDIENTE_PAGO',
                        'bg-amber-500/20 text-amber-300': order.estado === 'EN_PREPARACION',
                        'bg-purple-500/20 text-purple-300': order.estado === 'LISTO_COCINA',
                        'bg-sky-500/20 text-sky-300': order.estado === 'EN_REPARTO'
                      }">
                        {{ order.estado === 'LISTO_COCINA' ? 'LISTO PARA RECOGER' : order.estado }}
                      </span>
                    </div>

                    <div class="flex items-center gap-3">
                      <span class="font-display text-xl font-bold text-polleria-gold">
                        {{ order.total | currencyPEN }}
                      </span>
                    </div>
                  </div>

                  <!-- Client & Address Info -->
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div class="space-y-1">
                      <span class="text-slate-400 font-bold">Cliente:</span>
                      <p class="text-sm font-bold text-white">{{ order.cliente.nombre || 'Cliente San Pollo' }}</p>
                      <div class="flex items-center gap-2 pt-1">
                        @if (order.cliente.celular) {
                          <a 
                            [href]="'tel:' + order.cliente.celular"
                            class="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 flex items-center gap-1 transition font-mono font-bold"
                          >
                            📞 {{ order.cliente.celular }}
                          </a>
                          <button 
                            (click)="enviarWhatsAppCliente(order)"
                            class="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white flex items-center gap-1 transition cursor-pointer font-bold"
                            title="Enviar WhatsApp directo al cliente"
                          >
                            💬 WhatsApp
                          </button>
                        }
                      </div>
                    </div>

                    <div class="space-y-1">
                      <span class="text-slate-400 font-bold">Dirección de Entrega:</span>
                      <p class="text-slate-200 font-medium">{{ order.cliente.direccion || 'Ica, Perú' }}</p>
                      @if (order.cliente.referencia || order.notasGenerales) {
                        <p class="text-[11px] text-slate-400 italic">Ref: {{ order.cliente.referencia || order.notasGenerales }}</p>
                      }
                      @if (order.cliente.direccion) {
                        <a 
                          [href]="'https://www.google.com/maps/search/?api=1&query=' + encodeUri(order.cliente.direccion + ', Ica, Peru')"
                          target="_blank"
                          class="inline-flex items-center gap-1 text-sky-400 hover:underline pt-1 font-bold"
                        >
                          📍 Ver en Google Maps / Waze
                        </a>
                      }
                    </div>
                  </div>

                  <!-- Products Summary -->
                  <div class="p-3 rounded-xl bg-black/40 border border-white/5 text-xs space-y-1">
                    <span class="text-slate-400 font-bold block">Contenido del Pedido:</span>
                    @for (item of order.items; track item.product.id) {
                      <p class="text-slate-300"><strong class="text-white">{{ item.cantidad }}x</strong> {{ item.product.nombre }}</p>
                    }
                  </div>

                  <!-- Action Buttons Steps -->
                  <div class="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
                    <div class="text-xs text-slate-400">
                      <span>Método de pago: </span>
                      <span class="font-bold text-white font-mono">{{ order.metodoPago || 'CONTRAENTREGA' }}</span>
                    </div>

                    <div class="flex items-center gap-2">
                      @if (order.estado === 'LISTO_COCINA') {
                        <button 
                          (click)="avanzarAReparto(order)"
                          class="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-lg flex items-center gap-1.5"
                        >
                          <span>🛵 Tomar y Empezar Reparto</span>
                        </button>
                      } @else if (order.estado === 'EN_PREPARACION' || order.estado === 'PAGADO' || order.estado === 'PENDIENTE_PAGO') {
                        <span class="text-xs text-amber-400/90 font-medium px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-1.5">
                          <span>⏳ En cocina / horno — Aún no listo</span>
                        </span>
                      } @else if (order.estado === 'EN_REPARTO') {
                        <button 
                          (click)="abrirModalCobroEntrega(order)"
                          class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-lg animate-pulse flex items-center gap-1.5"
                        >
                          <span>✓ Entregar y Cobrar Pedido</span>
                        </button>
                      }
                    </div>
                  </div>

                </div>
              }
            </div>

          </main>
        }

        <!-- ================= TAB 2: MAPA DE RUTA ================= -->
        @if (activeTab() === 'MAPA_RUTA') {
          <main class="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">
            
            <div class="bg-[#14161a] p-4 rounded-2xl border border-white/10 shadow flex justify-between items-center">
              <div>
                <h2 class="text-lg font-bold text-white flex items-center gap-2">
                  <span>Ruta Satelital y Cobertura de Reparto en Ica</span>
                </h2>
                <p class="text-xs text-slate-400">Visualización de ruta optimizada desde el local (Av. San Martín) hacia las direcciones de entrega.</p>
              </div>
            </div>

            <!-- Simulated Interactive Map Card -->
            <div class="bg-[#14161a] rounded-2xl border border-white/10 p-6 shadow-xl relative overflow-hidden h-[420px] flex flex-col justify-between">
              
              <div class="absolute inset-0 opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]"></div>

              <div class="relative z-10 flex items-center justify-between">
                <div class="p-3 rounded-xl bg-polleria-crimson text-white font-bold text-xs flex items-center gap-2 shadow-lg">
                  <span>🍗 Local San Pollo (Av. San Martín 450, Ica)</span>
                </div>
                <div class="text-xs font-mono text-sky-400 bg-black/60 px-3 py-1.5 rounded-xl border border-white/10">
                  En ruta: {{ inRouteOrders().length }} pedidos
                </div>
              </div>

              <!-- Markers List on Map -->
              <div class="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
                @for (order of inRouteOrders(); track order.id) {
                  <div class="p-3 rounded-xl bg-black/70 border border-sky-500/30 text-xs space-y-1 shadow">
                    <div class="flex justify-between items-center">
                      <span class="font-bold text-white">Destino: #{{ getCodeNum(order.codigoSeguimiento) }}</span>
                      <span class="text-sky-400 font-mono">{{ order.total | currencyPEN }}</span>
                    </div>
                    <p class="text-slate-300 truncate">{{ order.cliente.direccion || 'Ica' }}</p>
                    <span class="text-[10px] text-amber-400 font-bold">{{ order.cliente.nombre }}</span>
                  </div>
                }
              </div>

              <!-- Map Footer -->
              <div class="relative z-10 flex justify-between items-center text-xs text-slate-400 pt-3 border-t border-white/10">
                <span>Zona de cobertura: Cercado Ica, San Joaquín, La Tinguiña, Parcona.</span>
                <span class="text-emerald-400 font-bold">Base de despacho: San Martín</span>
              </div>

            </div>

          </main>
        }

        <!-- ================= TAB 3: COBROS & ARQUEO DE EFECTIVO ================= -->
        @if (activeTab() === 'COBROS_RENDICION') {
          <main class="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-6">
            
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 shadow">
                <span class="text-xs text-slate-400 font-medium">Efectivo Cobrado Hoy</span>
                <p class="font-display text-3xl font-black text-polleria-gold mt-1">{{ totalEfectivoARendir() | currencyPEN }}</p>
              </div>
              <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 shadow">
                <span class="text-xs text-slate-400 font-medium">Digital (Tarjeta / Yape)</span>
                <p class="font-display text-3xl font-black text-purple-400 mt-1">{{ totalDigitalCobrado() | currencyPEN }}</p>
              </div>
              <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 shadow">
                <span class="text-xs text-slate-400 font-medium">Entregas Validadas</span>
                <p class="font-display text-3xl font-black text-emerald-400 mt-1">{{ completedDeliveryOrders().length }}</p>
              </div>
            </div>

            <!-- Rendición Form Card -->
            <div class="bg-[#14161a] p-6 rounded-2xl border border-white/10 shadow-xl space-y-4">
              <div class="pb-3 border-b border-white/10">
                <h3 class="text-base font-bold text-white">Hoja de Liquidación de Caja al Administrador</h3>
                <p class="text-xs text-slate-400">Rinde los cobros en efectivo acumulados durante el turno para liberar tu cuenta.</p>
              </div>

              <div class="space-y-3 text-xs">
                <div class="flex justify-between items-center p-3 rounded-xl bg-white/5">
                  <span class="text-slate-300">Total en Efectivo por Entregar en Caja:</span>
                  <span class="font-display text-xl font-bold text-polleria-gold">{{ totalEfectivoARendir() | currencyPEN }}</span>
                </div>

                <div class="flex justify-between items-center p-3 rounded-xl bg-white/5">
                  <span class="text-slate-300">Base / Fondo de Vueltos Inicial:</span>
                  <span class="font-mono text-white font-bold">S/. 100.00</span>
                </div>
              </div>

              <button 
                (click)="rendirCajaModal()"
                class="w-full py-3 rounded-xl bg-polleria-gold hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-lg"
              >
                💵 Rendir Efectivo y Cerrar Liquidación
              </button>
            </div>

          </main>
        }

        <!-- ================= TAB 4: HISTORIAL DE ENTREGAS DEL DÍA ================= -->
        @if (activeTab() === 'HISTORIAL') {
          <main class="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
            
            <div class="bg-[#14161a] rounded-2xl border border-white/10 overflow-hidden shadow">
              <div class="p-4 border-b border-white/10 flex justify-between items-center">
                <h3 class="text-sm font-bold text-white">Historial de Repartos Completados</h3>
                <span class="text-xs text-slate-400">Total: {{ completedDeliveryOrders().length }} pedidos</span>
              </div>

              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs text-slate-300">
                  <thead class="bg-black/40 text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/10">
                    <tr>
                      <th class="p-3">Pedido</th>
                      <th class="p-3">Cliente</th>
                      <th class="p-3">Dirección</th>
                      <th class="p-3">Método Pago</th>
                      <th class="p-3">Monto</th>
                      <th class="p-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/5">
                    @for (order of completedDeliveryOrders(); track order.id) {
                      <tr class="hover:bg-white/5">
                        <td class="p-3 font-mono font-bold text-white">#{{ getCodeNum(order.codigoSeguimiento) }}</td>
                        <td class="p-3 font-bold">{{ order.cliente.nombre }}</td>
                        <td class="p-3 text-slate-400">{{ order.cliente.direccion }}</td>
                        <td class="p-3 font-mono text-sky-400">{{ order.metodoPago || 'CONTRAENTREGA' }}</td>
                        <td class="p-3 font-display font-bold text-polleria-gold">{{ order.total | currencyPEN }}</td>
                        <td class="p-3">
                          <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                            ✓ Entregado
                          </span>
                        </td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="6" class="p-8 text-center text-slate-500">
                          Aún no se han completado entregas en este turno.
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>

          </main>
        }

        <!-- ================= MODAL COBRO CONTRAENTREGA ================= -->
        @if (selectedOrderModal()) {
          <div class="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div class="bg-[#14161a] w-full max-w-lg rounded-3xl border border-white/15 p-6 space-y-4 shadow-2xl">
              
              <div class="flex justify-between items-start pb-3 border-b border-white/10">
                <div>
                  <h3 class="font-display text-2xl font-bold text-white">Confirmar Entrega y Cobro</h3>
                  <span class="text-xs text-slate-400">Orden #{{ getCodeNum(selectedOrderModal()?.codigoSeguimiento || '') }} • {{ selectedOrderModal()?.cliente?.nombre }}</span>
                </div>
                <button (click)="selectedOrderModal.set(null)" class="p-1 rounded-lg text-slate-400 hover:text-white">✕</button>
              </div>

              <!-- Detalle de Cobro -->
              <div class="space-y-3 text-xs">
                <div class="p-4 rounded-xl bg-white/5 flex justify-between items-center">
                  <span class="text-slate-300 font-bold">Total a Cobrar:</span>
                  <span class="font-display text-2xl font-black text-polleria-gold">
                    {{ selectedOrderModal()?.total | currencyPEN }}
                  </span>
                </div>

                @if (selectedOrderModal()?.metodoPago === 'EFECTIVO_CONTRAENTREGA' || !selectedOrderModal()?.metodoPago) {
                  <div class="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
                    <label class="font-bold text-slate-300 block">Calculadora de Vuelto:</label>
                    <div class="flex items-center gap-2">
                      <span class="text-slate-400">Cliente paga con S/.:</span>
                      <input 
                        type="number" 
                        [(ngModel)]="montoPagaCliente"
                        class="w-28 px-3 py-1.5 rounded-xl bg-black border border-white/20 text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                      />
                    </div>
                    <div class="pt-2 border-t border-white/10 flex justify-between items-center text-sm font-bold">
                      <span class="text-slate-400">Vuelto a entregar:</span>
                      <span class="font-mono text-emerald-400">
                        {{ calcularVuelto() | currencyPEN }}
                      </span>
                    </div>
                  </div>
                }

                <button 
                  (click)="confirmarCobroYEntrega()"
                  class="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-lg"
                >
                  ✓ Confirmar Cobrado y Entregado
                </button>
              </div>

            </div>
          </div>
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
    this.ordersService.orders().filter(o => (o.tipo || 'DELIVERY').toUpperCase() === 'DELIVERY')
  );

  readonly activeDeliveryOrders = computed(() =>
    this.deliveryOrders().filter(o => !['COMPLETADO', 'CANCELADO'].includes(o.estado))
  );

  readonly readyForPickupOrders = computed(() =>
    this.activeDeliveryOrders().filter(o => o.estado === 'LISTO_COCINA')
  );

  readonly inRouteOrders = computed(() =>
    this.activeDeliveryOrders().filter(o => o.estado === 'EN_REPARTO')
  );

  readonly completedDeliveryOrders = computed(() =>
    this.deliveryOrders().filter(o => o.estado === 'COMPLETADO')
  );

  readonly filteredActiveDeliveryOrders = computed(() => {
    const filter = this.subFilter();
    if (filter === 'POR_RECOGER') {
      return this.readyForPickupOrders();
    }
    if (filter === 'EN_RUTA') {
      return this.inRouteOrders();
    }
    return this.activeDeliveryOrders();
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

  avanzarAReparto(order: Order): void {
    if (order.estado !== 'LISTO_COCINA') {
      this.notify.showError('El pedido aún está en preparación en cocina. Espera que esté listo.');
      return;
    }
    this.ordersService.updateOrderStatus(order.id, 'EN_REPARTO').subscribe({
      next: () => {
        this.notify.showSuccess(`Orden #${this.getCodeNum(order.codigoSeguimiento)} en ruta de entrega`);
      },
      error: () => {
        this.notify.showError(`Error al iniciar reparto de orden #${this.getCodeNum(order.codigoSeguimiento)}`);
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
    this.montoPagaCliente = order.total <= 50 ? 50 : 100;
  }

  calcularVuelto(): number {
    const o = this.selectedOrderModal();
    if (!o) return 0;
    const vuelto = this.montoPagaCliente - o.total;
    return vuelto > 0 ? vuelto : 0;
  }

  confirmarCobroYEntrega(): void {
    const order = this.selectedOrderModal();
    if (order) {
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
    this.notify.showSuccess('Arqueo de Efectivo Enviado', 'Se ha notificado al Administrador el cierre de caja.');
  }

  cerrarSesion(): void {
    this.auth.logout();
    this.notify.showInfo('Sesión finalizada', 'Has salido del módulo de repartidor.');
    this.router.navigate(['/login']);
  }
}
