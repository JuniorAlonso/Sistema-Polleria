import { Component, inject, signal, computed, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { OrdersService } from '../../core/services/orders.service';
import { PaymentService } from '../../core/services/payment.service';
import { FinanceService } from '../../core/services/finance.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { CurrencyPENPipe } from '../../shared/pipes/currency-pen.pipe';
import { Order } from '../../core/models/order.model';
import { ArqueoCaja, MovimientoCaja, TipoMovimiento } from '../../core/models/finance.model';
import { InventoryService } from '../../core/services/inventory.service';
import { BackendLiquidacionResponse } from '../../core/models/api-contracts.model';

export type CajeroTab = 'POS' | 'LLAMADAS_CONTRAPAGO' | 'LIQUIDACIONES' | 'MERMAS_FANTASMA' | 'ARQUEO' | 'HISTORIAL';
export type MetodoCobro = 'EFECTIVO' | 'TARJETA' | 'YAPE_PLIN';

@Component({
  selector: 'app-cajero-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CurrencyPENPipe],
  template: `
    <div class="min-h-screen bg-[#0d0e11] text-slate-100 font-sans selection:bg-polleria-gold selection:text-slate-900 flex flex-col md:flex-row">
      
      <!-- ================= SIDEBAR LATERAL CAJERO ================= -->
      <aside class="w-full md:w-64 bg-[#14161a] border-r border-white/10 flex flex-col shrink-0 md:sticky md:top-0 md:h-screen z-40">
        
        <!-- Sidebar Header -->
        <div class="h-16 px-5 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
          <a routerLink="/" class="flex items-center gap-1.5 leading-none">
            <span class="font-display text-2xl font-black text-polleria-crimson tracking-wider">
              SAN POLLO
            </span>
            <span class="font-display text-2xl font-black text-emerald-400 tracking-wider">
              CAJA
            </span>
          </a>
        </div>

        <!-- Estado de Caja Badge en Sidebar -->
        <div class="p-3.5 border-b border-white/5">
          <div class="p-3 rounded-xl border flex items-center gap-2.5 transition"
            [ngClass]="cajaAbierta() ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-amber-950/20 border-amber-500/30'"
          >
            <span class="w-2.5 h-2.5 rounded-full shrink-0"
              [ngClass]="cajaAbierta() ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'"
            ></span>
            <div class="min-w-0 flex-1">
              <span class="text-[10px] font-bold uppercase tracking-wider block"
                [ngClass]="cajaAbierta() ? 'text-emerald-300' : 'text-amber-300'"
              >
                {{ cajaAbierta() ? 'Caja Abierta' : 'Caja Cerrada' }}
              </span>
              <p class="text-[11px] font-mono text-slate-400 truncate">
                @if (cajaAbierta()) {
                  Fondo: {{ (financeService.cajaActual()?.montoApertura || 0) | currencyPEN }}
                } @else {
                  Requiere apertura
                }
              </p>
            </div>
          </div>
        </div>

        <!-- Sidebar Navigation Menu -->
        <nav class="flex-1 p-3.5 space-y-1 overflow-y-auto no-scrollbar">
          <div class="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 px-3 py-1.5">
            Módulos de Caja
          </div>

          <button 
            type="button"
            (click)="activeTab.set('POS')"
            class="w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold transition cursor-pointer"
            [ngClass]="activeTab() === 'POS' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
              </svg>
              <span>Punto de Cobro (POS)</span>
            </div>
            <span class="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-xs">
              {{ comandasPorCobrar().length }}
            </span>
          </button>

          <button 
            type="button"
            (click)="activeTab.set('LLAMADAS_CONTRAPAGO')"
            class="w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold transition cursor-pointer"
            [ngClass]="activeTab() === 'LLAMADAS_CONTRAPAGO' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
              </svg>
              <span>Llamadas ContraPago</span>
            </div>
            <span class="px-2 py-0.5 rounded-full font-bold text-xs" [ngClass]="ordenesPendientesLlamada().length > 0 ? 'bg-amber-500 text-slate-950 animate-pulse' : 'bg-slate-800 text-slate-400'">
              {{ ordenesPendientesLlamada().length }}
            </span>
          </button>

          <button 
            type="button"
            (click)="activeTab.set('LIQUIDACIONES')"
            class="w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold transition cursor-pointer"
            [ngClass]="activeTab() === 'LIQUIDACIONES' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
              <span>Liquidación Repartidores</span>
            </div>
            <span class="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold text-xs">
              {{ liquidacionesAbiertas().length }}
            </span>
          </button>

          <button 
            type="button"
            (click)="activeTab.set('MERMAS_FANTASMA')"
            class="w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold transition cursor-pointer"
            [ngClass]="activeTab() === 'MERMAS_FANTASMA' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              <span>Mermas / Pedidos Fantasma</span>
            </div>
            <span class="px-2 py-0.5 rounded-full font-bold text-xs" [ngClass]="ordenesFantasma().length > 0 ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-400'">
              {{ ordenesFantasma().length }}
            </span>
          </button>

          <button 
            type="button"
            (click)="activeTab.set('ARQUEO')"
            class="w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold transition cursor-pointer"
            [ngClass]="activeTab() === 'ARQUEO' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-polleria-gold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span>Arqueo & Caja Chica</span>
            </div>
          </button>

          <button 
            type="button"
            (click)="activeTab.set('HISTORIAL')"
            class="w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold transition cursor-pointer"
            [ngClass]="activeTab() === 'HISTORIAL' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-sky-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
              </svg>
              <span>Cobros del Día</span>
            </div>
            <span class="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold text-xs">
              {{ cobrosDelDia().length }}
            </span>
          </button>
        </nav>

        <!-- Sidebar Footer con Usuario & Salir -->
        <div class="p-4 border-t border-white/10 bg-black/20 shrink-0">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-xs">
              {{ (auth.currentUser()?.nombre?.substring(0, 2) || 'CJ') | uppercase }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-bold text-white truncate">
                {{ auth.currentUser()?.nombre || 'Cajero San Pollo' }}
              </p>
              <p class="text-[10px] text-emerald-400 font-medium uppercase tracking-wider">
                Rol: Cajero de Turno
              </p>
            </div>
          </div>
          <button 
            type="button"
            (click)="cerrarSesion()"
            class="w-full py-2 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      <!-- ================= CONTENIDO PRINCIPAL ================= -->
      <main class="flex-1 flex flex-col min-w-0 overflow-y-auto max-h-screen">
        
        <!-- Topbar Superior -->
        <header class="h-16 px-4 sm:px-6 bg-[#14161a] border-b border-white/10 flex items-center justify-between gap-4 shrink-0">
          <div class="flex items-center gap-3">
            <h1 class="font-display text-xl sm:text-2xl text-white tracking-wide flex items-center gap-2">
              @if (activeTab() === 'POS') {
                <span>PUNTO DE COBRO & COMANDAS</span>
              } @else if (activeTab() === 'ARQUEO') {
                <span>ARQUEO Y MOVIMIENTOS DE CAJA</span>
              } @else {
                <span>HISTORIAL DE COBROS REALIZADOS</span>
              }
            </h1>
          </div>

          <div class="flex items-center gap-3">
            <!-- Hora Actual -->
            <div class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 font-mono">
              <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span>{{ horaActual() }}</span>
            </div>

            <!-- Botón Actualizar Datos -->
            <button
              type="button"
              (click)="refrescarTodo()"
              [disabled]="cargando()"
              class="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition cursor-pointer"
              title="Refrescar comanda y caja"
            >
              <svg class="w-4 h-4" [ngClass]="{'animate-spin': cargando()}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            </button>
          </div>
        </header>

        <!-- Contenedor del Cuerpo de la Vista -->
        <div class="p-4 sm:p-6 flex-1 space-y-6">

          <!-- ================= TAB 1: PUNTO DE COBRO (POS) ================= -->
          @if (activeTab() === 'POS') {

            <!-- Aviso si la caja está cerrada -->
            @if (!cajaAbierta()) {
              <div class="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center justify-between gap-4">
                <div class="flex items-center gap-3">
                  <svg class="w-5 h-5 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                  <div>
                    <strong class="font-bold block text-sm">Atención: La caja del turno no ha sido abierta</strong>
                    <span class="text-xs text-amber-300/80">
                      Debes abrir caja con un fondo inicial para registrar cobros en efectivo y movimientos.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  (click)="activeTab.set('ARQUEO')"
                  class="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer shrink-0"
                >
                  Abrir Caja Ahora
                </button>
              </div>
            }

            <!-- Filtros & Buscador -->
            <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <!-- Filtro de tipo -->
              <div class="flex items-center gap-1.5 p-1 bg-[#14161a] border border-white/10 rounded-xl">
                <button
                  type="button"
                  (click)="filtroTipo.set('TODAS')"
                  class="px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                  [ngClass]="filtroTipo() === 'TODAS' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'"
                >
                  Todas ({{ comandasPorCobrar().length }})
                </button>
                <button
                  type="button"
                  (click)="filtroTipo.set('SALON')"
                  class="px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                  [ngClass]="filtroTipo() === 'SALON' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'"
                >
                  Salón / Mesas
                </button>
                <button
                  type="button"
                  (click)="filtroTipo.set('DELIVERY')"
                  class="px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                  [ngClass]="filtroTipo() === 'DELIVERY' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'"
                >
                  Delivery
                </button>
                <button
                  type="button"
                  (click)="filtroTipo.set('RECOJO_EN_TIENDA')"
                  class="px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                  [ngClass]="filtroTipo() === 'RECOJO_EN_TIENDA' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'"
                >
                  Para Llevar
                </button>
              </div>

              <!-- Input de Búsqueda -->
              <div class="relative w-full sm:w-72">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                </span>
                <input
                  type="text"
                  [(ngModel)]="busquedaTexto"
                  placeholder="Buscar por orden, cliente o mesa..."
                  class="w-full pl-9 pr-3 py-2 bg-[#14161a] border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <!-- Listado de Comandas para Cobro -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              @for (orden of comandasFiltradas(); track orden.id) {
                <div 
                  class="p-4 rounded-2xl bg-[#14161a] border border-white/10 hover:border-emerald-500/50 transition flex flex-col justify-between gap-4 cursor-pointer shadow-lg"
                  (click)="seleccionarOrdenParaCobro(orden)"
                >
                  <div>
                    <!-- Header Card -->
                    <div class="flex items-start justify-between gap-2 mb-2">
                      <div class="flex items-center gap-2">
                        <span class="px-2 py-0.5 rounded-md text-[11px] font-mono font-black tracking-wider bg-white/10 text-white">
                          #{{ orden.codigoSeguimiento || orden.id }}
                        </span>
                        <!-- Badge Tipo -->
                        @if (orden.tipo === 'SALON') {
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Mesa {{ orden.cliente.mesaNumero || 'S/N' }}
                          </span>
                        } @else if (orden.tipo === 'DELIVERY') {
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                            Delivery
                          </span>
                        } @else {
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            Para Llevar
                          </span>
                        }
                      </div>
                      <span class="text-[10px] text-slate-400 font-mono">
                        {{ orden.createdAt | date:'shortTime' }}
                      </span>
                    </div>

                    <!-- Cliente Info -->
                    <p class="text-sm font-bold text-white truncate">
                      {{ orden.cliente.nombre || 'Cliente General' }}
                    </p>
                    <p class="text-xs text-slate-400 truncate mb-3">
                      Tel: {{ orden.cliente.celular || 'Sin teléfono' }}
                    </p>

                    <!-- Items Preview -->
                    <div class="space-y-1 border-t border-white/5 pt-2">
                      @for (item of orden.items; track item.product.id) {
                        <div class="flex justify-between items-center text-xs text-slate-300">
                          <span class="truncate flex-1 pr-2">
                            {{ item.cantidad }}x {{ item.product.nombre }}
                          </span>
                          <span class="font-mono text-slate-400">
                            {{ (item.product.precio * item.cantidad) | currencyPEN }}
                          </span>
                        </div>
                      }
                    </div>
                  </div>

                  <!-- Footer Card con Total y Botón de Cobro -->
                  <div class="border-t border-white/10 pt-3 flex items-center justify-between gap-3">
                    <div>
                      <span class="text-[10px] text-slate-400 uppercase font-semibold block">Total a Cobrar</span>
                      <span class="font-display text-2xl text-polleria-gold font-bold">
                        {{ orden.total | currencyPEN }}
                      </span>
                    </div>
                    <button
                      type="button"
                      (click)="$event.stopPropagation(); seleccionarOrdenParaCobro(orden)"
                      class="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
                      </svg>
                      <span>Cobrar</span>
                    </button>
                  </div>
                </div>
              } @empty {
                <div class="col-span-full py-16 text-center text-slate-500 space-y-3">
                  <svg class="w-12 h-12 mx-auto text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  <p class="text-sm font-medium">No hay comandas pendientes de cobro con los filtros seleccionados.</p>
                </div>
              }
            </div>
          }

          <!-- ================= TAB 2: ARQUEO & CAJA CHICA ================= -->
          @if (activeTab() === 'ARQUEO') {
            
            @if (!cajaAbierta()) {
              <!-- Formulario de Apertura de Caja -->
              <div class="max-w-xl mx-auto p-6 sm:p-8 rounded-3xl bg-[#14161a] border border-white/10 shadow-2xl space-y-6">
                <div class="text-center space-y-2">
                  <div class="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/>
                    </svg>
                  </div>
                  <h2 class="font-display text-2xl sm:text-3xl font-bold text-white tracking-wide">
                    APERTURA DE CAJA
                  </h2>
                  <p class="text-xs text-slate-400">
                    Ingresa el fondo inicial asignado a la gaveta de caja para iniciar el turno.
                  </p>
                </div>

                <div class="space-y-4">
                  <div>
                    <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      Fondo Inicial en Efectivo (S/) *
                    </label>
                    <div class="relative">
                      <span class="absolute left-4 top-1/2 -translate-y-1/2 text-polleria-gold font-bold">S/</span>
                      <input
                        type="number"
                        [(ngModel)]="montoAperturaInput"
                        step="0.10"
                        min="0"
                        placeholder="200.00"
                        class="w-full pl-10 pr-4 py-3.5 bg-black/40 border border-white/10 rounded-xl text-lg font-bold text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      Observaciones de Apertura (Opcional)
                    </label>
                    <textarea
                      [(ngModel)]="observacionesAperturaInput"
                      rows="2"
                      placeholder="Ej: Turno mañana, billetes de S/ 20 y monedas para vuelto"
                      class="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                    ></textarea>
                  </div>

                  <button
                    type="button"
                    (click)="ejecutarAperturaCaja()"
                    [disabled]="montoAperturaInput < 0 || procesandoAccion()"
                    class="w-full py-4 bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-display text-xl font-bold tracking-wider uppercase rounded-xl transition duration-150 cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                  >
                    @if (procesandoAccion()) {
                      <span>ABRIENDO CAJA...</span>
                    } @else {
                      <span>CONFIRMAR APERTURA DE TURNO</span>
                    }
                  </button>
                </div>
              </div>
            } @else {
              <!-- Panel de Caja Abierta -->
              <div class="space-y-6">
                
                <!-- Tarjeta Principal de Resumen -->
                <div class="p-6 rounded-3xl bg-gradient-to-r from-emerald-950/30 to-[#14161a] border border-emerald-500/30 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <div class="flex items-center gap-2 mb-1">
                      <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500 text-slate-950">
                        Caja #{{ financeService.cajaActual()?.id }} ABIERTA
                      </span>
                      <span class="text-xs text-slate-400 font-mono">
                        {{ financeService.cajaActual()?.fechaApertura | date:'medium' }}
                      </span>
                    </div>
                    <h2 class="text-lg font-bold text-white">
                      Responsable: {{ financeService.cajaActual()?.usuarioNombre || auth.currentUser()?.nombre || 'Cajero' }}
                    </h2>
                  </div>

                  <!-- Botones de Acción: Movimiento y Cierre -->
                  <div class="flex items-center gap-3 w-full md:w-auto">
                    <button
                      type="button"
                      (click)="abrirModalMovimiento()"
                      class="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-xs font-bold text-white uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      <svg class="w-4 h-4 text-polleria-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                      </svg>
                      <span>Movimiento Caja Chica</span>
                    </button>

                    <button
                      type="button"
                      (click)="abrirModalCierre()"
                      class="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-xs font-bold text-rose-300 uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                      </svg>
                      <span>Cerrar Caja / Arqueo</span>
                    </button>
                  </div>
                </div>

                <!-- Grid de Métricas Financieras de la Caja -->
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 space-y-1">
                    <span class="text-[11px] text-slate-400 uppercase font-bold">Fondo Inicial Apertura</span>
                    <p class="font-display text-2xl text-slate-100 font-bold">
                      {{ (financeService.cajaActual()?.montoApertura || 0) | currencyPEN }}
                    </p>
                  </div>

                  <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 space-y-1">
                    <span class="text-[11px] text-emerald-400 uppercase font-bold">Ingresos Extras</span>
                    <p class="font-display text-2xl text-emerald-300 font-bold">
                      +{{ totalIngresosCaja() | currencyPEN }}
                    </p>
                  </div>

                  <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 space-y-1">
                    <span class="text-[11px] text-rose-400 uppercase font-bold">Egresos / Gastos Menores</span>
                    <p class="font-display text-2xl text-rose-300 font-bold">
                      -{{ totalEgresosCaja() | currencyPEN }}
                    </p>
                  </div>

                  <div class="p-4 rounded-2xl bg-[#14161a] border border-polleria-gold/40 space-y-1">
                    <span class="text-[11px] text-polleria-gold uppercase font-bold">Saldo Teórico en Gaveta</span>
                    <p class="font-display text-2xl text-polleria-gold font-bold">
                      {{ saldoTeoricoActual() | currencyPEN }}
                    </p>
                  </div>
                </div>

                <!-- Tabla de Movimientos de Caja Chica -->
                <div class="p-5 rounded-2xl bg-[#14161a] border border-white/10 space-y-4">
                  <div class="flex items-center justify-between">
                    <h3 class="font-bold text-sm text-white uppercase tracking-wider flex items-center gap-2">
                      <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                      </svg>
                      <span>Movimientos de Caja del Turno</span>
                    </h3>
                    <span class="text-xs text-slate-400 font-mono">
                      {{ financeService.movimientos().length }} registros
                    </span>
                  </div>

                  <div class="overflow-x-auto">
                    <table class="w-full text-left text-xs">
                      <thead>
                        <tr class="border-b border-white/10 text-slate-400 uppercase text-[10px] tracking-wider font-extrabold">
                          <th class="py-2.5 px-3">Hora</th>
                          <th class="py-2.5 px-3">Tipo</th>
                          <th class="py-2.5 px-3">Monto</th>
                          <th class="py-2.5 px-3">Concepto / Motivo</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-white/5 font-medium">
                        @for (mov of financeService.movimientos(); track mov.id) {
                          <tr class="hover:bg-white/5 transition">
                            <td class="py-2.5 px-3 font-mono text-slate-400">
                              {{ mov.fecha | date:'shortTime' }}
                            </td>
                            <td class="py-2.5 px-3">
                              @if (mov.tipo === 'INGRESO') {
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  INGRESO
                                </span>
                              } @else {
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                  EGRESO
                                </span>
                              }
                            </td>
                            <td class="py-2.5 px-3 font-mono font-bold"
                              [ngClass]="mov.tipo === 'INGRESO' ? 'text-emerald-400' : 'text-rose-400'"
                            >
                              {{ mov.tipo === 'INGRESO' ? '+' : '-' }}{{ mov.monto | currencyPEN }}
                            </td>
                            <td class="py-2.5 px-3 text-slate-300">
                              {{ mov.motivo || mov.concepto || 'Sin motivo' }}
                            </td>
                          </tr>
                        } @empty {
                          <tr>
                            <td colspan="4" class="py-8 text-center text-slate-500">
                              No hay movimientos registrados en la caja actual.
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            }

          }

          <!-- ================= TAB 3: HISTORIAL DE COBROS DEL DÍA ================= -->
          @if (activeTab() === 'HISTORIAL') {
            <div class="p-5 rounded-2xl bg-[#14161a] border border-white/10 space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="font-bold text-sm text-white uppercase tracking-wider">
                    Cobros Registrados en este Turno
                  </h3>
                  <p class="text-xs text-slate-400">
                    Comprobantes emitidos y pagos confirmados por el cajero
                  </p>
                </div>
                <div class="text-right">
                  <span class="text-[10px] text-slate-400 uppercase font-bold block">Total Recaudado</span>
                  <span class="font-display text-xl text-emerald-400 font-bold">
                    {{ totalCobradoHoy() | currencyPEN }}
                  </span>
                </div>
              </div>

              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs">
                  <thead>
                    <tr class="border-b border-white/10 text-slate-400 uppercase text-[10px] tracking-wider font-extrabold">
                      <th class="py-2.5 px-3">Hora</th>
                      <th class="py-2.5 px-3">Orden</th>
                      <th class="py-2.5 px-3">Cliente</th>
                      <th class="py-2.5 px-3">Tipo</th>
                      <th class="py-2.5 px-3">Método</th>
                      <th class="py-2.5 px-3">Monto</th>
                      <th class="py-2.5 px-3">Referencia</th>
                      <th class="py-2.5 px-3 text-right">Comprobante</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/5 font-medium">
                    @for (cobro of cobrosDelDia(); track cobro.id) {
                      <tr class="hover:bg-white/5 transition">
                        <td class="py-2.5 px-3 font-mono text-slate-400">
                          {{ cobro.fechaHora | date:'shortTime' }}
                        </td>
                        <td class="py-2.5 px-3 font-mono font-bold text-white">
                          #{{ cobro.codigoOrden }}
                        </td>
                        <td class="py-2.5 px-3 text-slate-200">
                          {{ cobro.clienteNombre }}
                        </td>
                        <td class="py-2.5 px-3 text-[11px] text-slate-400">
                          {{ cobro.tipoOrden }}
                        </td>
                        <td class="py-2.5 px-3">
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                            [ngClass]="claseMetodoCobro(cobro.metodo)"
                          >
                            {{ formatearMetodoCobro(cobro.metodo) }}
                          </span>
                        </td>
                        <td class="py-2.5 px-3 font-mono font-bold text-polleria-gold">
                          {{ cobro.monto | currencyPEN }}
                        </td>
                        <td class="py-2.5 px-3 font-mono text-[11px] text-slate-400 truncate max-w-[120px]">
                          {{ cobro.referencia || 'N/A' }}
                        </td>
                        <td class="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            (click)="reimprimirTicket(cobro)"
                            class="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white text-[11px] font-bold transition cursor-pointer"
                          >
                            Ticket
                          </button>
                        </td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="8" class="py-8 text-center text-slate-500">
                          Aún no se han registrado cobros en esta sesión.
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }

          <!-- ================= TAB: LLAMADAS CONTRAPAGO ================= -->
          @if (activeTab() === 'LLAMADAS_CONTRAPAGO') {
            <div class="space-y-4">
              <div class="p-5 rounded-2xl bg-[#14161a] border border-white/10 flex justify-between items-center">
                <div>
                  <h3 class="font-bold text-base text-white flex items-center gap-2">
                    <span class="w-3 h-3 rounded-full bg-amber-400 animate-pulse"></span>
                    <span>Bandeja de Confirmación de Llamadas (ContraPago)</span>
                  </h3>
                  <p class="text-xs text-slate-400">
                    SLA Máximo: 15 minutos para llamar al cliente y validar vuelto antes de cocinar. (Máximo 2 intentos).
                  </p>
                </div>
                <span class="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 font-bold text-xs border border-amber-500/30">
                  {{ ordenesPendientesLlamada().length }} llamadas pendientes
                </span>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                @for (o of ordenesPendientesLlamada(); track o.id) {
                  <div class="p-5 rounded-2xl bg-[#14161a] border border-amber-500/30 shadow-xl space-y-3">
                    <div class="flex justify-between items-start border-b border-white/10 pb-2">
                      <div>
                        <span class="font-mono text-base font-black text-amber-300">#{{ o.codigoSeguimiento || o.id }}</span>
                        <p class="text-sm font-bold text-white">{{ o.cliente.nombre }}</p>
                      </div>
                      <div class="text-right">
                        <span class="text-xs text-slate-400 block font-mono">Total a Cobrar:</span>
                        <span class="font-mono text-lg font-black text-polleria-gold">{{ o.total | currencyPEN }}</span>
                      </div>
                    </div>

                    <div class="text-xs space-y-1.5">
                      <div class="flex items-center gap-2">
                        <span class="text-slate-400 font-bold">Celular:</span>
                        <a [href]="'tel:' + o.cliente.celular" class="text-emerald-400 font-mono font-bold hover:underline">
                          📞 {{ o.cliente.celular }}
                        </a>
                      </div>
                      <div class="flex items-center gap-2">
                        <span class="text-slate-400 font-bold">Dirección:</span>
                        <span class="text-slate-200 truncate">{{ o.cliente.direccion || 'Ica' }}</span>
                      </div>
                      @if (o.cliente.referencia) {
                        <p class="text-[11px] text-slate-400 italic">Ref: {{ o.cliente.referencia }}</p>
                      }
                      <div class="p-2.5 rounded-xl bg-black/40 border border-white/5 flex justify-between items-center text-xs">
                        <span class="text-slate-300">Paga con billete: <strong class="text-white">S/ {{ o.montoPagaCon || o.total }}</strong></span>
                        <span class="text-emerald-300 font-bold font-mono">Vuelto: S/ {{ o.vueltoEstimado || 0 }}</span>
                      </div>
                      <div class="flex justify-between items-center text-[11px] pt-1 text-slate-400">
                        <span>Intentos realizados: <strong class="text-white">{{ o.intentosLlamada || 0 }} / 2</strong></span>
                        <span class="font-mono text-amber-300">⏱ Esperando respuesta</span>
                      </div>
                    </div>

                    <div class="flex items-center gap-2 pt-2 border-t border-white/10">
                      <button 
                        (click)="confirmarLlamadaPedido(o)"
                        class="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                      >
                        ✓ Confirmar y Cocinar
                      </button>
                      <button 
                        (click)="intentoLlamadaPedido(o)"
                        class="py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold text-xs transition cursor-pointer"
                        title="Registrar intento fallido de llamada"
                      >
                        📞 No Contesta
                      </button>
                      <button 
                        (click)="cancelarPedidoContraPago(o)"
                        class="py-2 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold text-xs transition cursor-pointer"
                        title="Cancelar pedido por no atender"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                } @empty {
                  <div class="col-span-2 py-12 text-center text-slate-500 bg-[#14161a] rounded-2xl border border-white/10">
                    <p class="text-sm">No hay llamadas pendientes de confirmación en este momento.</p>
                  </div>
                }
              </div>
            </div>
          }

          <!-- ================= TAB: LIQUIDACIONES DE REPARTIDORES ================= -->
          @if (activeTab() === 'LIQUIDACIONES') {
            <div class="space-y-4">
              <div class="p-5 rounded-2xl bg-[#14161a] border border-white/10 flex justify-between items-center">
                <div>
                  <h3 class="font-bold text-base text-white">Liquidación de Repartidores Vuelta por Vuelta</h3>
                  <p class="text-xs text-slate-400">Entrega de fondo de vueltos y rendición del efectivo cobrado en delivery.</p>
                </div>
                <button 
                  (click)="mostrarModalNuevaLiquidacion.set(true)"
                  class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5"
                >
                  <span>+ Entregar Fondo a Motorizado</span>
                </button>
              </div>

              <div class="overflow-x-auto rounded-2xl border border-white/10 bg-[#14161a]">
                <table class="w-full text-left text-xs">
                  <thead>
                    <tr class="border-b border-white/10 text-slate-400 uppercase text-[10px] tracking-wider font-extrabold">
                      <th class="py-3 px-4">ID</th>
                      <th class="py-3 px-4">Repartidor</th>
                      <th class="py-3 px-4">Hora Salida</th>
                      <th class="py-3 px-4">Fondo Inicial</th>
                      <th class="py-3 px-4">Cobrado Efectivo</th>
                      <th class="py-3 px-4">Total Esperado</th>
                      <th class="py-3 px-4">Estado</th>
                      <th class="py-3 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/5 font-medium">
                    @for (liq of liquidacionesAbiertas(); track liq.id) {
                      <tr class="hover:bg-white/5 transition">
                        <td class="py-3 px-4 font-mono font-bold text-white">#{{ liq.id }}</td>
                        <td class="py-3 px-4 text-slate-200 font-bold">{{ liq.repartidorNombre }}</td>
                        <td class="py-3 px-4 font-mono text-slate-400">{{ liq.creadoEn | date:'shortTime' }}</td>
                        <td class="py-3 px-4 font-mono text-polleria-gold">{{ liq.fondoInicial | currencyPEN }}</td>
                        <td class="py-3 px-4 font-mono text-emerald-400">{{ liq.totalCobradoEfectivo | currencyPEN }}</td>
                        <td class="py-3 px-4 font-mono font-bold text-white">{{ (liq.fondoInicial + liq.totalCobradoEfectivo) | currencyPEN }}</td>
                        <td class="py-3 px-4">
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {{ liq.estado }}
                          </span>
                        </td>
                        <td class="py-3 px-4 text-right">
                          <button 
                            (click)="abrirModalCierreLiquidacion(liq)"
                            class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                          >
                            Rendir Caja
                          </button>
                        </td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="8" class="py-12 text-center text-slate-500">
                          No hay liquidaciones abiertas de repartidores en este turno.
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }

          <!-- ================= TAB: MERMAS / PEDIDOS FANTASMA ================= -->
          @if (activeTab() === 'MERMAS_FANTASMA') {
            <div class="space-y-4">
              <div class="p-5 rounded-2xl bg-[#14161a] border border-white/10 flex justify-between items-center">
                <div>
                  <h3 class="font-bold text-base text-rose-300">Gestión de Pedidos Fantasma y Destino de Merma</h3>
                  <p class="text-xs text-slate-400">
                    Clasificación de productos devueltos o abandonados (Control de inventario vs Venta Rápida en Salón).
                  </p>
                </div>
                <span class="px-3 py-1 rounded-xl bg-rose-500/20 text-rose-300 font-bold text-xs border border-rose-500/30">
                  {{ ordenesFantasma().length }} incidentes
                </span>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                @for (o of ordenesFantasma(); track o.id) {
                  <div class="p-5 rounded-2xl bg-[#14161a] border border-rose-500/40 shadow-xl space-y-3">
                    <div class="flex justify-between items-start border-b border-white/10 pb-2">
                      <div>
                        <span class="font-mono text-base font-black text-rose-400">#{{ o.codigoSeguimiento || o.id }}</span>
                        <p class="text-sm font-bold text-white">{{ o.cliente.nombre }}</p>
                      </div>
                      <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                        {{ o.tipo }} • FANTASMA
                      </span>
                    </div>

                    <div class="text-xs space-y-1">
                      <p class="text-slate-300"><strong>Motivo:</strong> {{ o.motivoFantasma || 'No atendido / Abandonado' }}</p>
                      <p class="text-slate-400"><strong>Teléfono Sancionado:</strong> {{ o.cliente.celular }}</p>
                      <p class="text-slate-400"><strong>Total Pérdida:</strong> {{ o.total | currencyPEN }}</p>
                    </div>

                    <div class="p-3 rounded-xl bg-black/40 border border-white/5 text-xs">
                      @if (o.tipo === 'RECOJO_EN_TIENDA') {
                        <p class="text-amber-300 pb-2">El pedido quedó en la vitrina caliente del local.</p>
                        <div class="flex gap-2">
                          <button 
                            (click)="resolverProductoFantasma(o, 'VENTA_RAPIDA_SALON')"
                            class="flex-1 py-2 px-2.5 rounded-xl bg-polleria-gold hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer"
                          >
                            Reasignar a Salón
                          </button>
                          <button 
                            (click)="resolverProductoFantasma(o, 'MERMA_JUSTIFICADA')"
                            class="flex-1 py-2 px-2.5 rounded-xl bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-500/40 font-bold text-xs transition cursor-pointer"
                          >
                            Merma Justificada
                          </button>
                        </div>
                      } @else {
                        <p class="text-slate-300 pb-2 text-[11px]">
                          Por inocuidad bromatológica (estuvo en moto >30 min), debe registrarse como Merma Justificada.
                        </p>
                        <button 
                          (click)="resolverProductoFantasma(o, 'MERMA_JUSTIFICADA')"
                          class="w-full py-2 px-3 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs transition cursor-pointer"
                        >
                          Asentar en Libro de Mermas
                        </button>
                      }
                    </div>
                  </div>
                } @empty {
                  <div class="col-span-2 py-12 text-center text-slate-500 bg-[#14161a] rounded-2xl border border-white/10">
                    <p class="text-sm">No hay pedidos fantasma pendientes de resolución de inventario.</p>
                  </div>
                }
              </div>
            </div>
          }

        </div>
      </main>

      <!-- ================= MODAL DE COBRO DE ORDEN ================= -->
      @if (ordenSeleccionada()) {
        <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="w-full max-w-2xl bg-[#14161a] border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <!-- Modal Header -->
            <div class="p-5 border-b border-white/10 flex items-center justify-between bg-black/30">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
                  </svg>
                </div>
                <div>
                  <h3 class="font-display text-xl text-white font-bold tracking-wide">
                    COBRAR COMANDA #{{ ordenSeleccionada()?.codigoSeguimiento || ordenSeleccionada()?.id }}
                  </h3>
                  <p class="text-xs text-slate-400">
                    Cliente: {{ ordenSeleccionada()?.cliente?.nombre }} • {{ ordenSeleccionada()?.tipo }}
                  </p>
                </div>
              </div>
              <button
                type="button"
                (click)="cerrarModalCobro()"
                class="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <!-- Modal Body (Scrollable) -->
            <div class="p-5 overflow-y-auto space-y-5 flex-1">
              
              <!-- Detalle de Ítems del Pedido -->
              <div class="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-2">
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Detalle del Consumo
                </span>
                @for (item of ordenSeleccionada()?.items; track item.product.id) {
                  <div class="flex justify-between items-center text-xs">
                    <span class="text-slate-200">
                      {{ item.cantidad }}x {{ item.product.nombre }}
                    </span>
                    <span class="font-mono text-slate-400 font-semibold">
                      {{ (item.product.precio * item.cantidad) | currencyPEN }}
                    </span>
                  </div>
                }
                <div class="border-t border-white/10 pt-2 flex justify-between items-center text-sm font-bold">
                  <span class="text-white">Total a Cobrar</span>
                  <span class="font-display text-2xl text-polleria-gold">
                    {{ (ordenSeleccionada()?.total || 0) | currencyPEN }}
                  </span>
                </div>
              </div>

              <!-- Selector de Método de Pago -->
              <div>
                <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Método de Pago *
                </label>
                <div class="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    (click)="metodoCobroSeleccionado.set('EFECTIVO')"
                    class="p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1.5"
                    [ngClass]="metodoCobroSeleccionado() === 'EFECTIVO' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md' : 'bg-black/30 border-white/10 text-slate-400 hover:text-white'"
                  >
                    <span class="text-xl">💵</span>
                    <span class="text-xs font-bold">Efectivo</span>
                  </button>

                  <button
                    type="button"
                    (click)="metodoCobroSeleccionado.set('TARJETA')"
                    class="p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1.5"
                    [ngClass]="metodoCobroSeleccionado() === 'TARJETA' ? 'bg-sky-500/20 border-sky-500 text-sky-300 shadow-md' : 'bg-black/30 border-white/10 text-slate-400 hover:text-white'"
                  >
                    <span class="text-xl">💳</span>
                    <span class="text-xs font-bold">Tarjeta POS</span>
                  </button>

                  <button
                    type="button"
                    (click)="metodoCobroSeleccionado.set('YAPE_PLIN')"
                    class="p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1.5"
                    [ngClass]="metodoCobroSeleccionado() === 'YAPE_PLIN' ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-md' : 'bg-black/30 border-white/10 text-slate-400 hover:text-white'"
                  >
                    <span class="text-xl">📱</span>
                    <span class="text-xs font-bold">Yape / Plin</span>
                  </button>
                </div>
              </div>

              <!-- Campos dinámicos según Método de Pago -->
              @if (metodoCobroSeleccionado() === 'EFECTIVO') {
                <div class="space-y-3 p-4 rounded-2xl bg-black/40 border border-white/10">
                  <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Efectivo Recibido *
                  </label>
                  <div class="relative">
                    <span class="absolute left-4 top-1/2 -translate-y-1/2 text-polleria-gold font-bold">S/</span>
                    <input
                      type="number"
                      [(ngModel)]="efectivoRecibidoInput"
                      step="1"
                      min="0"
                      placeholder="0.00"
                      class="w-full pl-10 pr-4 py-3 bg-black/60 border border-white/15 rounded-xl text-xl font-bold text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <!-- Botones rápidos de monto -->
                  <div class="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      (click)="efectivoRecibidoInput = ordenSeleccionada()?.total || 0"
                      class="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition cursor-pointer"
                    >
                      Exacto
                    </button>
                    <button
                      type="button"
                      (click)="sumarEfectivo(10)"
                      class="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 transition cursor-pointer"
                    >
                      +S/10
                    </button>
                    <button
                      type="button"
                      (click)="sumarEfectivo(20)"
                      class="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 transition cursor-pointer"
                    >
                      +S/20
                    </button>
                    <button
                      type="button"
                      (click)="sumarEfectivo(50)"
                      class="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 transition cursor-pointer"
                    >
                      +S/50
                    </button>
                    <button
                      type="button"
                      (click)="sumarEfectivo(100)"
                      class="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 transition cursor-pointer"
                    >
                      +S/100
                    </button>
                  </div>

                  <!-- Indicador de Vuelto en Vivo -->
                  <div class="p-3.5 rounded-xl flex items-center justify-between border"
                    [ngClass]="vueltoCalculado() >= 0 ? 'bg-emerald-950/30 border-emerald-500/40' : 'bg-rose-950/30 border-rose-500/40'"
                  >
                    <span class="text-xs font-bold uppercase tracking-wider"
                      [ngClass]="vueltoCalculado() >= 0 ? 'text-emerald-300' : 'text-rose-300'"
                    >
                      {{ vueltoCalculado() >= 0 ? 'Vuelto a Entregar:' : 'Monto insuficiente:' }}
                    </span>
                    <span class="font-display text-2xl font-bold"
                      [ngClass]="vueltoCalculado() >= 0 ? 'text-emerald-400' : 'text-rose-400'"
                    >
                      {{ (vueltoCalculado() >= 0 ? vueltoCalculado() : -vueltoCalculado()) | currencyPEN }}
                    </span>
                  </div>
                </div>
              } @else if (metodoCobroSeleccionado() === 'TARJETA') {
                <div class="space-y-3 p-4 rounded-2xl bg-black/40 border border-white/10">
                  <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Nº de Operación / Voucher POS *
                  </label>
                  <input
                    type="text"
                    [(ngModel)]="referenciaPagoInput"
                    placeholder="Ej: POS-0049281"
                    class="w-full px-4 py-3 bg-black/60 border border-white/15 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-sky-500"
                  />
                  <p class="text-[11px] text-slate-400">
                    Ingresa el número de referencia impreso en el comprobante del terminal POS.
                  </p>
                </div>
              } @else {
                <div class="space-y-3 p-4 rounded-2xl bg-black/40 border border-white/10">
                  <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Código de Aprobación Yape / Plin *
                  </label>
                  <input
                    type="text"
                    [(ngModel)]="referenciaPagoInput"
                    placeholder="Ej: YAP-94821 o Celular"
                    class="w-full px-4 py-3 bg-black/60 border border-white/15 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-purple-500"
                  />
                  <p class="text-[11px] text-slate-400">
                    Verifica que el cliente haya transferido el monto exacto de {{ (ordenSeleccionada()?.total || 0) | currencyPEN }}.
                  </p>
                </div>
              }

            </div>

            <!-- Modal Footer con Acción -->
            <div class="p-5 border-t border-white/10 bg-black/30 flex items-center justify-end gap-3">
              <button
                type="button"
                (click)="cerrarModalCobro()"
                class="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs uppercase tracking-wider transition cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                (click)="confirmarCobroComanda()"
                [disabled]="!esCobroValido() || procesandoAccion()"
                class="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-display text-lg font-black uppercase tracking-wider transition duration-150 shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                @if (procesandoAccion()) {
                  <span>PROCESANDO COBRO...</span>
                } @else {
                  <span>CONFIRMAR COBRO & EMITIR TICKET</span>
                }
              </button>
            </div>

          </div>
        </div>
      }

      <!-- ================= MODAL TICKET / COMPROBANTE DE PAGO ================= -->
      @if (ticketEmitido()) {
        <div class="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div class="w-full max-w-sm bg-white text-slate-950 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4 print:p-0 print:m-0 print:shadow-none">
            
            <!-- Encabezado Ticket -->
            <div class="text-center space-y-1 border-b border-dashed border-slate-300 pb-4">
              <h4 class="font-display text-2xl font-black tracking-wide text-slate-900">
                POLLERÍA SAN POLLO DE ICA
              </h4>
              <p class="text-[11px] text-slate-600 font-mono">
                R.U.C. 20608945123 • Sabor Criollo & Brasa
              </p>
              <p class="text-[10px] text-slate-500">
                Av. San Martín 456 - Ica, Perú
              </p>
              <div class="pt-2">
                <span class="text-xs font-bold uppercase tracking-wider bg-slate-100 px-3 py-1 rounded-md">
                  BOLETA DE VENTA ELECTRÓNICA
                </span>
                <p class="text-xs font-mono font-bold mt-1">
                  B001-{{ ticketEmitido()?.ordenId }}
                </p>
              </div>
            </div>

            <!-- Datos de la Venta -->
            <div class="text-xs space-y-1 font-mono text-slate-700 border-b border-dashed border-slate-300 pb-3">
              <div class="flex justify-between">
                <span>Fecha:</span>
                <span>{{ ticketEmitido()?.fechaHora | date:'dd/MM/yyyy HH:mm' }}</span>
              </div>
              <div class="flex justify-between">
                <span>Cajero:</span>
                <span>{{ ticketEmitido()?.cajero }}</span>
              </div>
              <div class="flex justify-between">
                <span>Cliente:</span>
                <span class="font-bold truncate max-w-[160px]">{{ ticketEmitido()?.cliente }}</span>
              </div>
              <div class="flex justify-between">
                <span>Tipo:</span>
                <span class="font-bold">{{ ticketEmitido()?.tipo }}</span>
              </div>
            </div>

            <!-- Detalle de Productos -->
            <div class="space-y-1.5 border-b border-dashed border-slate-300 pb-3 text-xs">
              <div class="flex justify-between font-bold text-slate-800 text-[11px]">
                <span>CANT / DESCRIPCIÓN</span>
                <span>TOTAL</span>
              </div>
              @for (item of ticketEmitido()?.items; track item.product.id) {
                <div class="flex justify-between text-slate-700">
                  <span class="truncate pr-2">
                    {{ item.cantidad }}x {{ item.product.nombre }}
                  </span>
                  <span class="font-mono shrink-0">
                    {{ (item.product.precio * item.cantidad) | currencyPEN }}
                  </span>
                </div>
              }
            </div>

            <!-- Totales & Cuadre -->
            <div class="space-y-1 text-xs font-mono border-b border-dashed border-slate-300 pb-3">
              <div class="flex justify-between text-slate-600">
                <span>OP. GRAVADA:</span>
                <span>{{ ((ticketEmitido()?.total || 0) / 1.18) | currencyPEN }}</span>
              </div>
              <div class="flex justify-between text-slate-600">
                <span>I.G.V. (18%):</span>
                <span>{{ ((ticketEmitido()?.total || 0) - ((ticketEmitido()?.total || 0) / 1.18)) | currencyPEN }}</span>
              </div>
              <div class="flex justify-between font-bold text-base text-slate-900 pt-1">
                <span>TOTAL:</span>
                <span>{{ ticketEmitido()?.total | currencyPEN }}</span>
              </div>
              <div class="flex justify-between text-slate-700 pt-2 border-t border-slate-200">
                <span>MÉTODO:</span>
                <span class="font-bold">{{ ticketEmitido()?.metodo }}</span>
              </div>
              @if (ticketEmitido()?.metodo === 'EFECTIVO') {
                <div class="flex justify-between text-slate-600">
                  <span>RECIBIDO:</span>
                  <span>{{ ticketEmitido()?.efectivoRecibido | currencyPEN }}</span>
                </div>
                <div class="flex justify-between font-bold text-emerald-700">
                  <span>VUELTO:</span>
                  <span>{{ ticketEmitido()?.vuelto | currencyPEN }}</span>
                </div>
              } @else {
                <div class="flex justify-between text-slate-600">
                  <span>REF / OP:</span>
                  <span>{{ ticketEmitido()?.referencia }}</span>
                </div>
              }
            </div>

            <!-- Footer Ticket -->
            <div class="text-center space-y-1 text-[11px] text-slate-500 pt-1">
              <p class="font-serif italic font-bold">¡Gracias por su preferencia!</p>
              <p class="text-[10px]">Conserve este comprobante para cualquier reclamo.</p>
            </div>

            <!-- Botones Imprimir y Cerrar (Ocultos al imprimir) -->
            <div class="flex items-center gap-2 pt-2 print:hidden">
              <button
                type="button"
                (click)="imprimirTicket()"
                class="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                </svg>
                <span>Imprimir Ticket</span>
              </button>

              <button
                type="button"
                (click)="ticketEmitido.set(null)"
                class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
              >
                Listo
              </button>
            </div>

          </div>
        </div>
      }

      <!-- ================= MODAL REGISTRO DE MOVIMIENTO CAJA CHICA ================= -->
      @if (mostrarModalMovimiento()) {
        <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="w-full max-w-md bg-[#14161a] border border-white/15 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 class="font-display text-xl text-white font-bold tracking-wide">
              REGISTRAR MOVIMIENTO DE CAJA
            </h3>

            <div class="space-y-3">
              <div>
                <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Tipo de Movimiento
                </label>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    (click)="tipoMovimientoInput = 'INGRESO'"
                    class="py-2.5 rounded-xl border text-xs font-bold uppercase tracking-wider transition cursor-pointer"
                    [ngClass]="tipoMovimientoInput === 'INGRESO' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-black/30 border-white/10 text-slate-400'"
                  >
                    + Ingreso
                  </button>
                  <button
                    type="button"
                    (click)="tipoMovimientoInput = 'EGRESO'"
                    class="py-2.5 rounded-xl border text-xs font-bold uppercase tracking-wider transition cursor-pointer"
                    [ngClass]="tipoMovimientoInput === 'EGRESO' ? 'bg-rose-500/20 border-rose-500 text-rose-300' : 'bg-black/30 border-white/10 text-slate-400'"
                  >
                    - Egreso / Retiro
                  </button>
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Monto (S/) *
                </label>
                <input
                  type="number"
                  [(ngModel)]="montoMovimientoInput"
                  step="0.50"
                  min="0.10"
                  placeholder="0.00"
                  class="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-xl text-lg font-bold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Concepto / Motivo *
                </label>
                <input
                  type="text"
                  [(ngModel)]="motivoMovimientoInput"
                  placeholder="Ej: Cambio para vuelto, compra de bolsas..."
                  class="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                (click)="mostrarModalMovimiento.set(false)"
                class="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold uppercase"
              >
                Cancelar
              </button>
              <button
                type="button"
                (click)="guardarMovimientoCaja()"
                [disabled]="montoMovimientoInput <= 0 || !motivoMovimientoInput || procesandoAccion()"
                class="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold uppercase disabled:opacity-50"
              >
                Guardar Movimiento
              </button>
            </div>
          </div>
        </div>
      }

      <!-- ================= MODAL CIERRE DE CAJA & ARQUEO ================= -->
      @if (mostrarModalCierre()) {
        <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="w-full max-w-lg bg-[#14161a] border border-white/15 rounded-3xl p-6 shadow-2xl space-y-5">
            <div>
              <h3 class="font-display text-2xl text-white font-bold tracking-wide">
                CIERRE DE CAJA & CUADRE DE ARQUEO
              </h3>
              <p class="text-xs text-slate-400">
                Cuenta el efectivo físico en gaveta e ingresa los totales para conciliar.
              </p>
            </div>

            <div class="space-y-4">
              <!-- Comparativa de saldo esperado -->
              <div class="p-3.5 rounded-2xl bg-black/40 border border-white/10 flex justify-between items-center text-xs">
                <span class="text-slate-400">Saldo Teórico Esperado en Gaveta:</span>
                <span class="font-display text-xl text-polleria-gold font-bold">
                  {{ saldoTeoricoActual() | currencyPEN }}
                </span>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Efectivo Contado en Gaveta (S/) *
                </label>
                <input
                  type="number"
                  [(ngModel)]="efectivoCierreInput"
                  step="0.50"
                  min="0"
                  placeholder="0.00"
                  class="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-xl text-lg font-bold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <!-- Diferencia en vivo -->
              <div class="p-3 rounded-xl flex items-center justify-between border"
                [ngClass]="{
                  'bg-emerald-950/20 border-emerald-500/30 text-emerald-300': diferenciaCierre() === 0,
                  'bg-sky-950/20 border-sky-500/30 text-sky-300': diferenciaCierre() > 0,
                  'bg-rose-950/20 border-rose-500/30 text-rose-300': diferenciaCierre() < 0
                }"
              >
                <span class="text-xs font-bold uppercase tracking-wider">
                  @if (diferenciaCierre() === 0) {
                    Cuadre Exacto:
                  } @else if (diferenciaCierre() > 0) {
                    Sobrante en Caja:
                  } @else {
                    Faltante en Caja:
                  }
                </span>
                <span class="font-mono text-base font-bold">
                  {{ diferenciaCierre() | currencyPEN }}
                </span>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Ventas Tarjeta POS (S/)
                  </label>
                  <input
                    type="number"
                    [(ngModel)]="posCierreInput"
                    placeholder="0.00"
                    class="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Ventas Yape / Plin (S/)
                  </label>
                  <input
                    type="number"
                    [(ngModel)]="digitalesCierreInput"
                    placeholder="0.00"
                    class="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Observaciones de Cierre (Opcional)
                </label>
                <textarea
                  [(ngModel)]="observacionesCierreInput"
                  rows="2"
                  placeholder="Detalles sobre billetes o diferencias justificadas..."
                  class="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-xs text-white"
                ></textarea>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                (click)="mostrarModalCierre.set(false)"
                class="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold uppercase"
              >
                Cancelar
              </button>
              <button
                type="button"
                (click)="ejecutarCierreCaja()"
                [disabled]="efectivoCierreInput < 0 || procesandoAccion()"
                class="px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold uppercase disabled:opacity-50"
              >
                Confirmar Cierre de Turno
              </button>
            </div>
          </div>
        </div>
      }

      <!-- MODAL APERTURA LIQUIDACIÓN MOTORIZADO -->
      @if (mostrarModalNuevaLiquidacion()) {
        <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="w-full max-w-md bg-[#14161a] border border-white/15 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 class="font-display text-xl font-bold text-white">Entregar Fondo de Vueltos a Repartidor</h3>
            <div class="space-y-3 text-xs">
              <div>
                <label class="block text-slate-300 font-bold mb-1">Nombre del Repartidor:</label>
                <input type="text" [(ngModel)]="repartidorNombreLiqInput" class="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-white font-medium" />
              </div>
              <div>
                <label class="block text-slate-300 font-bold mb-1">Fondo Inicial de Sencillo (S/):</label>
                <input type="number" [(ngModel)]="fondoInicialLiqInput" step="10" min="0" class="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-white font-mono font-bold" />
              </div>
              <div>
                <label class="block text-slate-300 font-bold mb-1">Observaciones:</label>
                <input type="text" [(ngModel)]="observacionesLiqInput" placeholder="Turno tarde / Zona San Joaquín" class="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-white" />
              </div>
            </div>
            <div class="flex justify-end gap-2 pt-3 border-t border-white/10">
              <button type="button" (click)="mostrarModalNuevaLiquidacion.set(false)" class="px-4 py-2 rounded-xl bg-white/5 text-slate-300 font-bold text-xs uppercase">Cancelar</button>
              <button type="button" (click)="ejecutarAperturaLiquidacion()" class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase">Aperturar</button>
            </div>
          </div>
        </div>
      }

      <!-- MODAL CIERRE Y RENDICIÓN DE LIQUIDACIÓN -->
      @if (mostrarModalCierreLiquidacion()) {
        <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="w-full max-w-md bg-[#14161a] border border-white/15 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 class="font-display text-xl font-bold text-white">Rendir Efectivo de Repartidor</h3>
            <div class="p-3 rounded-xl bg-black/40 border border-white/10 text-xs space-y-1">
              <p class="text-slate-300">Repartidor: <strong class="text-white">{{ liquidacionSeleccionada()?.repartidorNombre }}</strong></p>
              <p class="text-slate-300">Fondo Inicial: <strong class="text-polleria-gold">{{ (liquidacionSeleccionada()?.fondoInicial || 0) | currencyPEN }}</strong></p>
              <p class="text-slate-300">Cobrado en Ruta: <strong class="text-emerald-400">{{ (liquidacionSeleccionada()?.totalCobradoEfectivo || 0) | currencyPEN }}</strong></p>
              <p class="text-slate-200 font-bold border-t border-white/10 pt-1">Total Esperado: {{ ((liquidacionSeleccionada()?.fondoInicial || 0) + (liquidacionSeleccionada()?.totalCobradoEfectivo || 0)) | currencyPEN }}</p>
            </div>
            <div class="space-y-1 text-xs">
              <label class="block text-slate-300 font-bold mb-1">Efectivo Físico Entregado por Repartidor (S/):</label>
              <input type="number" [(ngModel)]="totalRendidoLiqInput" step="5" class="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-white font-mono text-lg font-bold" />
            </div>
            <div class="flex justify-end gap-2 pt-3 border-t border-white/10">
              <button type="button" (click)="mostrarModalCierreLiquidacion.set(false)" class="px-4 py-2 rounded-xl bg-white/5 text-slate-300 font-bold text-xs uppercase">Cancelar</button>
              <button type="button" (click)="confirmarCierreLiquidacion()" class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase">Cerrar y Cuadrar</button>
            </div>
          </div>
        </div>
      }

    </div>
  `
})
export class CajeroDashboardComponent implements OnInit, OnDestroy {
  readonly ordersService = inject(OrdersService);
  readonly paymentService = inject(PaymentService);
  readonly financeService = inject(FinanceService);
  readonly inventoryService = inject(InventoryService);
  readonly auth = inject(AuthService);
  private notify = inject(NotificationService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  // Estados reactivos
  readonly activeTab = signal<CajeroTab>('POS');
  readonly filtroTipo = signal<string>('TODAS');
  busquedaTexto = '';
  readonly cargando = signal<boolean>(false);
  readonly procesandoAccion = signal<boolean>(false);

  // Hora actual
  readonly horaActual = signal<string>('');
  private timerSub?: Subscription;
  private autoRefreshSub?: Subscription;

  // Selección de comanda para cobro
  readonly ordenSeleccionada = signal<Order | null>(null);
  readonly metodoCobroSeleccionado = signal<MetodoCobro>('EFECTIVO');
  efectivoRecibidoInput = 0;
  referenciaPagoInput = '';

  // Ticket emitido
  readonly ticketEmitido = signal<any | null>(null);

  // Modales de Caja
  montoAperturaInput = 200;
  observacionesAperturaInput = '';
  readonly mostrarModalMovimiento = signal<boolean>(false);
  tipoMovimientoInput: TipoMovimiento = 'EGRESO';
  montoMovimientoInput = 0;
  motivoMovimientoInput = '';

  readonly mostrarModalCierre = signal<boolean>(false);
  efectivoCierreInput = 0;
  posCierreInput = 0;
  digitalesCierreInput = 0;
  observacionesCierreInput = '';

  // --- Módulos Operativos Nuevos: Llamadas, Liquidaciones y Mermas ---
  readonly ordenesPendientesLlamada = computed(() =>
    this.ordersService.orders().filter(o => o.estado === 'PENDIENTE_CONFIRMACION')
  );

  readonly ordenesFantasma = computed(() =>
    this.ordersService.orders().filter(o => o.estado === 'PEDIDO_FANTASMA')
  );

  readonly liquidacionesAbiertas = signal<BackendLiquidacionResponse[]>([]);
  readonly mostrarModalNuevaLiquidacion = signal<boolean>(false);
  readonly mostrarModalCierreLiquidacion = signal<boolean>(false);
  readonly liquidacionSeleccionada = signal<BackendLiquidacionResponse | null>(null);

  repartidorIdLiqInput = 4;
  repartidorNombreLiqInput = 'Carlos Motorizado';
  fondoInicialLiqInput = 50.0;
  totalRendidoLiqInput = 0;
  observacionesLiqInput = '';

  // Registro combinado de cobros aprobados desde el microservicio de pagos
  readonly cobrosDelDia = computed(() => {
    const ordersMap = new Map(this.ordersService.orders().map(o => [String(o.id), o]));
    const pagosAprobados = this.paymentService.pagos().filter(p => p.estado === 'APROBADO');
    return pagosAprobados.map(p => {
      const o = ordersMap.get(String(p.orderId));
      return {
        id: p.id,
        fechaHora: p.fechaTransaccion,
        ordenId: p.orderId,
        codigoOrden: o?.codigoSeguimiento ? String(o.codigoSeguimiento).replace(/^POL-?/, '') : String(p.orderId),
        clienteNombre: o?.cliente?.nombre || 'Cliente San Pollo',
        tipoOrden: o?.tipo || 'DELIVERY',
        metodo: p.metodo,
        monto: p.monto,
        referencia: p.numeroOperacion || 'Cobro aprobado',
        items: o?.items || [],
        cajero: this.auth.currentUser()?.nombre || 'Cajero de Turno'
      };
    });
  });

  // Computed: Caja abierta
  readonly cajaAbierta = computed(() => {
    const caja = this.financeService.cajaActual();
    return !!caja && caja.estado === 'ABIERTA';
  });

  // Computed: Comandas que esperan cobro
  // Se excluyen pedidos cancelados, completados O que ya tengan su pago APROBADO en el backend
  readonly comandasPorCobrar = computed(() => {
    const pagosMap = this.paymentService.pagosPorOrdenMap();
    return this.ordersService.orders().filter(o => {
      if (['CANCELADO', 'COMPLETADO'].includes(o.estado) || o.estado === 'PAGADO') return false;
      const pago = pagosMap.get(String(o.id));
      return !pago || pago.estado !== 'APROBADO';
    });
  });

  readonly comandasFiltradas = computed(() => {
    let list = this.comandasPorCobrar();

    if (this.filtroTipo() !== 'TODAS') {
      list = list.filter(o => o.tipo === this.filtroTipo());
    }

    const q = this.busquedaTexto.trim().toLowerCase();
    if (q) {
      list = list.filter(o => 
        (o.codigoSeguimiento && o.codigoSeguimiento.toLowerCase().includes(q)) ||
        (o.id && o.id.toLowerCase().includes(q)) ||
        (o.cliente?.nombre && o.cliente.nombre.toLowerCase().includes(q)) ||
        (o.cliente?.mesaNumero && String(o.cliente.mesaNumero).includes(q))
      );
    }

    return list;
  });

  // Cálculos de saldo de caja
  readonly totalIngresosCaja = computed(() => {
    return this.financeService.movimientos()
      .filter(m => m.tipo === 'INGRESO')
      .reduce((sum, m) => sum + (m.monto || 0), 0);
  });

  readonly totalEgresosCaja = computed(() => {
    return this.financeService.movimientos()
      .filter(m => m.tipo === 'EGRESO')
      .reduce((sum, m) => sum + (m.monto || 0), 0);
  });

  readonly saldoTeoricoActual = computed(() => {
    const apertura = this.financeService.cajaActual()?.montoApertura || 0;
    return apertura + this.totalIngresosCaja() - this.totalEgresosCaja();
  });

  // Método (no computed): efectivoRecibidoInput es un campo plano enlazado con ngModel,
  // un computed() no detecta sus cambios y el vuelto se quedaba congelado en 0.
  vueltoCalculado(): number {
    const total = this.ordenSeleccionada()?.total || 0;
    const recibido = Number(this.efectivoRecibidoInput) || 0;
    return Math.max(0, Math.round((recibido - total) * 100) / 100);
  }

  readonly diferenciaCierre = computed(() => {
    return this.efectivoCierreInput - this.saldoTeoricoActual();
  });

  readonly totalCobradoHoy = computed(() => {
    return this.cobrosDelDia().reduce((sum, c) => sum + (c.monto || 0), 0);
  });

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.actualizarReloj();
      this.timerSub = interval(1000).subscribe(() => this.actualizarReloj());
      this.autoRefreshSub = interval(15000).subscribe(() => this.refrescarTodo());
    }

    this.refrescarTodo();
  }

  ngOnDestroy(): void {
    this.timerSub?.unsubscribe();
    this.autoRefreshSub?.unsubscribe();
  }

  private actualizarReloj(): void {
    const ahora = new Date();
    this.horaActual.set(ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  }

  refrescarTodo(): void {
    this.cargando.set(true);
    this.ordersService.loadActiveOrders();
    this.paymentService.cargarPagos().subscribe();
    this.financeService.obtenerCajaActual();
    this.financeService.cargarMovimientos();
    this.cargarLiquidaciones();
    setTimeout(() => this.cargando.set(false), 800);
  }

  seleccionarOrdenParaCobro(orden: Order): void {
    this.ordenSeleccionada.set(orden);
    this.metodoCobroSeleccionado.set('EFECTIVO');
    this.efectivoRecibidoInput = orden.total;
    this.referenciaPagoInput = '';
  }

  cerrarModalCobro(): void {
    this.ordenSeleccionada.set(null);
  }

  sumarEfectivo(adicional: number): void {
    this.efectivoRecibidoInput = (this.efectivoRecibidoInput || 0) + adicional;
  }

  esCobroValido(): boolean {
    const orden = this.ordenSeleccionada();
    if (!orden) return false;

    if (this.metodoCobroSeleccionado() === 'EFECTIVO') {
      return (Number(this.efectivoRecibidoInput) || 0) >= orden.total;
    }
    return !!this.referenciaPagoInput.trim();
  }

  confirmarCobroComanda(): void {
    const orden = this.ordenSeleccionada();
    if (!orden || !this.esCobroValido()) return;

    this.procesandoAccion.set(true);
    const metodo = this.metodoCobroSeleccionado();
    const referencia = metodo === 'EFECTIVO' 
      ? `Efectivo en caja (Recibido S/ ${this.efectivoRecibidoInput.toFixed(2)}, Vuelto S/ ${this.vueltoCalculado().toFixed(2)})`
      : this.referenciaPagoInput.trim();

    // 1. ¿La orden ya tiene un pago? (el checkout del cliente crea uno PENDIENTE).
    //    El backend solo admite un pago por orden: crear otro devuelve 409.
    this.paymentService.obtenerPorOrden(orden.id).subscribe(existente => {
      if (existente?.estado === 'APROBADO') {
        this.procesandoAccion.set(false);
        this.notify.showInfo('Comanda ya cobrada', `La comanda #${orden.codigoSeguimiento || orden.id} ya tiene un pago aprobado.`);
        this.cerrarModalCobro();
        this.refrescarTodo();
        return;
      }
      if (existente?.estado === 'CANCELADO') {
        this.procesandoAccion.set(false);
        this.notify.showError('El pago de esta orden fue cancelado; no se puede cobrar.');
        return;
      }
      if (existente) {
        // Reutilizar el pago PENDIENTE existente
        this.confirmarYRegistrar(orden, Number(existente.id), metodo, referencia);
        return;
      }
      // 2. No hay pago: crearlo y confirmarlo
      this.paymentService.iniciarPago(orden.id, orden.total, metodo as any).subscribe({
        next: (tx) => this.confirmarYRegistrar(orden, Number(tx.id), metodo, referencia),
        error: (err) => {
          this.procesandoAccion.set(false);
          this.notify.showError(this.mensajeError(err, 'No se pudo iniciar la transacción de cobro'));
        }
      });
    });
  }

  private mensajeError(err: any, fallback: string): string {
    return err?.error?.detail || err?.error?.error || err?.error?.message || fallback;
  }

  private confirmarYRegistrar(orden: Order, pagoId: number, metodo: MetodoCobro, referencia: string): void {
        this.paymentService.confirmarPago(pagoId, referencia).subscribe({
          next: (confirmado) => {
            // confirmarPago devuelve null cuando el backend falla: no mostrar un falso éxito
            if (!confirmado) {
              this.procesandoAccion.set(false);
              this.notify.showError('No se pudo confirmar el cobro en el servicio de pagos');
              return;
            }
            // 3. Si es efectivo y la caja está abierta, registrar en movimientos de caja
            if (metodo === 'EFECTIVO' && this.cajaAbierta()) {
              this.financeService.registrarMovimiento({
                tipo: 'INGRESO',
                monto: orden.total,
                motivo: `Cobro Comanda #${orden.codigoSeguimiento || orden.id} (${orden.cliente.nombre})`
              }).subscribe();
            }

            // Registrar en historial local
            const cobroReg = {
              id: Date.now(),
              fechaHora: new Date().toISOString(),
              ordenId: orden.id,
              codigoOrden: orden.codigoSeguimiento || orden.id,
              clienteNombre: orden.cliente.nombre || 'Cliente General',
              tipoOrden: orden.tipo,
              metodo: metodo,
              monto: orden.total,
              referencia: referencia,
              items: orden.items,
              cajero: this.auth.currentUser()?.nombre || 'Cajero de Turno',
              efectivoRecibido: this.efectivoRecibidoInput,
              vuelto: this.vueltoCalculado()
            };
            // Generar Ticket
            this.ticketEmitido.set(cobroReg);
            this.notify.showSuccess(`Comanda #${orden.codigoSeguimiento || orden.id} cobrada exitosamente`);
            this.procesandoAccion.set(false);
            this.cerrarModalCobro();
            this.refrescarTodo();
          },
          error: (err) => {
            this.procesandoAccion.set(false);
            this.notify.showError(this.mensajeError(err, 'No se pudo confirmar el cobro en el servicio de pagos'));
          }
        });
  }

  imprimirTicket(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.print();
    }
  }

  reimprimirTicket(cobro: any): void {
    this.ticketEmitido.set(cobro);
  }

  formatearMetodoCobro(metodo: any): string {
    if (!metodo) return 'Efectivo';
    const m = String(metodo).toUpperCase();
    if (m.includes('EFECTIVO') || m.includes('CONTRAENTREGA')) return 'Efectivo';
    if (m.includes('TARJETA') || m.includes('POS')) return 'Tarjeta POS';
    if (m.includes('YAPE') || m.includes('PLIN')) return 'Yape / Plin';
    return String(metodo);
  }

  claseMetodoCobro(metodo: any): string {
    if (!metodo) return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    const m = String(metodo).toUpperCase();
    if (m.includes('EFECTIVO') || m.includes('CONTRAENTREGA')) {
      return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    }
    if (m.includes('TARJETA') || m.includes('POS')) {
      return 'bg-sky-500/20 text-sky-300 border border-sky-500/30';
    }
    return 'bg-purple-500/20 text-purple-300 border border-purple-500/30';
  }

  // --- Operaciones de Caja ---
  ejecutarAperturaCaja(): void {
    if (this.montoAperturaInput < 0) {
      this.notify.showError('El monto de apertura no puede ser negativo');
      return;
    }

    this.procesandoAccion.set(true);
    this.financeService.abrirCaja({
      montoApertura: this.montoAperturaInput,
      usuarioNombre: this.auth.currentUser()?.nombre || 'Cajero San Pollo',
      observaciones: this.observacionesAperturaInput || undefined
    }).subscribe({
      next: () => {
        this.procesandoAccion.set(false);
        this.refrescarTodo();
      },
      error: (err) => {
        this.procesandoAccion.set(false);
        this.notify.showError(err?.error?.error || 'No se pudo abrir la caja');
      }
    });
  }

  abrirModalMovimiento(): void {
    this.tipoMovimientoInput = 'EGRESO';
    this.montoMovimientoInput = 0;
    this.motivoMovimientoInput = '';
    this.mostrarModalMovimiento.set(true);
  }

  guardarMovimientoCaja(): void {
    if (this.montoMovimientoInput <= 0 || !this.motivoMovimientoInput.trim()) {
      this.notify.showError('Ingresa un monto válido y un motivo para el movimiento');
      return;
    }

    this.procesandoAccion.set(true);
    this.financeService.registrarMovimiento({
      tipo: this.tipoMovimientoInput,
      monto: this.montoMovimientoInput,
      motivo: this.motivoMovimientoInput.trim()
    }).subscribe({
      next: () => {
        this.procesandoAccion.set(false);
        this.mostrarModalMovimiento.set(false);
      },
      error: () => {
        this.procesandoAccion.set(false);
        this.notify.showError('Error al registrar el movimiento en caja');
      }
    });
  }

  abrirModalCierre(): void {
    this.efectivoCierreInput = this.saldoTeoricoActual();
    this.posCierreInput = 0;
    this.digitalesCierreInput = 0;
    this.observacionesCierreInput = '';
    this.mostrarModalCierre.set(true);
  }

  ejecutarCierreCaja(): void {
    if (this.efectivoCierreInput < 0) {
      this.notify.showError('El efectivo contado no puede ser negativo');
      return;
    }

    this.procesandoAccion.set(true);
    this.financeService.cerrarCaja({
      montoCierreEfectivo: this.efectivoCierreInput,
      montoCierrePos: this.posCierreInput,
      ventasDigitales: this.digitalesCierreInput,
      observaciones: this.observacionesCierreInput || undefined
    }).subscribe({
      next: (arqueoCerrado) => {
        this.procesandoAccion.set(false);
        this.mostrarModalCierre.set(false);
        this.notify.showSuccess(`Caja cerrada exitosamente. Cuadre: S/ ${arqueoCerrado.diferencia?.toFixed(2) || '0.00'}`);
        this.refrescarTodo();
      },
      error: (err) => {
        this.procesandoAccion.set(false);
        this.notify.showError(err?.error?.error || 'No se pudo realizar el cierre de caja');
      }
    });
  }

  // --- Métodos de Gestión Operativa: Llamadas, Liquidaciones y Mermas ---

  confirmarLlamadaPedido(o: Order): void {
    this.ordersService.confirmarLlamada(o.id).subscribe({
      next: () => {
        this.notify.showSuccess(`Pedido #${o.codigoSeguimiento || o.id} confirmado`, 'Pasa directo a preparación en cocina.');
        // Emisión automática de comprobante Boleta en finance-service
        this.financeService.emitirComprobante({
          ordenId: Number(o.id),
          tipo: 'BOLETA',
          clienteNombre: o.cliente.nombre || 'Cliente General',
          clienteDireccion: o.cliente.direccion,
          total: o.total,
          pagadoDigitalmente: false,
          vueltoEstimado: o.vueltoEstimado
        }).subscribe();
        this.refrescarTodo();
      },
      error: (err) => {
        this.notify.showError('Error al confirmar llamada', err?.message);
      }
    });
  }

  intentoLlamadaPedido(o: Order): void {
    this.ordersService.registrarIntentoLlamada(o.id, 'Cliente no contesta llamada').subscribe({
      next: (actualizada) => {
        if (actualizada.estado === 'CANCELADO') {
          this.notify.showError(`Pedido #${o.codigoSeguimiento || o.id} cancelado`, 'Alcanzó el máximo de 2 intentos fallidos.');
        } else {
          this.notify.showInfo('Intento registrado', `Intentos: ${actualizada.intentosLlamada || 1} / 2`);
        }
        this.refrescarTodo();
      },
      error: (err) => {
        this.notify.showError('Error al registrar intento', err?.message);
      }
    });
  }

  cancelarPedidoContraPago(o: Order): void {
    const confirmar = confirm(`¿Cancelar el pedido #${o.codigoSeguimiento || o.id} por inasistencia del cliente?`);
    if (!confirmar) return;

    this.ordersService.updateOrderStatus(o.id, 'CANCELADO').subscribe({
      next: () => {
        this.notify.showInfo('Pedido cancelado', 'La comanda fue cancelada.');
        this.refrescarTodo();
      },
      error: (err) => {
        this.notify.showError('Error al cancelar pedido', err?.message);
      }
    });
  }

  cargarLiquidaciones(): void {
    this.financeService.listarLiquidacionesAbiertas().subscribe({
      next: (list) => this.liquidacionesAbiertas.set(list || [])
    });
  }

  ejecutarAperturaLiquidacion(): void {
    if (this.fondoInicialLiqInput < 0) {
      this.notify.showError('El fondo inicial no puede ser negativo');
      return;
    }

    this.financeService.abrirLiquidacion({
      repartidorId: this.repartidorIdLiqInput,
      repartidorNombre: this.repartidorNombreLiqInput,
      fondoInicial: this.fondoInicialLiqInput,
      observaciones: this.observacionesLiqInput || undefined
    }).subscribe({
      next: (liq) => {
        this.mostrarModalNuevaLiquidacion.set(false);
        this.notify.showSuccess(`Liquidación #${liq.id} aperturada para ${liq.repartidorNombre}`);
        this.refrescarTodo();
      },
      error: (err) => {
        this.notify.showError('Error al aperturar liquidación', err?.error?.message || err?.message);
      }
    });
  }

  abrirModalCierreLiquidacion(liq: BackendLiquidacionResponse): void {
    this.liquidacionSeleccionada.set(liq);
    this.totalRendidoLiqInput = (liq.fondoInicial || 0) + (liq.totalCobradoEfectivo || 0);
    this.mostrarModalCierreLiquidacion.set(true);
  }

  confirmarCierreLiquidacion(): void {
    const liq = this.liquidacionSeleccionada();
    if (!liq) return;

    this.financeService.cerrarLiquidacion(liq.id, {
      totalRendido: this.totalRendidoLiqInput,
      totalCobradoEfectivo: liq.totalCobradoEfectivo,
      observaciones: 'Cuadre en caja de turno'
    }).subscribe({
      next: (cerrada) => {
        this.mostrarModalCierreLiquidacion.set(false);
        this.liquidacionSeleccionada.set(null);
        this.notify.showSuccess(`Liquidación #${cerrada.id} cerrada. Diferencia: S/ ${cerrada.diferencia.toFixed(2)} (${cerrada.estado})`);
        this.refrescarTodo();
      },
      error: (err) => {
        this.notify.showError('Error al cerrar liquidación', err?.error?.message || err?.message);
      }
    });
  }

  resolverProductoFantasma(o: Order, destino: 'VENTA_RAPIDA_SALON' | 'MERMA_JUSTIFICADA'): void {
    const tipo = o.tipo === 'RECOJO_EN_TIENDA' ? 'RECOJO' : 'DELIVERY';
    this.inventoryService.resolverProductoFantasma({
      ordenId: Number(o.id),
      ordenTipo: tipo,
      destino: destino,
      observaciones: `Resuelto por cajero: ${destino}`
    }).subscribe({
      next: () => {
        this.notify.showSuccess(`Destino registrado: ${destino === 'VENTA_RAPIDA_SALON' ? 'Reasignado a mostrador' : 'Merma Justificada'}`);
        this.refrescarTodo();
      },
      error: (err) => {
        this.notify.showError('Error al resolver producto', err?.message);
      }
    });
  }

  cerrarSesion(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
