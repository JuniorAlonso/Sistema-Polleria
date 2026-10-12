import { Component, inject, signal, computed, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { OrdersService } from '../../core/services/orders.service';
import { ProductsService } from '../../core/services/products.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { SalonService, ZonaSalonConfig } from '../../core/services/salon.service';
import { CurrencyPENPipe } from '../../shared/pipes/currency-pen.pipe';
import { Product } from '../../core/models/product.model';
import { TableStatus } from '../../core/models/table.model';

export type MozoTab = 'MESAS' | 'TOMAR_COMANDA' | 'ALERTAS_COCINA' | 'HISTORIAL_TURNO';

export interface MesaSalon {
  id: number;
  nombre: string;
  zona: 'SALON_PRINCIPAL' | 'TERRAZA' | 'ZONA_VIP' | string;
  capacidad: number;
  estado: TableStatus;
  posicionX?: number;
  posicionY?: number;
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
              {{ mesas().length }}
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
            
            <!-- Summary Bar with View Switcher & Zone Filters -->
            <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-[#14161a] p-4 rounded-2xl border border-white/10 shadow-lg">
              <div>
                <h2 class="text-xl font-bold text-white flex items-center gap-2">
                  <span>Control del Salón y Comensales</span>
                </h2>
                <p class="text-xs text-slate-400">Toca una mesa en el croquis o catálogo para ver su cuenta, agregar platos, cobrar o liberarla.</p>
              </div>

              <div class="flex items-center gap-3 flex-wrap">
                <!-- Toggle Vista Croquis vs Tarjetas -->
                <div class="flex items-center gap-1 bg-black/50 p-1 rounded-xl border border-white/10 text-xs">
                  <button 
                    type="button"
                    (click)="vistaMesas.set('CROQUIS')"
                    class="px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer"
                    [ngClass]="vistaMesas() === 'CROQUIS' ? 'bg-polleria-gold text-slate-950 shadow' : 'text-slate-400 hover:text-white'"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
                    </svg>
                    <span>Croquis Salón</span>
                  </button>
                  <button 
                    type="button"
                    (click)="vistaMesas.set('TARJETAS')"
                    class="px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer"
                    [ngClass]="vistaMesas() === 'TARJETAS' ? 'bg-polleria-gold text-slate-950 shadow' : 'text-slate-400 hover:text-white'"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
                    </svg>
                    <span>Tarjetas</span>
                  </button>
                </div>

                <!-- Filter Zones -->
                <div class="flex items-center gap-1 text-xs bg-black/40 p-1 rounded-xl border border-white/5">
                  <button 
                    (click)="selectedZone.set('TODAS')"
                    class="px-2.5 py-1.5 rounded-lg font-bold transition cursor-pointer"
                    [ngClass]="selectedZone() === 'TODAS' ? 'bg-polleria-gold text-slate-950 shadow' : 'text-slate-400 hover:text-white'"
                  >
                    Todas ({{ mesas().length }})
                  </button>
                  @for (z of zonasSalon; track z.id) {
                    <button 
                      (click)="selectedZone.set(z.id)"
                      class="px-2.5 py-1.5 rounded-lg font-bold transition cursor-pointer"
                      [ngClass]="selectedZone() === z.id ? 'bg-polleria-gold text-slate-950 shadow' : 'text-slate-400 hover:text-white'"
                    >
                      {{ z.nombre }}
                    </button>
                  }
                </div>
              </div>
            </div>

            <!-- ================= CROQUIS MATRICIAL POR ZONAS (SLIDES) ================= -->
            @if (vistaMesas() === 'CROQUIS') {
              <div class="relative bg-[#0d0f14] border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-5 space-y-4">
                
                <!-- Banner de Error de Conexión con Backend -->
                @if (salonService.hasError()) {
                  <div class="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
                    <span class="flex items-center gap-2">
                      <svg class="w-4 h-4 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      <span>Sin conexión con el servidor para sincronizar mesas.</span>
                    </span>
                    <button type="button" (click)="salonService.cargarMesas()" class="px-2.5 py-1 rounded bg-rose-600/30 hover:bg-rose-600 text-white font-bold transition text-[11px] cursor-pointer">Reintentar</button>
                  </div>
                }

                <!-- Overlay de Espera y Sincronización en la Cuadrícula -->
                @if (isProcesandoMesa() || salonService.isLoading()) {
                  <div class="absolute inset-0 bg-slate-950/85 backdrop-blur-sm z-40 rounded-2xl flex flex-col items-center justify-center p-6 text-center animate-fade-in shadow-2xl border border-polleria-gold/30">
                    <div class="relative flex items-center justify-center mb-3">
                      <div class="w-16 h-16 rounded-full border-2 border-polleria-gold/20 animate-ping absolute"></div>
                      <svg class="animate-spin w-12 h-12 text-polleria-gold" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
                        <path class="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                    <h4 class="font-display text-base font-bold text-white tracking-wide">
                      {{ isProcesandoMesa() ? mensajeProcesandoMesa() : 'Cargando mesas del salón...' }}
                    </h4>
                    <p class="text-xs text-slate-400 mt-1 max-w-xs">
                      Por favor espere un momento mientras se completa la sincronización con el servidor.
                    </p>
                  </div>
                }

                <!-- Barra de Navegación por Slides de Zona -->
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-white/10">
                  <!-- Controles de Slide Anterior / Siguiente -->
                  <div class="flex items-center gap-3">
                    <button 
                      type="button"
                      (click)="prevZona()"
                      class="p-2.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white border border-white/10 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                      title="Ver zona anterior"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                      </svg>
                      <span class="hidden sm:inline">Anterior</span>
                    </button>

                    <div class="flex flex-col">
                      <div class="flex items-center gap-2">
                        <span class="font-display text-lg sm:text-xl font-black text-white tracking-wide">
                          {{ currentZona().nombre }}
                        </span>
                        <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-polleria-gold/20 text-polleria-gold border border-polleria-gold/30">
                          Slide {{ activeZonaIndex() + 1 }} de {{ zonasSalon.length }}
                        </span>
                      </div>
                      <span class="text-[11px] text-slate-400">
                        Cuadrícula de casillas: {{ currentZona().filas }} filas × {{ currentZona().columnas }} columnas
                      </span>
                    </div>

                    <button 
                      type="button"
                      (click)="nextZona()"
                      class="p-2.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white border border-white/10 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                      title="Ver siguiente zona"
                    >
                      <span class="hidden sm:inline">Siguiente</span>
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                      </svg>
                    </button>
                  </div>

                  <!-- Píldoras de Salto Directo a Zona -->
                  <div class="flex items-center gap-1.5 bg-black/50 p-1.5 rounded-xl border border-white/10 overflow-x-auto max-w-full">
                    @for (z of zonasSalon; track z.id; let idx = $index) {
                      <button 
                        type="button"
                        (click)="setZonaIndex(idx)"
                        class="px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5"
                        [ngClass]="activeZonaIndex() === idx ? 'bg-polleria-gold text-slate-950 shadow' : 'text-slate-400 hover:text-white hover:bg-white/5'"
                      >
                        <span>{{ z.nombre }}</span>
                      </button>
                    }
                  </div>
                </div>

                <!-- Barra de Personalización de Cuadrícula (Filas × Columnas) & Leyenda -->
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#121419] p-3 rounded-xl border border-white/5 text-xs">
                  <div class="flex items-center gap-4 flex-wrap">
                    <span class="text-slate-400 font-bold uppercase tracking-wider text-[11px]">Personalizar Cuadrícula:</span>
                    
                    <!-- Ajuste de Filas -->
                    <div class="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-lg border border-white/10">
                      <span class="text-slate-400">Filas:</span>
                      <button 
                        type="button" 
                        (click)="ajustarFilas(-1)" 
                        class="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center cursor-pointer"
                        title="Quitar fila"
                      >-</button>
                      <span class="font-mono font-bold text-polleria-gold px-1.5">{{ currentZona().filas }}</span>
                      <button 
                        type="button" 
                        (click)="ajustarFilas(1)" 
                        class="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center cursor-pointer"
                        title="Agregar fila"
                      >+</button>
                    </div>

                    <!-- Ajuste de Columnas -->
                    <div class="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-lg border border-white/10">
                      <span class="text-slate-400">Columnas:</span>
                      <button 
                        type="button" 
                        (click)="ajustarColumnas(-1)" 
                        class="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center cursor-pointer"
                        title="Quitar columna"
                      >-</button>
                      <span class="font-mono font-bold text-polleria-gold px-1.5">{{ currentZona().columnas }}</span>
                      <button 
                        type="button" 
                        (click)="ajustarColumnas(1)" 
                        class="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center cursor-pointer"
                        title="Agregar columna"
                      >+</button>
                    </div>
                  </div>

                  <!-- Leyenda de Estados para el Mozo -->
                  <div class="flex items-center gap-3 text-[11px] flex-wrap">
                    <span class="flex items-center gap-1 text-slate-400"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Libre</span>
                    <span class="flex items-center gap-1 text-slate-400"><span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Ocupada</span>
                    <span class="flex items-center gap-1 text-slate-400"><span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span> Cobrar</span>
                    <span class="flex items-center gap-1 text-slate-400"><span class="w-2.5 h-2.5 rounded-full bg-sky-500"></span> Limpieza</span>
                  </div>
                </div>

                <!-- Estado de Movimiento Activo -->
                @if (mesaEnMovimiento(); as mem) {
                  <div class="flex items-center justify-between bg-amber-500/15 border border-amber-500/40 px-3 py-2 rounded-xl text-amber-300 text-xs animate-pulse">
                    <div class="flex items-center gap-2">
                      <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
                      </svg>
                      <span>Moviendo <strong>{{ mem.nombre }}</strong>: Toca una casilla vacía para reubicarla</span>
                    </div>
                    <button 
                      type="button" 
                      (click)="mesaEnMovimiento.set(null)" 
                      class="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white font-bold text-[10px] cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                }

                <!-- Lienzo de la Cuadrícula Matricial -->
                <div class="overflow-x-auto pb-4 select-none">
                  <div 
                    class="grid gap-3 p-4 bg-[#0a0c10] border border-white/10 rounded-2xl min-w-max mx-auto shadow-inner"
                    [style.gridTemplateColumns]="'repeat(' + currentZona().columnas + ', minmax(110px, 1fr))'"
                  >
                    @for (r of getRowsArray(); track r) {
                      @for (c of getColsArray(); track c) {
                        @if (getMesaEnCasilla(r, c); as mesa) {
                          <!-- CASILLA OCUPADA POR MESA -->
                          <div 
                            draggable="true"
                            (dragstart)="onDragStartMesa($event, mesa)"
                            (click)="onCasillaClick(r, c)"
                            class="h-28 rounded-2xl p-2.5 border-2 flex flex-col justify-between items-center transition-all cursor-pointer relative select-none group shadow-lg"
                            [ngClass]="{
                              'bg-emerald-950/80 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/20 hover:scale-[1.02]': mesa.estado === 'LIBRE',
                              'bg-rose-950/80 border-rose-500 text-rose-300 ring-2 ring-rose-500/20 hover:scale-[1.02]': mesa.estado === 'OCUPADA',
                              'bg-amber-950/80 border-amber-500 text-amber-300 ring-4 ring-amber-500/30 animate-pulse': mesa.estado === 'POR_COBRAR',
                              'bg-sky-950/80 border-sky-500 text-sky-300 ring-2 ring-sky-500/20 hover:scale-[1.02]': mesa.estado === 'EN_LIMPIEZA' || mesa.estado === 'LIMPIEZA',
                              'bg-purple-950/80 border-purple-500 text-purple-300 hover:scale-[1.02]': mesa.estado === 'RESERVADA',

                              'ring-4 ring-polleria-gold border-polleria-gold scale-[1.03] shadow-polleria-gold/30 z-20': selectedMesaModal()?.id === mesa.id,
                              'ring-4 ring-amber-400 animate-bounce z-30': mesaEnMovimiento()?.id === mesa.id
                            }"
                          >
                            <!-- Badge Alerta Plato Listo -->
                            @if (mesa.platosListos) {
                              <span class="absolute -top-3 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black uppercase tracking-wider animate-bounce shadow border border-white/20 whitespace-nowrap z-30">
                                ¡Plato Listo!
                              </span>
                            }

                            <!-- Coordenadas Casilla & Capacidad -->
                            <div class="w-full flex justify-between items-center text-[10px]">
                              <span class="font-mono text-slate-400 opacity-60">F{{ r }}:C{{ c }}</span>
                              <span class="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-black/40">
                                {{ mesa.capacidad }}p
                              </span>
                            </div>

                            <!-- Nombre/Número de Mesa Central -->
                            <div class="flex flex-col items-center my-auto">
                              <span class="font-display text-base font-black text-white tracking-tight leading-none group-hover:text-polleria-gold transition">
                                {{ mesa.nombre }}
                              </span>
                              <span class="text-[9px] font-bold uppercase tracking-wider opacity-80 mt-0.5">
                                {{ mesa.estado }}
                              </span>
                            </div>

                            <!-- Footer de Casilla: Total Consumo & Botón Reubicar -->
                            <div class="w-full flex justify-between items-center pt-1 border-t border-white/10 text-[9px]">
                              @if (mesa.totalConsumo && mesa.totalConsumo > 0) {
                                <span class="font-mono font-bold text-polleria-gold">
                                  {{ mesa.totalConsumo | currencyPEN }}
                                </span>
                              } @else {
                                <span class="text-slate-400">Sin orden</span>
                              }
                              <button 
                                type="button"
                                (click)="iniciarMoverMesa(mesa, $event)"
                                class="p-1 rounded bg-white/10 hover:bg-polleria-gold hover:text-slate-950 text-slate-300 transition cursor-pointer"
                                title="Reubicar a otra casilla"
                              >
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
                                </svg>
                              </button>
                            </div>
                          </div>
                        } @else {
                          <!-- CASILLA VACÍA -->
                          <div 
                            (click)="onCasillaClick(r, c)"
                            (dragover)="onDragOverCasilla($event)"
                            (drop)="onDropCasilla($event, r, c)"
                            class="h-28 rounded-2xl border-2 border-dashed transition-all flex flex-col justify-between items-center p-2.5 cursor-pointer group"
                            [ngClass]="mesaEnMovimiento() ? 'border-polleria-gold/50 bg-polleria-gold/10 hover:border-polleria-gold hover:bg-polleria-gold/20' : 'border-white/10 bg-[#0d0e12] hover:border-white/30 hover:bg-white/5'"
                          >
                            <div class="w-full flex justify-between items-center text-[10px] text-slate-500">
                              <span class="font-mono">F{{ r }}:C{{ c }}</span>
                              <span class="text-[9px] opacity-0 group-hover:opacity-100 text-slate-400 transition">Vacía</span>
                            </div>

                            <div class="flex flex-col items-center justify-center my-auto transition-transform group-hover:scale-110">
                              @if (mesaEnMovimiento()) {
                                <span class="text-xs font-bold text-polleria-gold flex items-center gap-1">
                                  <svg class="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
                                  </svg>
                                  <span>Ubicar aquí</span>
                                </span>
                              } @else {
                                <span class="w-6 h-6 rounded-full border border-dashed border-slate-700 flex items-center justify-center text-slate-600 group-hover:border-slate-500 group-hover:text-slate-400 transition">
                                  <span class="text-[10px]">•</span>
                                </span>
                                <span class="text-[10px] text-slate-600 group-hover:text-slate-400 mt-1 transition">
                                  Disponible
                                </span>
                              }
                            </div>

                            <div class="w-full text-center text-[9px] text-slate-600">
                              Espacio libre
                            </div>
                          </div>
                        }
                      }
                    }
                  </div>
                </div>

              </div>
            } @else {
              <!-- ================= VISTA TARJETAS MOZO ================= -->
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
                        <svg class="w-3.5 h-3.5 text-amber-400 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>Plato Listo
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
            }

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
                      @for (m of mesas(); track m.id) {
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
                          <button (click)="eliminarItemComanda($index)" class="text-rose-400 hover:text-rose-300 cursor-pointer" aria-label="Eliminar"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
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
                    <svg class="w-4 h-4 inline mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>Enviar a Cocina & Horno
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
                        <svg class="w-3.5 h-3.5 inline mr-1 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>Marcar como Servido
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
                <button (click)="selectedMesaModal.set(null)" class="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer" aria-label="Cerrar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
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

                <!-- Máquina de Estados Operativa de Mesa (Fase 2) -->
                <div class="space-y-2 pt-2">
                  <span class="text-[11px] font-bold text-slate-400 block">Flujo de Estados de Salón:</span>
                  <div class="grid grid-cols-2 gap-2">
                    <button 
                      (click)="cambiarEstadoMesa('OCUPADA')"
                      class="py-2.5 px-3 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 font-bold transition cursor-pointer text-xs flex items-center justify-center gap-1.5"
                    >
                      <span class="w-2 h-2 rounded-full bg-rose-500"></span>
                      <span>Ocupar Mesa</span>
                    </button>
                    <button 
                      (click)="cambiarEstadoMesa('POR_COBRAR')"
                      class="py-2.5 px-3 rounded-xl bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/30 font-bold transition cursor-pointer text-xs flex items-center justify-center gap-1.5"
                    >
                      <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                      <span>Por Cobrar</span>
                    </button>
                    <button 
                      (click)="cambiarEstadoMesa('EN_LIMPIEZA')"
                      class="py-2.5 px-3 rounded-xl bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-500/30 font-bold transition cursor-pointer text-xs flex items-center justify-center gap-1.5"
                    >
                      <span class="w-2 h-2 rounded-full bg-sky-400"></span>
                      <span>En Limpieza</span>
                    </button>
                    <button 
                      (click)="cambiarEstadoMesa('LIBRE')"
                      class="py-2.5 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 font-bold transition cursor-pointer text-xs flex items-center justify-center gap-1.5"
                    >
                      <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span>Liberar Mesa</span>
                    </button>
                  </div>
                </div>

                <!-- Casilla en Cuadrícula de Salón -->
                <div class="p-3 rounded-xl bg-black/40 border border-white/5 space-y-2">
                  <span class="text-[11px] font-bold text-slate-400 block">Casilla en Cuadrícula (Columna X, Fila Y):</span>
                  <div class="grid grid-cols-2 gap-2">
                    <div class="flex items-center gap-1.5 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/10">
                      <span class="text-[10px] text-slate-400 font-bold">Col X:</span>
                      <input 
                        type="number" 
                        [(ngModel)]="selectedMesaModal()!.posicionX" 
                        class="w-full bg-transparent text-xs text-white font-mono focus:outline-none"
                      />
                    </div>
                    <div class="flex items-center gap-1.5 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/10">
                      <span class="text-[10px] text-slate-400 font-bold">Fila Y:</span>
                      <input 
                        type="number" 
                        [(ngModel)]="selectedMesaModal()!.posicionY" 
                        class="w-full bg-transparent text-xs text-white font-mono focus:outline-none"
                      />
                    </div>
                  </div>
                  <button 
                    (click)="guardarPosicionMesaModal()"
                    class="w-full py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <svg class="w-3.5 h-3.5 text-polleria-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    <span>Guardar Casilla en Cuadrícula</span>
                  </button>
                </div>

                <!-- Cobro Inmediato -->
                <div class="pt-2 border-t border-white/10">
                  <button 
                    (click)="cobrarMesaModal()"
                    class="w-full py-3 rounded-xl bg-polleria-gold hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-md flex items-center justify-center gap-2"
                  >
                    <span class="flex items-center justify-center gap-1.5"><svg class="w-4 h-4 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>Cobrar Cuenta & Emitir Pre-Cuenta</span>
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
  readonly salonService = inject(SalonService);
  readonly auth = inject(AuthService);
  private notify = inject(NotificationService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  readonly activeTab = signal<MozoTab>('MESAS');
  readonly selectedZone = signal<string>('TODAS');
  readonly selectedMesaModal = signal<MesaSalon | null>(null);
  readonly vistaMesas = signal<'CROQUIS' | 'TARJETAS'>('CROQUIS');

  // Croquis Virtual por Zonas (Slides) & Cuadrícula Personalizable
  get zonasSalon(): ZonaSalonConfig[] {
    return this.salonService.zonasSalon();
  }

  readonly activeZonaIndex = signal<number>(0);
  readonly currentZona = computed(() => this.salonService.zonasSalon()[this.activeZonaIndex()] || this.salonService.zonasSalon()[0]);
  readonly mesaEnMovimiento = signal<MesaSalon | null>(null);

  // Estado de Carga y Espera para Operaciones de Salón
  readonly isProcesandoMesa = signal<boolean>(false);
  readonly mensajeProcesandoMesa = signal<string>('Sincronizando con el servidor...');

  selectedMesaForOrder = 1;
  comandaItems: { producto: Product; cantidad: number; notas: string }[] = [];

  // Mesas sincronizadas de SalonService (sin fallbacks mock)
  readonly mesas = computed<MesaSalon[]>(() => {
    const backendMesas = this.salonService.mesas();
    return backendMesas.map(bm => ({
      id: Number(bm.id),
      nombre: `Mesa ${bm.numero.toString().padStart(2, '0')}`,
      zona: bm.zona || 'SALON_PRINCIPAL',
      capacidad: bm.capacidad,
      estado: bm.estado,
      posicionX: bm.posicionX || 1,
      posicionY: bm.posicionY || 1,
      comensales: bm.ordenActiva ? bm.capacidad : 0,
      tiempoMinutos: bm.ordenActiva ? bm.ordenActiva.tiempoEsperaMinutos : 0,
      totalConsumo: bm.ordenActiva ? bm.ordenActiva.total : 0,
      platosListos: bm.ordenActiva ? bm.ordenActiva.estadoOrden === 'LISTO' : false,
      mozo: bm.mozoAsignado || 'Mozo Salón',
      ordenId: bm.ordenActiva ? String(bm.ordenActiva.ordenId) : undefined
    }));
  });

  // Alertas de Cocina recibidas en tiempo real
  alertas: AlertaPlatoListo[] = [];

  readonly alertasPendientes = computed(() => {
    const list = [...this.alertas.filter(a => !a.atendido)];
    this.salonService.alertasCocina().forEach(ac => {
      list.unshift({
        id: `ALT-LIVE-${ac.ordenId}`,
        mesa: `Mesa ${ac.mesaNumero || ac.mesaId}`,
        plato: ac.mensaje,
        cantidad: 1,
        hora: ac.timestamp,
        atendido: false
      });
    });
    return list;
  });

  readonly filteredMesas = computed(() => {
    const zone = this.selectedZone();
    if (zone === 'TODAS') return this.mesas();
    return this.mesas().filter(m => m.zona === zone);
  });

  ngOnInit(): void {
    this.productsService.loadProducts();
    this.salonService.cargarMesas();
  }

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
    this.selectedMesaModal.set({ ...m });
  }

  // ================= CROQUIS POR ZONAS (SLIDES) & CUADRÍCULA MATRICIAL =================

  prevZona(): void {
    const idx = this.activeZonaIndex();
    this.activeZonaIndex.set(idx > 0 ? idx - 1 : this.zonasSalon.length - 1);
    this.mesaEnMovimiento.set(null);
  }

  nextZona(): void {
    const idx = this.activeZonaIndex();
    this.activeZonaIndex.set(idx < this.zonasSalon.length - 1 ? idx + 1 : 0);
    this.mesaEnMovimiento.set(null);
  }

  setZonaIndex(idx: number): void {
    this.activeZonaIndex.set(idx);
    this.mesaEnMovimiento.set(null);
  }

  ajustarFilas(delta: number): void {
    const z = this.currentZona();
    if (z) {
      this.isProcesandoMesa.set(true);
      this.mensajeProcesandoMesa.set(`Ajustando cuadrícula de ${z.nombre}...`);
      this.salonService.ajustarDimensionesZona(z.id, delta, 0);
      setTimeout(() => this.isProcesandoMesa.set(false), 250);
    }
  }

  ajustarColumnas(delta: number): void {
    const z = this.currentZona();
    if (z) {
      this.isProcesandoMesa.set(true);
      this.mensajeProcesandoMesa.set(`Ajustando cuadrícula de ${z.nombre}...`);
      this.salonService.ajustarDimensionesZona(z.id, 0, delta);
      setTimeout(() => this.isProcesandoMesa.set(false), 250);
    }
  }

  getRowsArray(): number[] {
    return Array.from({ length: this.currentZona().filas }, (_, i) => i + 1);
  }

  getColsArray(): number[] {
    return Array.from({ length: this.currentZona().columnas }, (_, i) => i + 1);
  }

  getMesaEnCasilla(row: number, col: number): MesaSalon | undefined {
    const zonaId = this.currentZona().id;
    return this.mesas().find(m => 
      (m.zona || 'SALON_PRINCIPAL') === zonaId &&
      Number(m.posicionY) === row &&
      Number(m.posicionX) === col
    );
  }

  iniciarMoverMesa(mesa: MesaSalon, event?: Event): void {
    if (event) event.stopPropagation();
    if (this.mesaEnMovimiento()?.id === mesa.id) {
      this.mesaEnMovimiento.set(null);
    } else {
      this.mesaEnMovimiento.set(mesa);
      this.notify.showInfo(`Mesa ${mesa.nombre} seleccionada. Toca una casilla vacía para reubicarla.`);
    }
  }

  onCasillaClick(row: number, col: number): void {
    const mesaExistente = this.getMesaEnCasilla(row, col);
    if (mesaExistente) {
      if (this.mesaEnMovimiento() && this.mesaEnMovimiento()?.id !== mesaExistente.id) {
        this.notify.showWarning(`La casilla F${row}:C${col} ya está ocupada por ${mesaExistente.nombre}`);
      } else {
        this.seleccionarMesa(mesaExistente);
      }
      return;
    }

    if (this.mesaEnMovimiento()) {
      const enMovimiento = this.mesaEnMovimiento()!;
      this.isProcesandoMesa.set(true);
      this.mensajeProcesandoMesa.set(`Reubicando ${enMovimiento.nombre} a F${row}:C${col}...`);
      enMovimiento.posicionX = col;
      enMovimiento.posicionY = row;
      enMovimiento.zona = this.currentZona().id;
      this.salonService.actualizarPosicion(enMovimiento.id, col, row).subscribe({
        next: () => {
          this.isProcesandoMesa.set(false);
          this.mesaEnMovimiento.set(null);
          this.notify.showSuccess(`${enMovimiento.nombre} reubicada en ${this.currentZona().nombre} (F${row}:C${col})`);
        },
        error: () => {
          this.isProcesandoMesa.set(false);
          this.mesaEnMovimiento.set(null);
          this.salonService.cargarMesas();
        }
      });
    }
  }

  onDragStartMesa(event: DragEvent, mesa: MesaSalon): void {
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', String(mesa.id));
      this.mesaEnMovimiento.set(mesa);
    }
  }

  onDragOverCasilla(event: DragEvent): void {
    event.preventDefault();
  }

  onDropCasilla(event: DragEvent, row: number, col: number): void {
    event.preventDefault();
    if (this.getMesaEnCasilla(row, col)) {
      this.notify.showWarning(`La casilla ya está ocupada`);
      return;
    }
    const mesaIdStr = event.dataTransfer?.getData('text/plain');
    const mesaId = mesaIdStr ? Number(mesaIdStr) : this.mesaEnMovimiento()?.id;
    const mesa = this.mesas().find(m => m.id === mesaId);
    if (mesa) {
      this.isProcesandoMesa.set(true);
      this.mensajeProcesandoMesa.set(`Reubicando ${mesa.nombre} a F${row}:C${col}...`);
      this.salonService.actualizarPosicion(mesa.id, col, row).subscribe({
        next: () => {
          this.isProcesandoMesa.set(false);
          this.mesaEnMovimiento.set(null);
          this.notify.showSuccess(`${mesa.nombre} reubicada en ${this.currentZona().nombre} (F${row}:C${col})`);
        },
        error: () => {
          this.isProcesandoMesa.set(false);
          this.mesaEnMovimiento.set(null);
          this.salonService.cargarMesas();
        }
      });
    }
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
    const mesaId = Number(this.selectedMesaForOrder);
    const mesa = this.mesas().find(m => m.id === mesaId);

    const itemsReq = this.comandaItems.map(item => ({
      productoId: item.producto.id,
      cantidad: item.cantidad,
      notas: item.notas
    }));

    this.ordersService.createOrder({
      tipo: 'SALON',
      metodoPago: 'EFECTIVO_CONTRAENTREGA',
      cliente: {
        // La comanda de salón no tiene celular del cliente: no se inventa uno.
        nombre: `Mesa #${mesaId}`,
        celular: '',
        mesaNumero: mesaId
      },
      items: itemsReq
    }).subscribe({
      next: (created) => {
        this.notify.showSuccess(`Comanda creada en cocina para Mesa #${mesaId} (Orden #${created.codigoSeguimiento})`);
        this.salonService.actualizarEstado(mesaId, 'OCUPADA').subscribe();
        this.comandaItems = [];
        this.activeTab.set('MESAS');
      },
      error: (err) => {
        this.notify.showError(`Error al enviar comanda: ${err?.error?.message || 'Compruebe conexión con orders-service'}`);
      }
    });
  }

  marcarPlatoServido(alerta: AlertaPlatoListo): void {
    alerta.atendido = true;
    const mesa = this.mesas().find(m => m.nombre === alerta.mesa);
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
    this.notify.showInfo('Nuevo Plato Listo', 'Mesa 06: Combo Familiar listo para servir.');
  }

  cambiarEstadoMesa(estado: TableStatus): void {
    const m = this.selectedMesaModal();
    if (m) {
      this.salonService.actualizarEstado(m.id, estado).subscribe({
        next: (upd) => {
          m.estado = upd.estado;
          this.selectedMesaModal.set(null);
        },
        error: () => {
          this.selectedMesaModal.set(null);
          this.salonService.cargarMesas();
        }
      });
    }
  }

  guardarPosicionMesaModal(): void {
    const m = this.selectedMesaModal();
    if (m && m.posicionX !== undefined && m.posicionY !== undefined) {
      this.salonService.actualizarPosicion(m.id, m.posicionX, m.posicionY).subscribe();
    }
  }

  cobrarMesaModal(): void {
    const m = this.selectedMesaModal();
    if (m) {
      this.salonService.actualizarEstado(m.id, 'LIBRE').subscribe({
        next: () => {
          this.selectedMesaModal.set(null);
          this.notify.showSuccess(`Cuenta cobrada y Pre-Cuenta emitida para ${m.nombre}`);
        },
        error: () => {
          this.selectedMesaModal.set(null);
          this.salonService.cargarMesas();
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.mesaEnMovimiento.set(null);
    this.selectedMesaModal.set(null);
  }

  cerrarSesion(): void {
    this.auth.logout();
    this.notify.showInfo('Sesión finalizada', 'Has salido del módulo de mozo.');
    this.router.navigate(['/login']);
  }
}
