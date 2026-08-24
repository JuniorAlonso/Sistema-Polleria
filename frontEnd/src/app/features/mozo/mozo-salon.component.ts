import { Component, inject, signal, computed, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { OrdersService } from '../../core/services/orders.service';
import { ProductsService } from '../../core/services/products.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { CurrencyPENPipe } from '../../shared/pipes/currency-pen.pipe';
import { Product } from '../../core/models/product.model';

export type MozoTab = 'MESAS' | 'TOMAR_COMANDA' | 'ALERTAS_COCINA' | 'HISTORIAL_TURNO';

export interface MesaSalon {
  id: number;
  nombre: string;
  zona: 'SALON_PRINCIPAL' | 'TERRAZA' | 'ZONA_VIP';
  capacidad: number;
  estado: 'LIBRE' | 'OCUPADA' | 'POR_COBRAR' | 'RESERVADA';
  comensales?: number;
  tiempoMinutos?: number;
  totalConsumo: number;
  mozo?: string;
  platosListos?: boolean;
  ordenId?: string;
  items?: { producto: string; cantidad: number; precio: number; notas?: string; listo?: boolean }[];
}

export interface AlertaPlatoListo {
  id: string;
  mesa: string;
  plato: string;
  cantidad: number;
  hora: string;
  atendido: boolean;
}

@Component({
  selector: 'app-mozo-salon',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CurrencyPENPipe],
  template: `
    <div class="min-h-screen bg-[#0d0e11] text-slate-100 font-sans selection:bg-polleria-gold selection:text-slate-900 flex flex-col md:flex-row">
      
      <!-- ================= SIDEBAR LATERAL MOZO ================= -->
      <aside class="w-full md:w-64 bg-[#14161a] border-r border-white/10 flex flex-col shrink-0 md:sticky md:top-0 md:h-screen z-40">
        
        <!-- Sidebar Brand Header -->
        <div class="h-16 px-5 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
          <a routerLink="/" class="flex items-center gap-1.5 leading-none">
            <span class="font-display text-2xl font-black text-polleria-crimson tracking-wider">
              SAN POLLO
            </span>
            <span class="font-display text-2xl font-black text-polleria-gold tracking-wider">
              MOZO
            </span>
          </a>
        </div>

        <!-- Sidebar Navigation Menu -->
        <nav class="flex-1 p-3.5 space-y-1 overflow-y-auto no-scrollbar">
          <div class="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 px-3 py-1.5">
            Salón & Atención
          </div>

          <button 
            type="button"
            (click)="activeTab.set('MESAS')"
            class="w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold transition cursor-pointer"
            [ngClass]="activeTab() === 'MESAS' ? 'bg-polleria-gold/15 text-polleria-gold border border-polleria-gold/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-polleria-gold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
              <span>Mapa de Mesas</span>
            </div>
            <span class="px-2 py-0.5 rounded-md bg-black/40 text-[11px] font-bold text-slate-300">
              {{ mesas.length }}
            </span>
          </button>

          <button 
            type="button"
            (click)="activeTab.set('TOMAR_COMANDA')"
            class="w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold transition cursor-pointer"
            [ngClass]="activeTab() === 'TOMAR_COMANDA' ? 'bg-polleria-gold/15 text-polleria-gold border border-polleria-gold/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-polleria-gold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
              </svg>
              <span>Tomar Comanda</span>
            </div>
            <span class="px-2 py-0.5 rounded-full bg-polleria-crimson text-[10px] font-bold text-white">
              + Nuevo
            </span>
          </button>

          <button 
            type="button"
            (click)="activeTab.set('ALERTAS_COCINA')"
            class="w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold transition cursor-pointer"
            [ngClass]="activeTab() === 'ALERTAS_COCINA' ? 'bg-polleria-gold/15 text-polleria-gold border border-polleria-gold/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
              </svg>
              <span>Platos Listos</span>
            </div>
            @if (alertasPendientes().length > 0) {
              <span class="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center animate-bounce">
                {{ alertasPendientes().length }}
              </span>
            }
          </button>

          <div class="pt-3 pb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 px-3">
            Caja & Turno
          </div>

          <button 
            type="button"
            (click)="activeTab.set('HISTORIAL_TURNO')"
            class="w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold transition cursor-pointer"
            [ngClass]="activeTab() === 'HISTORIAL_TURNO' ? 'bg-polleria-gold/15 text-polleria-gold border border-polleria-gold/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-polleria-gold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span>Historial del Turno</span>
            </div>
          </button>
        </nav>

        <!-- Sidebar User Footer -->
        <div class="p-3 border-t border-white/10 bg-[#101215] shrink-0">
          <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/5">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-8 h-8 rounded-full ring-2 ring-polleria-gold overflow-hidden bg-slate-800 flex items-center justify-center text-xs font-black text-polleria-gold shrink-0 shadow">
                <span>{{ (auth.currentUser()?.nombre?.substring(0, 2) || 'MZ') | uppercase }}</span>
              </div>
              <div class="flex flex-col text-left leading-tight min-w-0">
                <span class="text-xs font-bold text-white truncate">
                  {{ auth.currentUser()?.nombre || 'Mozo Salón' }}
                </span>
                <span class="text-[10px] font-mono text-polleria-gold font-bold">
                  MOZO / SALÓN
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
        
        <!-- Top Bar for Status & Actions -->
        <header class="h-16 bg-[#14161a]/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-md">
          
          <div class="flex items-center gap-2.5">
            <h1 class="text-base sm:text-lg font-extrabold text-white tracking-wide uppercase">
              {{ getActiveTabLabel() }}
            </h1>
          </div>

          <div class="flex items-center gap-3">
            <!-- Quick Alert Indicator -->
            <button 
              (click)="activeTab.set('ALERTAS_COCINA')"
              class="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
              </svg>
              <span>Avisos Cocina ({{ alertasPendientes().length }})</span>
            </button>

            <button 
              (click)="abrirModalComandaRapida()"
              class="px-4 py-1.5 rounded-xl bg-polleria-crimson hover:bg-polleria-crimsonHover text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow"
            >
              <span>+ Tomar Comanda</span>
            </button>
          </div>

        </header>

        <!-- ================= TAB 1: MAPA DE MESAS ================= -->
        @if (activeTab() === 'MESAS') {
          <main class="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">
            
            <!-- Summary Bar -->
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#14161a] p-4 rounded-2xl border border-white/10 shadow-lg">
              <div>
                <h2 class="text-xl font-bold text-white flex items-center gap-2">
                  <span>Control del Salón y Comensales</span>
                </h2>
                <p class="text-xs text-slate-400">Toca una mesa para ver su cuenta, agregar platos, cobrar o liberarla.</p>
              </div>

              <!-- Filter Zones -->
              <div class="flex items-center gap-1.5 text-xs bg-black/40 p-1 rounded-xl border border-white/5">
                <button 
                  (click)="selectedZone.set('TODAS')"
                  class="px-3 py-1.5 rounded-lg font-bold transition cursor-pointer"
                  [ngClass]="selectedZone() === 'TODAS' ? 'bg-polleria-gold text-slate-950 shadow' : 'text-slate-400 hover:text-white'"
                >
                  Todas ({{ mesas.length }})
                </button>
                <button 
                  (click)="selectedZone.set('SALON_PRINCIPAL')"
                  class="px-3 py-1.5 rounded-lg font-bold transition cursor-pointer"
                  [ngClass]="selectedZone() === 'SALON_PRINCIPAL' ? 'bg-polleria-gold text-slate-950 shadow' : 'text-slate-400 hover:text-white'"
                >
                  Salón
                </button>
                <button 
                  (click)="selectedZone.set('TERRAZA')"
                  class="px-3 py-1.5 rounded-lg font-bold transition cursor-pointer"
                  [ngClass]="selectedZone() === 'TERRAZA' ? 'bg-polleria-gold text-slate-950 shadow' : 'text-slate-400 hover:text-white'"
                >
                  Terraza
                </button>
                <button 
                  (click)="selectedZone.set('ZONA_VIP')"
                  class="px-3 py-1.5 rounded-lg font-bold transition cursor-pointer"
                  [ngClass]="selectedZone() === 'ZONA_VIP' ? 'bg-polleria-gold text-slate-950 shadow' : 'text-slate-400 hover:text-white'"
                >
                  VIP
                </button>
              </div>
            </div>

            <!-- Mesas Grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              @for (m of filteredMesas(); track m.id) {
                <div 
                  (click)="seleccionarMesa(m)"
                  class="p-5 rounded-2xl border transition duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between group shadow-lg"
                  [ngClass]="{
                    'bg-[#102419] border-emerald-500/40 hover:border-emerald-400': m.estado === 'LIBRE',
                    'bg-[#2d1217] border-rose-500/40 hover:border-rose-400': m.estado === 'OCUPADA',
                    'bg-[#2d220f] border-amber-500/40 hover:border-amber-400': m.estado === 'POR_COBRAR',
                    'bg-[#131f33] border-sky-500/40 hover:border-sky-400': m.estado === 'RESERVADA'
                  }"
                >
                  <!-- Platos Listos Badge -->
                  @if (m.platosListos) {
                    <div class="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider animate-pulse shadow">
                      🔔 Plato Listo
                    </div>
                  }

                  <div>
                    <div class="flex items-center justify-between">
                      <span class="font-display text-2xl font-black text-white group-hover:text-polleria-gold transition">
                        {{ m.nombre }}
                      </span>
                      <span class="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        [ngClass]="{
                          'bg-emerald-500/20 text-emerald-300': m.estado === 'LIBRE',
                          'bg-rose-500/20 text-rose-300': m.estado === 'OCUPADA',
                          'bg-amber-500/20 text-amber-300': m.estado === 'POR_COBRAR',
                          'bg-sky-500/20 text-sky-300': m.estado === 'RESERVADA'
                        }"
                      >
                        {{ m.estado }}
                      </span>
                    </div>

                    <p class="text-xs text-slate-400 mt-1">Capacidad: {{ m.capacidad }} personas • {{ m.zona }}</p>

                    @if (m.estado === 'OCUPADA' || m.estado === 'POR_COBRAR') {
                      <div class="mt-4 pt-3 border-t border-white/10 space-y-1 text-xs">
                        <div class="flex justify-between text-slate-300">
                          <span>Comensales:</span>
                          <span class="font-bold text-white">{{ m.comensales }}</span>
                        </div>
                        <div class="flex justify-between text-slate-300">
                          <span>Tiempo en mesa:</span>
                          <span class="font-mono text-amber-400">{{ m.tiempoMinutos }} min</span>
                        </div>
                        <div class="flex justify-between text-slate-300">
                          <span>Mozo:</span>
                          <span class="font-bold text-slate-200">{{ m.mozo || 'Yovana M.' }}</span>
                        </div>
                      </div>
                    } @else {
                      <div class="mt-4 pt-3 border-t border-white/10 text-xs text-slate-500 flex items-center justify-center h-16">
                        <span>Disponible para asignar</span>
                      </div>
                    }
                  </div>

                  <!-- Footer / Consumo -->
                  <div class="mt-4 pt-3 border-t border-white/10 flex justify-between items-center">
                    <span class="text-xs text-slate-400">Total acumulado:</span>
                    <span class="font-display text-lg font-bold text-polleria-gold">
                      {{ m.totalConsumo | currencyPEN }}
                    </span>
                  </div>

                </div>
              }
            </div>

          </main>
        }

        <!-- ================= TAB 2: TOMAR COMANDA RÁPIDA ================= -->
        @if (activeTab() === 'TOMAR_COMANDA') {
          <main class="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">
            
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <!-- Left: Product Catalog Selection -->
              <div class="lg:col-span-2 space-y-4">
                <div class="bg-[#14161a] p-4 rounded-2xl border border-white/10 shadow flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <div>
                    <h2 class="text-lg font-bold text-white">Carta Digital de Salón</h2>
                    <p class="text-xs text-slate-400">Selecciona platos y bebidas para la mesa elegida.</p>
                  </div>
                  
                  <!-- Mesa Target Selector -->
                  <div class="flex items-center gap-2">
                    <label class="text-xs text-slate-300 font-bold">Mesa:</label>
                    <select 
                      [(ngModel)]="selectedMesaForOrder"
                      class="px-3 py-1.5 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                    >
                      @for (m of mesas; track m.id) {
                        <option [value]="m.id">{{ m.nombre }} ({{ m.estado }})</option>
                      }
                    </select>
                  </div>
                </div>

                <!-- Products Grid -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  @for (prod of productsService.products(); track prod.id) {
                    <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 flex flex-col justify-between gap-3 shadow hover:border-polleria-gold/40 transition">
                      <div class="flex items-center gap-3">
                        <img [src]="prod.imagenUrl" [alt]="prod.nombre" class="w-16 h-16 rounded-xl object-cover shrink-0 bg-slate-800"/>
                        <div class="min-w-0">
                          <h3 class="text-sm font-bold text-white truncate">{{ prod.nombre }}</h3>
                          <p class="text-xs text-slate-400 line-clamp-1">{{ prod.descripcion }}</p>
                          <span class="font-display text-sm font-bold text-polleria-gold">{{ prod.precio | currencyPEN }}</span>
                        </div>
                      </div>
                      <button 
                        (click)="agregarItemComanda(prod)"
                        class="w-full py-2 rounded-xl bg-polleria-gold/10 hover:bg-polleria-gold text-polleria-gold hover:text-slate-950 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>+ Agregar a la comanda</span>
                      </button>
                    </div>
                  }
                </div>
              </div>

              <!-- Right: Comanda Builder Drawer -->
              <div class="bg-[#14161a] p-5 rounded-2xl border border-white/10 shadow flex flex-col justify-between h-[calc(100vh-175px)] sticky top-20">
                <div>
                  <div class="flex justify-between items-center pb-4 border-b border-white/10">
                    <div>
                      <h3 class="text-base font-extrabold text-white">Comanda Mesa #{{ selectedMesaForOrder }}</h3>
                      <p class="text-xs text-slate-400">Mozo: {{ auth.currentUser()?.nombre || 'Yovana M.' }}</p>
                    </div>
                    <span class="px-2.5 py-1 rounded-full bg-polleria-crimson text-white text-xs font-bold">
                      {{ comandaItems.length }} items
                    </span>
                  </div>

                  <!-- Comanda Items List -->
                  <div class="py-4 space-y-3 overflow-y-auto max-h-[360px] custom-scrollbar">
                    @if (comandaItems.length === 0) {
                      <div class="text-center py-12 text-slate-500 text-xs">
                        No hay platos agregados a esta comanda.<br/>Selecciona productos de la carta.
                      </div>
                    }

                    @for (item of comandaItems; track $index) {
                      <div class="p-3 rounded-xl bg-white/5 border border-white/5 space-y-2">
                        <div class="flex justify-between items-start">
                          <div>
                            <span class="text-xs font-bold text-white">{{ item.cantidad }}x {{ item.producto.nombre }}</span>
                            <span class="block text-[11px] font-mono text-polleria-gold">{{ item.producto.precio * item.cantidad | currencyPEN }}</span>
                          </div>
                          <button (click)="eliminarItemComanda($index)" class="text-rose-400 hover:text-rose-300 text-xs cursor-pointer">✕</button>
                        </div>
                        <input 
                          type="text" 
                          [(ngModel)]="item.notas" 
                          placeholder="Notas de cocina (ej: papas bien doradas, sin ají...)"
                          class="w-full px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-[11px] text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                        />
                      </div>
                    }
                  </div>
                </div>

                <!-- Footer Summary & Submit -->
                <div class="pt-4 border-t border-white/10 space-y-3">
                  <div class="flex justify-between items-center">
                    <span class="text-xs text-slate-400 font-bold">Total Comanda:</span>
                    <span class="font-display text-2xl font-black text-polleria-gold">
                      {{ calcularTotalComanda() | currencyPEN }}
                    </span>
                  </div>

                  <button 
                    [disabled]="comandaItems.length === 0"
                    (click)="enviarComandaACocina()"
                    class="w-full py-3 rounded-xl bg-polleria-crimson hover:bg-polleria-crimsonHover disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-lg"
                  >
                    🚀 Enviar a Cocina & Horno
                  </button>
                </div>

              </div>

            </div>

          </main>
        }

        <!-- ================= TAB 3: ALERTAS DE COCINA ================= -->
        @if (activeTab() === 'ALERTAS_COCINA') {
          <main class="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-6">
            
            <div class="bg-[#14161a] p-4 rounded-2xl border border-white/10 shadow flex justify-between items-center">
              <div>
                <h2 class="text-lg font-bold text-white flex items-center gap-2">
                  <span>Avisos de Platos Listos en Cocina</span>
                </h2>
                <p class="text-xs text-slate-400">Notificaciones instantáneas de platos recién salidos del horno para servir a mesa.</p>
              </div>

              <button 
                (click)="simularNuevoAvisoCocina()"
                class="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold border border-white/10 transition cursor-pointer"
              >
                + Simular Aviso de Cocina
              </button>
            </div>

            <!-- Alerts List -->
            <div class="space-y-3">
              @for (a of alertas; track a.id) {
                <div 
                  class="p-4 rounded-2xl border transition duration-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-lg"
                  [ngClass]="a.atendido ? 'bg-white/5 border-white/5 opacity-60' : 'bg-amber-500/10 border-amber-500/40'"
                >
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                      </svg>
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="font-display text-lg font-black text-white">{{ a.mesa }}</span>
                        <span class="text-xs text-slate-400">• {{ a.hora }}</span>
                      </div>
                      <p class="text-sm font-bold text-amber-300">{{ a.cantidad }}x {{ a.plato }}</p>
                    </div>
                  </div>

                  <div>
                    @if (!a.atendido) {
                      <button 
                        (click)="marcarPlatoServido(a)"
                        class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow flex items-center gap-1.5"
                      >
                        ✓ Marcar como Servido
                      </button>
                    } @else {
                      <span class="text-xs text-emerald-400 font-bold">Servido en mesa</span>
                    }
                  </div>
                </div>
              }
            </div>

          </main>
        }

        <!-- ================= TAB 4: HISTORIAL & COBROS DEL TURNO ================= -->
        @if (activeTab() === 'HISTORIAL_TURNO') {
          <main class="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">
            
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 shadow">
                <span class="text-xs text-slate-400 font-medium">Mesas Atendidas Hoy</span>
                <p class="font-display text-3xl font-black text-white mt-1">14</p>
              </div>
              <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 shadow">
                <span class="text-xs text-slate-400 font-medium">Total Cobrado en Turno</span>
                <p class="font-display text-3xl font-black text-polleria-gold mt-1">S/. 1,840.50</p>
              </div>
              <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 shadow">
                <span class="text-xs text-slate-400 font-medium">Propinas Digitales Estimadas</span>
                <p class="font-display text-3xl font-black text-emerald-400 mt-1">S/. 92.00</p>
              </div>
            </div>

            <!-- Cobros Realizados Table -->
            <div class="bg-[#14161a] rounded-2xl border border-white/10 overflow-hidden shadow">
              <div class="p-4 border-b border-white/10 flex justify-between items-center">
                <h3 class="text-sm font-bold text-white">Transacciones y Cierres de Mesa de Salón</h3>
                <span class="text-xs text-slate-400">Turno Almuerzo / Cena</span>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs text-slate-300">
                  <thead class="bg-black/40 text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/10">
                    <tr>
                      <th class="p-3">Mesa</th>
                      <th class="p-3">Comanda / Detalle</th>
                      <th class="p-3">Método Pago</th>
                      <th class="p-3">Monto</th>
                      <th class="p-3">Hora</th>
                      <th class="p-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/5">
                    <tr class="hover:bg-white/5">
                      <td class="p-3 font-bold text-white">Mesa 01</td>
                      <td class="p-3">1x Pollo Entero, 1x Chicha 1L</td>
                      <td class="p-3 font-mono text-emerald-400">YAPE</td>
                      <td class="p-3 font-display font-bold text-polleria-gold">S/. 89.00</td>
                      <td class="p-3 text-slate-400">14:35</td>
                      <td class="p-3"><span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">Cobrado</span></td>
                    </tr>
                    <tr class="hover:bg-white/5">
                      <td class="p-3 font-bold text-white">Mesa 04</td>
                      <td class="p-3">1/2 Pollo a la Brasa, 1x Salchipapa</td>
                      <td class="p-3 font-mono text-sky-400">TARJETA VISA</td>
                      <td class="p-3 font-display font-bold text-polleria-gold">S/. 65.00</td>
                      <td class="p-3 text-slate-400">15:10</td>
                      <td class="p-3"><span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">Cobrado</span></td>
                    </tr>
                    <tr class="hover:bg-white/5">
                      <td class="p-3 font-bold text-white">Mesa 03</td>
                      <td class="p-3">2x Combo Familiar, 1x Tequeños</td>
                      <td class="p-3 font-mono text-amber-400">EFECTIVO</td>
                      <td class="p-3 font-display font-bold text-polleria-gold">S/. 154.00</td>
                      <td class="p-3 text-slate-400">15:45</td>
                      <td class="p-3"><span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">Cobrado</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </main>
        }

        <!-- ================= MODAL DETALLE DE MESA & COBRO ================= -->
        @if (selectedMesaModal()) {
          <div class="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div class="bg-[#14161a] w-full max-w-lg rounded-3xl border border-white/15 p-6 space-y-4 shadow-2xl">
              
              <div class="flex justify-between items-start pb-3 border-b border-white/10">
                <div>
                  <h3 class="font-display text-2xl font-bold text-white">{{ selectedMesaModal()?.nombre }}</h3>
                  <span class="text-xs text-slate-400">{{ selectedMesaModal()?.zona }} • Capacidad {{ selectedMesaModal()?.capacidad }} pers.</span>
                </div>
                <button (click)="selectedMesaModal.set(null)" class="p-1 rounded-lg text-slate-400 hover:text-white">✕</button>
              </div>

              <!-- Estado de la Mesa -->
              <div class="space-y-3 text-xs">
                <div class="flex justify-between items-center p-3 rounded-xl bg-white/5">
                  <span class="text-slate-300">Estado Actual:</span>
                  <span class="font-bold uppercase" [ngClass]="{
                    'text-emerald-400': selectedMesaModal()?.estado === 'LIBRE',
                    'text-rose-400': selectedMesaModal()?.estado === 'OCUPADA',
                    'text-amber-400': selectedMesaModal()?.estado === 'POR_COBRAR'
                  }">
                    {{ selectedMesaModal()?.estado }}
                  </span>
                </div>

                <!-- Detalle de Consumo -->
                <div class="p-3 rounded-xl bg-black/40 space-y-2 border border-white/5">
                  <span class="font-bold text-slate-300 block">Comanda Acumulada:</span>
                  <div class="space-y-1 text-slate-400">
                    <p class="flex justify-between"><span>1x Pollo a la Brasa Entero</span> <span class="font-mono text-white">S/. 65.00</span></p>
                    <p class="flex justify-between"><span>1x Jarra Chicha Morada 1L</span> <span class="font-mono text-white">S/. 14.00</span></p>
                    <p class="flex justify-between"><span>1x Porción Tequeños Criollos</span> <span class="font-mono text-white">S/. 19.50</span></p>
                  </div>
                  <div class="pt-2 border-t border-white/10 flex justify-between font-bold text-sm text-polleria-gold">
                    <span>Total a Cobrar:</span>
                    <span>S/. 98.50</span>
                  </div>
                </div>

                <!-- Botones de Acción de Mesa -->
                <div class="grid grid-cols-2 gap-2 pt-2">
                  <button 
                    (click)="cambiarEstadoMesa('OCUPADA')"
                    class="py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 font-bold transition cursor-pointer"
                  >
                    Marcar Ocupada
                  </button>
                  <button 
                    (click)="cambiarEstadoMesa('LIBRE')"
                    class="py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 font-bold transition cursor-pointer"
                  >
                    Liberar Mesa
                  </button>
                </div>

                <!-- Cobro Inmediato -->
                <div class="pt-2 border-t border-white/10">
                  <button 
                    (click)="cobrarMesaModal()"
                    class="w-full py-3 rounded-xl bg-polleria-gold hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-md flex items-center justify-center gap-2"
                  >
                    <span>💳 Cobrar Cuenta & Emitir Pre-Cuenta</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        }

      </div>
    </div>
  `
})
export class MozoSalonComponent implements OnInit, OnDestroy {
  readonly ordersService = inject(OrdersService);
  readonly productsService = inject(ProductsService);
  readonly auth = inject(AuthService);
  private notify = inject(NotificationService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  readonly activeTab = signal<MozoTab>('MESAS');
  readonly selectedZone = signal<'TODAS' | 'SALON_PRINCIPAL' | 'TERRAZA' | 'ZONA_VIP'>('TODAS');
  readonly selectedMesaModal = signal<MesaSalon | null>(null);

  selectedMesaForOrder = 1;
  comandaItems: { producto: Product; cantidad: number; notas: string }[] = [];

  // Mesas Data
  mesas: MesaSalon[] = [
    { id: 1, nombre: 'Mesa 01', zona: 'SALON_PRINCIPAL', capacidad: 4, estado: 'OCUPADA', comensales: 3, tiempoMinutos: 35, totalConsumo: 89.00, mozo: 'Yovana M.' },
    { id: 2, nombre: 'Mesa 02', zona: 'SALON_PRINCIPAL', capacidad: 4, estado: 'LIBRE', totalConsumo: 0 },
    { id: 3, nombre: 'Mesa 03', zona: 'SALON_PRINCIPAL', capacidad: 6, estado: 'OCUPADA', comensales: 5, tiempoMinutos: 42, totalConsumo: 154.00, platosListos: true, mozo: 'Yovana M.' },
    { id: 4, nombre: 'Mesa 04', zona: 'SALON_PRINCIPAL', capacidad: 4, estado: 'POR_COBRAR', comensales: 2, tiempoMinutos: 55, totalConsumo: 65.00, mozo: 'Yovana M.' },
    { id: 5, nombre: 'Mesa 05', zona: 'TERRAZA', capacidad: 2, estado: 'LIBRE', totalConsumo: 0 },
    { id: 6, nombre: 'Mesa 06', zona: 'TERRAZA', capacidad: 4, estado: 'OCUPADA', comensales: 4, tiempoMinutos: 18, totalConsumo: 112.00, mozo: 'Yovana M.' },
    { id: 7, nombre: 'Mesa 07', zona: 'TERRAZA', capacidad: 4, estado: 'RESERVADA', totalConsumo: 0 },
    { id: 8, nombre: 'Mesa 08', zona: 'ZONA_VIP', capacidad: 8, estado: 'OCUPADA', comensales: 7, tiempoMinutos: 60, totalConsumo: 245.00, mozo: 'Yovana M.' }
  ];

  // Alertas de Cocina
  alertas: AlertaPlatoListo[] = [
    { id: 'ALT-1', mesa: 'Mesa 03', plato: '1x Pollo Entero a la Brasa con Papas Doradas', cantidad: 1, hora: '16:10', atendido: false },
    { id: 'ALT-2', mesa: 'Mesa 01', plato: '1x Jarra de Chicha Morada Casera', cantidad: 1, hora: '16:05', atendido: false }
  ];

  readonly alertasPendientes = computed(() => this.alertas.filter(a => !a.atendido));

  readonly filteredMesas = computed(() => {
    const zone = this.selectedZone();
    if (zone === 'TODAS') return this.mesas;
    return this.mesas.filter(m => m.zona === zone);
  });

  ngOnInit(): void {
    this.productsService.loadProducts();
  }

  ngOnDestroy(): void {}

  getActiveTabLabel(): string {
    switch (this.activeTab()) {
      case 'MESAS': return 'Control de Mesas & Salón';
      case 'TOMAR_COMANDA': return 'Toma de Comanda Móvil';
      case 'ALERTAS_COCINA': return 'Avisos en Vivo de Cocina';
      case 'HISTORIAL_TURNO': return 'Historial & Arqueo de Turno';
      default: return 'Panel Mozo';
    }
  }

  seleccionarMesa(m: MesaSalon): void {
    this.selectedMesaModal.set(m);
  }

  abrirModalComandaRapida(): void {
    this.activeTab.set('TOMAR_COMANDA');
  }

  agregarItemComanda(prod: Product): void {
    const exist = this.comandaItems.find(i => i.producto.id === prod.id);
    if (exist) {
      exist.cantidad += 1;
    } else {
      this.comandaItems.push({ producto: prod, cantidad: 1, notas: '' });
    }
    this.notify.showSuccess(`Agregado: ${prod.nombre}`);
  }

  eliminarItemComanda(index: number): void {
    this.comandaItems.splice(index, 1);
  }

  calcularTotalComanda(): number {
    return this.comandaItems.reduce((acc, i) => acc + (i.producto.precio * i.cantidad), 0);
  }

  enviarComandaACocina(): void {
    const mesa = this.mesas.find(m => m.id === Number(this.selectedMesaForOrder));
    if (mesa) {
      mesa.estado = 'OCUPADA';
      mesa.totalConsumo += this.calcularTotalComanda();
      mesa.tiempoMinutos = 1;
      mesa.mozo = this.auth.currentUser()?.nombre || 'Yovana M.';
    }
    this.notify.showSuccess(`Comanda enviada a Cocina para Mesa #${this.selectedMesaForOrder}`);
    this.comandaItems = [];
    this.activeTab.set('MESAS');
  }

  marcarPlatoServido(alerta: AlertaPlatoListo): void {
    alerta.atendido = true;
    const mesa = this.mesas.find(m => m.nombre === alerta.mesa);
    if (mesa) {
      mesa.platosListos = false;
    }
    this.notify.showSuccess(`Plato servido en ${alerta.mesa}`);
  }

  simularNuevoAvisoCocina(): void {
    this.alertas.unshift({
      id: `ALT-${Date.now()}`,
      mesa: 'Mesa 06',
      plato: '1x Combo Familiar San Pollo',
      cantidad: 1,
      hora: new Date().toLocaleTimeString().slice(0, 5),
      atendido: false
    });
    this.notify.showInfo('🔔 Nuevo Plato Listo', 'Mesa 06: Combo Familiar listo para servir.');
  }

  cambiarEstadoMesa(estado: 'LIBRE' | 'OCUPADA'): void {
    const m = this.selectedMesaModal();
    if (m) {
      m.estado = estado;
      if (estado === 'LIBRE') {
        m.totalConsumo = 0;
        m.tiempoMinutos = 0;
        m.comensales = 0;
        m.platosListos = false;
      } else {
        m.comensales = m.capacidad;
        m.tiempoMinutos = 1;
      }
      this.selectedMesaModal.set(null);
      this.notify.showSuccess(`${m.nombre} actualizada a ${estado}`);
    }
  }

  cobrarMesaModal(): void {
    const m = this.selectedMesaModal();
    if (m) {
      m.estado = 'LIBRE';
      m.totalConsumo = 0;
      m.tiempoMinutos = 0;
      this.selectedMesaModal.set(null);
      this.notify.showSuccess(`Cuenta cobrada y Pre-Cuenta impresa para ${m.nombre}`);
    }
  }

  cerrarSesion(): void {
    this.auth.logout();
    this.notify.showInfo('Sesión finalizada', 'Has salido del módulo de mozo.');
    this.router.navigate(['/login']);
  }
}
