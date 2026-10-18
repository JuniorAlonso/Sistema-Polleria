import { Component, inject, signal, computed, effect, untracked, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Subscription, interval, forkJoin } from 'rxjs';
import { OrdersService } from '../../../core/services/orders.service';
import { ProductsService } from '../../../core/services/products.service';
import { AuthService } from '../../../core/services/auth.service';
import { SalonService, ZonaSalonConfig } from '../../../core/services/salon.service';
import { InventoryService } from '../../../core/services/inventory.service';
import { FinanceService } from '../../../core/services/finance.service';
import { FeedbackService } from '../../../core/services/feedback.service';
import { SecurityAuditService } from '../../../core/services/security-audit.service';
import { RepartidoresService } from '../../../core/services/repartidores.service';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { NotificationService } from '../../../core/services/notification.service';
import { WhatsappNotificationsService } from '../../../core/services/whatsapp-notifications.service';
import { Order, OrderStatus, OrderType, PaymentMethod } from '../../../core/models/order.model';
import { Product } from '../../../core/models/product.model';
import { MesaSalon, MesaEstado, SalonZona } from '../../../core/models/table.model';
import { Insumo, RegistroMerma, MotivoMerma, InsumoCategoria } from '../../../core/models/inventory.model';
import { CajaSesion, MovimientoCaja, BalanceDiario, TipoMovimiento } from '../../../core/models/finance.model';
import { Resenia, ReporteReclamo, MotivoReclamo } from '../../../core/models/feedback.model';
import { IncidenteOperativo, IpBloqueada } from '../../../core/models/incident.model';
import { EstadoNotificacion, TipoNotificacion } from '../../../core/models/notification-log.model';

export type DashboardTab = 
  | 'ORDENES' 
  | 'MESAS' 
  | 'INVENTARIO' 
  | 'REPARTO' 
  | 'FINANZAS' 
  | 'FEEDBACK' 
  | 'NOTIFICACIONES' 
  | 'SOPORTE';

export type TableSalon = MesaSalon;
export type InsumoAlmacen = Insumo;

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CurrencyPENPipe],
  template: `
    <div class="min-h-screen bg-[#0d0e11] text-slate-100 font-sans selection:bg-polleria-gold selection:text-slate-900 flex flex-col md:flex-row">
      
      <!-- ================= SIDEBAR LATERAL NAVIGATION ================= -->
      <aside class="w-full md:w-64 bg-[#14161a] border-r border-white/10 flex flex-col shrink-0 md:sticky md:top-0 md:h-screen z-40">
        
        <!-- Sidebar Brand Header -->
        <div class="h-16 px-5 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
          <a routerLink="/" class="flex items-center gap-1.5 leading-none">
            <span class="font-display text-2xl font-black text-polleria-crimson tracking-wider">
              SAN POLLO
            </span>
            <span class="font-display text-2xl font-black text-polleria-gold tracking-wider">
              ADMIN
            </span>
          </a>
        </div>

        <!-- Sidebar Navigation Menu -->
        <nav class="flex-1 p-3.5 space-y-1 overflow-y-auto no-scrollbar">
          <div class="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 px-3 py-1.5">
            Gestión Principal
          </div>

          <button 
            type="button"
            (click)="activeTab.set('ORDENES')"
            class="w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold transition cursor-pointer"
            [ngClass]="activeTab() === 'ORDENES' ? 'bg-polleria-gold/15 text-polleria-gold border border-polleria-gold/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-polleria-gold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/>
              </svg>
              <span>Órdenes</span>
            </div>
            <span class="px-2 py-0.5 rounded-md bg-black/40 text-[11px] font-bold text-slate-300">
              {{ ordersService.orders().length }}
            </span>
          </button>

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
              <span>Mesas & Salón</span>
            </div>
          </button>

          <button 
            type="button"
            (click)="activeTab.set('INVENTARIO')"
            class="w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold transition cursor-pointer"
            [ngClass]="activeTab() === 'INVENTARIO' ? 'bg-polleria-gold/15 text-polleria-gold border border-polleria-gold/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-polleria-gold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
              </svg>
              <span>Inventario</span>
            </div>
          </button>

          <div class="pt-3 pb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 px-3">
            Operaciones & Reportes
          </div>

          <button 
            type="button"
            (click)="activeTab.set('REPARTO')"
            class="w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold transition cursor-pointer"
            [ngClass]="activeTab() === 'REPARTO' ? 'bg-polleria-gold/15 text-polleria-gold border border-polleria-gold/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-polleria-gold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h2m-6 0a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/>
              </svg>
              <span>Reparto</span>
            </div>
          </button>

          <button 
            type="button"
            (click)="activeTab.set('FINANZAS')"
            class="w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold transition cursor-pointer"
            [ngClass]="activeTab() === 'FINANZAS' ? 'bg-polleria-gold/15 text-polleria-gold border border-polleria-gold/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-polleria-gold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span>Finanzas</span>
            </div>
          </button>

          <button 
            type="button"
            (click)="activeTab.set('FEEDBACK')"
            class="w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold transition cursor-pointer"
            [ngClass]="activeTab() === 'FEEDBACK' ? 'bg-polleria-gold/15 text-polleria-gold border border-polleria-gold/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-polleria-gold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
              </svg>
              <span>Feedback</span>
            </div>
          </button>

          <button 
            type="button"
            (click)="activeTab.set('NOTIFICACIONES'); cargarNotificaciones()"
            class="w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold transition cursor-pointer"
            [ngClass]="activeTab() === 'NOTIFICACIONES' ? 'bg-polleria-gold/15 text-polleria-gold border border-polleria-gold/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-polleria-gold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
              </svg>
              <span>WhatsApp</span>
            </div>
          </button>

          <button 
            type="button"
            (click)="activeTab.set('SOPORTE')"
            class="w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold transition cursor-pointer"
            [ngClass]="activeTab() === 'SOPORTE' ? 'bg-polleria-gold/15 text-polleria-gold border border-polleria-gold/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-polleria-gold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              <span>Soporte</span>
            </div>
          </button>
        </nav>

        <!-- Sidebar User Footer -->
        <div class="p-3 border-t border-white/10 bg-[#101215] shrink-0">
          <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/5">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-8 h-8 rounded-full ring-2 ring-polleria-crimson overflow-hidden bg-slate-800 flex items-center justify-center text-xs font-black text-polleria-gold shrink-0 shadow">
                <span>{{ (authService.currentUser()?.nombre?.substring(0, 2) || 'AD') | uppercase }}</span>
              </div>
              <div class="flex flex-col text-left leading-tight min-w-0">
                <span class="text-xs font-bold text-white truncate">
                  {{ authService.currentUser()?.nombre || 'Administrador' }}
                </span>
                <span class="text-[10px] font-mono text-polleria-gold font-bold">
                  {{ authService.currentUser()?.rol || 'ADMIN' }}
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
          
          <!-- Current Section Title -->
          <div class="flex items-center gap-2.5">
            <h1 class="text-base sm:text-lg font-extrabold text-white tracking-wide uppercase">
              {{ getActiveTabLabel() }}
            </h1>
          </div>

          <!-- Top Actions -->
          <div class="flex items-center gap-3">
            <button 
              type="button"
              (click)="activeTab.set('INVENTARIO'); inventarioSubTab.set('CARTA')"
              class="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 hover:text-white border border-white/10 transition cursor-pointer"
            >
              <svg class="w-3.5 h-3.5 text-polleria-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
              </svg>
              <span>Ver Carta</span>
            </button>

            <button 
              type="button"
              (click)="ordersService.loadActiveOrders(); notify.showSuccess('Órdenes sincronizadas con el backend')"
              class="px-3 py-1.5 rounded-xl bg-polleria-gold/10 hover:bg-polleria-gold text-polleria-gold hover:text-slate-950 border border-polleria-gold/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow"
              title="Refrescar órdenes manualmente"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              <span>Sincronizar</span>
            </button>
          </div>

        </header>


      <!-- ================= TAB 1: KANBAN PRODUCTION BOARD (ÓRDENES) ================= -->
      @if (activeTab() === 'ORDENES') {
        <main class="flex-1 p-4 sm:p-6 overflow-x-auto space-y-4">

          @if (ordersService.hasError()) {
            <div class="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3" role="alert">
              <span>Sin conexión con el servicio de pedidos. Los pedidos pueden estar desactualizados.</span>
              <button
                type="button"
                (click)="ordersService.loadActiveOrders()"
                class="px-2.5 py-1 rounded bg-rose-600/30 hover:bg-rose-600 text-white font-bold transition text-[11px] cursor-pointer shrink-0"
              >
                Reintentar
              </button>
            </div>
          }
          
          <!-- Top Filter & Action Bar -->
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#14161a] p-3.5 rounded-2xl border border-white/10 shadow">
            
            <!-- State Filters -->
            <div class="flex items-center gap-1.5 text-xs bg-black/40 p-1 rounded-xl border border-white/5 overflow-x-auto no-scrollbar">
              <button 
                type="button"
                (click)="orderStateFilter.set('TODAS')"
                class="px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0"
                [ngClass]="orderStateFilter() === 'TODAS' ? 'bg-polleria-gold text-slate-950 shadow' : 'text-slate-400 hover:text-white'"
              >
                <span>TODAS</span>
                <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" [ngClass]="orderStateFilter() === 'TODAS' ? 'bg-black/20 text-slate-950' : 'bg-white/10 text-slate-300'">{{ ordersService.orders().length }}</span>
              </button>
              <button 
                type="button"
                (click)="orderStateFilter.set('NUEVAS')"
                class="px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0"
                [ngClass]="orderStateFilter() === 'NUEVAS' ? 'bg-rose-500 text-white shadow' : 'text-slate-400 hover:text-white'"
              >
                <span class="w-2 h-2 rounded-full bg-rose-400"></span>
                <span>NUEVAS ORDENES</span>
                <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" [ngClass]="orderStateFilter() === 'NUEVAS' ? 'bg-black/30 text-white' : 'bg-white/10 text-slate-300'">{{ getNewOrdersRawCount() }}</span>
              </button>
              <button 
                type="button"
                (click)="orderStateFilter.set('PREPARANDOSE')"
                class="px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0"
                [ngClass]="orderStateFilter() === 'PREPARANDOSE' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'"
              >
                <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>PREPARANDOSE</span>
                <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" [ngClass]="orderStateFilter() === 'PREPARANDOSE' ? 'bg-black/30 text-slate-950' : 'bg-white/10 text-slate-300'">{{ getPreparingOrdersRawCount() }}</span>
              </button>
              <button 
                type="button"
                (click)="orderStateFilter.set('EN_CAMINO')"
                class="px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0"
                [ngClass]="orderStateFilter() === 'EN_CAMINO' ? 'bg-sky-500 text-white shadow' : 'text-slate-400 hover:text-white'"
              >
                <span class="w-2 h-2 rounded-full bg-sky-400"></span>
                <span>EN CAMINO</span>
                <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" [ngClass]="orderStateFilter() === 'EN_CAMINO' ? 'bg-black/30 text-white' : 'bg-white/10 text-slate-300'">{{ getDispatchedOrdersRawCount() }}</span>
              </button>
              <button 
                type="button"
                (click)="orderStateFilter.set('COMPLETADO')"
                class="px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0"
                [ngClass]="orderStateFilter() === 'COMPLETADO' ? 'bg-emerald-500 text-white shadow' : 'text-slate-400 hover:text-white'"
              >
                <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>COMPLETADO</span>
                <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" [ngClass]="orderStateFilter() === 'COMPLETADO' ? 'bg-black/30 text-white' : 'bg-white/10 text-slate-300'">{{ getCompletedOrdersRawCount() }}</span>
              </button>
            </div>

            <!-- New Manual Order Button -->
            <div class="flex items-center gap-2">
              <button 
                (click)="abrirModalNuevaOrden()"
                class="px-4 py-2 bg-polleria-crimson hover:bg-polleria-crimsonHover text-white font-bold text-xs rounded-xl transition shadow flex items-center gap-1.5 cursor-pointer"
              >
                <span>+ Nueva Orden Manual</span>
              </button>
            </div>

          </div>

          <!-- Kanban Grid -->
          <div [ngClass]="orderStateFilter() === 'TODAS' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 min-w-[960px] h-[calc(100vh-175px)]' : 'grid grid-cols-1 max-w-xl mx-auto w-full gap-4 h-[calc(100vh-175px)]'">
            
            <!-- COLUMN 1: NUEVAS ORDENES -->
            @if (orderStateFilter() === 'TODAS' || orderStateFilter() === 'NUEVAS') {
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
                    <div 
                      (click)="selectedOrderForModal.set(order)"
                      class="p-4 rounded-xl bg-[#1c1f24] border border-white/5 hover:border-polleria-gold/50 transition space-y-3 shadow-md cursor-pointer group"
                    >
                      <!-- Card Header -->
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <span class="font-mono text-base font-black text-white group-hover:text-polleria-gold transition">
                            #{{ getCodeNum(order.codigoSeguimiento) }}
                          </span>
                          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                            {{ order.tipo }}
                          </span>
                        </div>
                        <span class="text-xs font-bold text-slate-300">
                          {{ order.cliente.nombre }}
                        </span>
                      </div>

                      <!-- Items -->
                      <div class="text-xs text-slate-300 space-y-1">
                        @for (item of order.items; track item.product.id) {
                          <p class="line-clamp-1">
                            <strong class="text-white">{{ item.cantidad }}x</strong> {{ item.product.nombre }}
                          </p>
                        }
                        @if (order.cliente.referencia || order.notasGenerales) {
                          <p class="text-[11px] text-slate-400 italic line-clamp-1">
                            Nota: {{ order.cliente.referencia || order.notasGenerales }}
                          </p>
                        }
                      </div>

                      <!-- Price & Action Button (ACCEPT) -->
                      <div class="pt-2 border-t border-white/5 flex items-center justify-between">
                        <span class="font-display text-xl font-bold text-polleria-gold">
                          {{ order.total | currencyPEN }}
                        </span>

                        <div class="flex items-center gap-1.5" (click)="$event.stopPropagation()">
                          <button 
                            (click)="cancelarOrden(order)"
                            class="p-1.5 rounded-lg bg-white/5 hover:bg-rose-600/30 text-rose-400 transition"
                            title="Cancelar pedido"
                          >
                            ✕
                          </button>
                          <button 
                            (click)="advanceOrderStatus(order, 'EN_PREPARACION')"
                            class="px-4 py-1.5 rounded-lg bg-[#2a2e36] hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-xs"
                          >
                            ACEPTAR
                          </button>
                        </div>
                      </div>

                    </div>
                  }
                </div>

              </div>
            }


            <!-- COLUMN 2: PREPARANDOSE -->
            @if (orderStateFilter() === 'TODAS' || orderStateFilter() === 'PREPARANDOSE') {
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
                    <div 
                      (click)="selectedOrderForModal.set(order)"
                      class="p-4 rounded-xl bg-[#1c1f24] border-l-4 border-l-amber-400 border-white/5 space-y-3 shadow-md cursor-pointer group hover:border-slate-500 transition"
                    >
                      <!-- Card Header -->
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <span class="font-mono text-base font-black text-white group-hover:text-polleria-gold transition">
                            #{{ getCodeNum(order.codigoSeguimiento) }}
                          </span>
                          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                            {{ order.tipo }}
                          </span>
                        </div>
                        <span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">
                          {{ order.estado === 'LISTO_COCINA' ? 'Listo en Horno' : 'Cocinando' }}
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
                      <div class="pt-2 border-t border-white/5 flex items-center justify-between" (click)="$event.stopPropagation()">
                        <div class="flex items-center gap-1.5 text-xs text-slate-400">
                          <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"/>
                          </svg>
                          <span>{{ order.cliente.nombre }}</span>
                        </div>

                        @if (order.estado === 'EN_PREPARACION') {
                          <button 
                            (click)="marcarListo(order)"
                            class="px-4 py-1.5 rounded-lg bg-[#2a2e36] hover:bg-amber-600 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-xs"
                          >
                            <span>LISTO</span>
                          </button>
                        } @else {
                          <button 
                            (click)="advanceAfterReady(order)"
                            class="px-4 py-1.5 rounded-lg text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-xs flex items-center gap-1.5"
                            [ngClass]="order.tipo === 'DELIVERY' ? 'bg-amber-600/30 hover:bg-amber-500 text-amber-200 hover:text-slate-950 border border-amber-500/40' : 'bg-[#2a2e36] hover:bg-purple-600'"
                          >
                            @if (order.tipo === 'DELIVERY') {
                              <span>🛵</span>
                            }
                            <span>{{ order.tipo === 'DELIVERY' ? 'A REPARTO' : 'ENTREGAR' }}</span>
                          </button>
                        }
                      </div>

                    </div>
                  }
                </div>

              </div>
            }


            <!-- COLUMN 3: ENVIADO / EN REPARTO -->
            @if (orderStateFilter() === 'TODAS' || orderStateFilter() === 'EN_CAMINO') {
              <div class="bg-[#eceef1] text-slate-900 rounded-2xl border border-slate-300 flex flex-col overflow-hidden shadow-xl">
                
                <!-- Column Header -->
                <div class="p-4 border-b border-slate-300 flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <svg class="w-5 h-5 text-slate-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h2m-6 0a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/>
                    </svg>
                    <h2 class="font-display text-lg tracking-wider uppercase text-slate-950 font-bold">
                      EN CAMINO
                    </h2>
                  </div>
                  <span class="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-black flex items-center justify-center font-mono">
                    {{ getDispatchedOrders().length }}
                  </span>
                </div>

                <!-- Orders Cards List -->
                <div class="flex-1 p-3 space-y-3 overflow-y-auto">
                  @for (order of getDispatchedOrders(); track order.id) {
                    <div 
                      (click)="selectedOrderForModal.set(order)"
                      class="p-4 rounded-xl bg-[#1c1f24] text-white border border-white/5 space-y-3 shadow-md cursor-pointer hover:border-slate-400 transition"
                    >
                      <!-- Card Header -->
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <span class="font-mono text-base font-black text-white">#{{ getCodeNum(order.codigoSeguimiento) }}</span>
                          <span class="font-bold text-xs text-slate-300">
                            {{ order.cliente.nombre }}
                          </span>
                        </div>
                        <span class="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-mono font-bold">
                          En ruta
                        </span>
                      </div>

                      <!-- Items -->
                      <div class="text-xs text-slate-400 space-y-1">
                        @for (item of order.items; track item.product.id) {
                          <p class="line-clamp-1">{{ item.cantidad }}x {{ item.product.nombre }}</p>
                        }
                        <p class="text-[11px] text-slate-300 truncate">Dir: {{ order.cliente.direccion }}</p>
                        @if (order.repartidorId) {
                          <div class="flex items-center gap-1.5 text-[10px] text-amber-300 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 w-fit">
                            <span>🛵</span>
                            <span>{{ nombreMotorizado(order) }}</span>
                          </div>
                        }
                      </div>

                      <!-- Bottom -->
                      <div class="pt-2 border-t border-white/5 flex items-center justify-between" (click)="$event.stopPropagation()">
                        <span class="font-display text-xl font-bold text-rose-500">
                          {{ order.total | currencyPEN }}
                        </span>

                        <button 
                          (click)="advanceOrderStatus(order, 'COMPLETADO')"
                          class="px-3.5 py-1.5 rounded bg-rose-600 hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow"
                          title="Marcar como entregado"
                        >
                          ENTREGADO
                        </button>
                      </div>

                    </div>
                  }
                </div>

              </div>
            }


            <!-- COLUMN 4: COMPLETADO -->
            @if (orderStateFilter() === 'TODAS' || orderStateFilter() === 'COMPLETADO') {
              <div class="bg-[#f59e0b] text-slate-950 rounded-2xl border border-amber-600 flex flex-col overflow-hidden shadow-2xl">
                
                <!-- Column Header -->
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
                    {{ getCompletedOrders().length }}
                  </span>
                </div>

                <!-- Orders Cards List -->
                <div class="flex-1 p-3 space-y-3 overflow-y-auto">
                  @for (order of getCompletedOrders(); track order.id) {
                    <div 
                      (click)="selectedOrderForModal.set(order)"
                      class="p-4 rounded-xl bg-[#26282e] text-white border border-white/10 space-y-2 shadow-md cursor-pointer hover:border-polleria-gold transition"
                    >
                      <div class="flex items-center justify-between">
                        <span class="font-mono text-base font-black text-white">
                          #{{ getCodeNum(order.codigoSeguimiento) }}
                        </span>
                        <span class="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                          <svg class="w-3 h-3 text-emerald-400 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>Entregado
                        </span>
                      </div>
                      <p class="text-xs text-slate-300 font-medium">{{ order.cliente.nombre }}</p>
                      <div class="flex justify-between items-center pt-1 border-t border-white/5">
                        <span class="font-display text-sm text-polleria-gold">{{ order.total | currencyPEN }}</span>
                        <span class="text-[10px] text-slate-400 font-mono">{{ order.tipo }}</span>
                      </div>
                    </div>
                  }
                </div>

              </div>
            }

          </div>

        </main>
      }


      <!-- ================= TAB 2: GESTIÓN ADMINISTRATIVA DE SALÓN & MESAS ================= -->
      @if (activeTab() === 'MESAS') {
        <main class="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
          
          <!-- Header Bar with Add Table Button -->
          <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-[#14161a] p-5 rounded-2xl border border-white/10 shadow-lg">
            <div>
              <h2 class="text-2xl font-bold text-white flex items-center gap-2">
                <svg class="w-6 h-6 text-polleria-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                </svg>
                <span>Gestión de Salón & Mesas</span>
                <span class="text-[11px] font-bold text-emerald-400 px-2.5 py-0.5 rounded-full bg-emerald-400/10 border border-emerald-400/20">
                  Modo Admin (CRUD)
                </span>
              </h2>
              <p class="text-xs text-slate-400">Control maestro de capacidad física, zonas del restaurante y coordenadas en plano espacial.</p>
            </div>
          </div>

          <!-- Summary Status Badges -->
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div class="p-3 rounded-xl bg-[#14161a] border border-white/5 flex items-center justify-between">
              <span class="text-slate-400">Total Mesas</span>
              <span class="font-bold text-white font-mono">{{ salonService.mesas().length }}</span>
            </div>
            <div class="p-3 rounded-xl bg-[#14161a] border border-emerald-500/20 flex items-center justify-between">
              <span class="text-emerald-400 flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Libres</span>
              <span class="font-bold text-emerald-400 font-mono">{{ salonService.mesasLibres().length }}</span>
            </div>
            <div class="p-3 rounded-xl bg-[#14161a] border border-rose-500/20 flex items-center justify-between">
              <span class="text-rose-400 flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Ocupadas</span>
              <span class="font-bold text-rose-400 font-mono">{{ salonService.mesasOcupadas().length }}</span>
            </div>
            <div class="p-3 rounded-xl bg-[#14161a] border border-amber-500/20 flex items-center justify-between">
              <span class="text-amber-300 flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Por Cobrar</span>
              <span class="font-bold text-amber-300 font-mono">{{ salonService.mesasPorCobrar().length }}</span>
            </div>
            <div class="p-3 rounded-xl bg-[#14161a] border border-sky-500/20 flex items-center justify-between">
              <span class="text-sky-300 flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-sky-400"></span> En Limpieza</span>
              <span class="font-bold text-sky-300 font-mono">{{ salonService.mesasEnLimpieza().length }}</span>
            </div>
          </div>

          <!-- Switcher y Controles de Vista: Croquis 2D vs Catálogo -->
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#14161a] p-3 rounded-2xl border border-white/10 shadow-lg">
            <div class="flex items-center gap-2">
              <button 
                type="button"
                (click)="mesaViewMode.set('CROQUIS')"
                class="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
                [ngClass]="mesaViewMode() === 'CROQUIS' ? 'bg-polleria-gold text-slate-950 shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
                </svg>
                <span>Croquis Matricial por Zonas</span>
              </button>

              <button 
                type="button"
                (click)="mesaViewMode.set('CARDS')"
                class="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
                [ngClass]="mesaViewMode() === 'CARDS' ? 'bg-polleria-gold text-slate-950 shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
                </svg>
                <span>Vista Catálogo</span>
              </button>
            </div>

            <div class="flex items-center gap-2 flex-wrap">
              @if (mesaViewMode() === 'CROQUIS') {
                <button 
                  type="button"
                  (click)="autoOrganizarCuadricula()"
                  class="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                  title="Ordenar mesas automáticamente en casillas de la zona activa"
                >
                  <svg class="w-3.5 h-3.5 text-polleria-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                  </svg>
                  <span>Auto-organizar Zona</span>
                </button>
              }

              <button 
                type="button"
                (click)="abrirCrearMesaModal()"
                class="px-4 py-2 bg-polleria-crimson hover:bg-polleria-crimsonHover text-white font-bold text-xs rounded-xl transition shadow flex items-center gap-1.5 cursor-pointer"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
                <span>+ Crear Mesa</span>
              </button>
            </div>
          </div>

          <!-- ================= CROQUIS MATRICIAL POR ZONAS (SLIDES) ================= -->
          @if (mesaViewMode() === 'CROQUIS') {
            <div class="relative bg-[#0d0f14] border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-5 space-y-4">
              
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
                    {{ isProcesandoMesa() ? mensajeProcesandoMesa() : 'Cargando distribución del salón...' }}
                  </h4>
                  <p class="text-xs text-slate-400 mt-1 max-w-xs">
                    Por favor espere un momento mientras se sincronizan los cambios con el servidor.
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
                    class="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white border border-white/10 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
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
                    </div>
                    <span class="text-[11px] text-slate-400">
                      Cuadrícula fija de casillas: {{ currentZona().filas }} filas × {{ currentZona().columnas }} columnas
                    </span>
                  </div>

                  <button 
                    type="button"
                    (click)="nextZona()"
                    class="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white border border-white/10 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
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

              <!-- Barra de Personalización de Cuadrícula (Filas × Columnas) -->
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

                <!-- Estado de Movimiento Activo -->
                @if (mesaEnMovimiento(); as mem) {
                  <div class="flex items-center gap-2 bg-amber-500/15 border border-amber-500/40 px-3 py-1.5 rounded-xl text-amber-300 animate-pulse">
                    <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
                    </svg>
                    <span>Moviendo <strong>Mesa #{{ mem.numero }}</strong>: Toca una casilla vacía para ubicarla</span>
                    <button 
                      type="button" 
                      (click)="mesaEnMovimiento.set(null)" 
                      class="ml-2 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white font-bold text-[10px] cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                } @else {
                  <span class="text-[11px] text-slate-400 italic">
                    Toca una casilla vacía para crear una mesa, o arrastra una mesa a otra casilla.
                  </span>
                }
              </div>

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
                            'animate-pulse motion-reduce:animate-none': mesa.ordenActiva?.estadoOrden === 'LISTO' && !mesa.ordenActiva?.servidoEn,

                            'ring-4 ring-polleria-gold border-polleria-gold scale-[1.03] shadow-polleria-gold/30 z-20': selectedMesa()?.id === mesa.id,
                            'ring-4 ring-amber-400 animate-bounce z-30': mesaEnMovimiento()?.id === mesa.id
                          }"
                        >
                          <!-- Coordenadas Casilla -->
                          <div class="w-full flex justify-between items-center text-[10px]">
                            <span class="font-mono text-slate-400 opacity-60">F{{ r }}:C{{ c }}</span>
                            <span class="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-black/40">
                              {{ mesa.capacidad }}p
                            </span>
                          </div>

                          <!-- Número de Mesa Central -->
                          <div class="flex flex-col items-center my-auto">
                            <span class="font-display text-lg font-black text-white tracking-tight leading-none group-hover:text-polleria-gold transition">
                              #{{ mesa.numero }}
                            </span>
                            <span class="text-[9px] font-bold uppercase tracking-wider opacity-80 mt-0.5">
                              {{ mesa.estado }}
                            </span>
                            @if (mesa.ordenActiva?.estadoOrden === 'LISTO' && !mesa.ordenActiva?.servidoEn) {
                              <span class="mt-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[8px] font-black uppercase tracking-wider animate-pulse motion-reduce:animate-none">
                                Listo para servir
                              </span>
                            } @else if (mesa.ordenActiva?.servidoEn) {
                              <span class="mt-1 px-1.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[8px] font-black uppercase tracking-wider">
                                Servida
                              </span>
                            }
                          </div>

                          <!-- Footer de Casilla: Total & Botón Mover -->
                          <div class="w-full flex justify-between items-center pt-1 border-t border-white/10 text-[9px]">
                            @if (mesa.ordenActiva) {
                              <span class="font-mono font-bold text-polleria-gold">
                                S/{{ mesa.ordenActiva.total | number:'1.0-0' }}
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
                              <svg class="w-5 h-5 text-slate-500 group-hover:text-polleria-gold transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                              </svg>
                              <span class="text-[10px] font-bold text-slate-400 group-hover:text-white mt-1 transition">
                                + Nueva Mesa
                              </span>
                            }
                          </div>

                          <div class="w-full text-center text-[9px] text-slate-600">
                            Casilla disponible
                          </div>
                        </div>
                      }
                    }
                  }
                </div>
              </div>

            </div>
          } @else {
            <!-- ================= VISTA CATÁLOGO / TARJETAS ================= -->
            <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              @for (t of salonService.mesas(); track t.id) {
                <div 
                  (click)="selectedMesa.set(t)"
                  class="p-5 rounded-2xl border transition duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between"
                  [ngClass]="{
                    'bg-[#121418] border-white/10 hover:border-polleria-gold/50': selectedMesa()?.id !== t.id,
                    'bg-[#161920] border-polleria-gold ring-2 ring-polleria-gold/40 shadow-xl': selectedMesa()?.id === t.id
                  }"
                >
                  <div>
                    <div class="flex justify-between items-start mb-2">
                      <div class="flex items-center gap-2">
                        <span class="font-display text-xl font-bold text-white">Mesa #{{ t.numero }}</span>
                        @if (t.activo === false) {
                          <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">Inactiva</span>
                        }
                      </div>
                      <span 
                        class="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        [ngClass]="{
                          'bg-emerald-500/20 text-emerald-400': t.estado === 'LIBRE',
                          'bg-rose-500/20 text-rose-400': t.estado === 'OCUPADA',
                          'bg-amber-500/20 text-amber-300': t.estado === 'POR_COBRAR',
                          'bg-sky-500/20 text-sky-300': t.estado === 'EN_LIMPIEZA',
                          'bg-purple-500/20 text-purple-300': t.estado === 'RESERVADA'
                        }"
                      >
                        {{ t.estado }}
                      </span>
                    </div>
                    
                    <div class="text-xs space-y-1 text-slate-400">
                      <p><span class="text-slate-500">Zona:</span> <strong class="text-slate-200">{{ (t.zona || 'SALON_PRINCIPAL').replace('_', ' ') }}</strong></p>
                      <p><span class="text-slate-500">Capacidad:</span> <strong class="text-slate-200">{{ t.capacidad }} comensales</strong></p>
                      <p class="font-mono text-[11px] text-slate-500">Plano: (X: {{ t.posicionX || 0 }}, Y: {{ t.posicionY || 0 }})</p>
                    </div>

                    @if (t.ordenActiva) {
                      <div class="mt-3 p-2.5 rounded-xl bg-black/40 border border-white/5 text-xs space-y-1">
                        <div class="flex justify-between items-center text-slate-300">
                          <span>Comanda activa:</span>
                          <span class="font-mono font-bold text-polleria-gold">#{{ t.ordenActiva.codigoSeguimiento || t.ordenActiva.ordenId }}</span>
                        </div>
                        <div class="flex justify-between items-center text-slate-400">
                          <span>Total consumo:</span>
                          <span class="font-bold text-white">{{ t.ordenActiva.total | currencyPEN }}</span>
                        </div>
                        @if (t.ordenActiva.estadoOrden === 'LISTO' && !t.ordenActiva.servidoEn) {
                          <div class="flex justify-end">
                            <span class="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black uppercase tracking-wider animate-pulse motion-reduce:animate-none">Listo para servir</span>
                          </div>
                        } @else if (t.ordenActiva.servidoEn) {
                          <div class="flex justify-end">
                            <span class="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[9px] font-black uppercase tracking-wider">Servida</span>
                          </div>
                        }
                      </div>
                    }
                  </div>

                  <!-- Admin Management Actions -->
                  <div class="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-1.5" (click)="$event.stopPropagation()">
                    <button 
                      (click)="abrirEditarMesaModal(t)"
                      class="flex-1 py-1.5 px-2 bg-white/5 hover:bg-white/15 text-slate-200 hover:text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                      title="Editar propiedades de la mesa"
                    >
                      <svg class="w-3.5 h-3.5 text-polleria-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                      </svg>
                      <span>Editar</span>
                    </button>

                    <button 
                      (click)="abrirEditarCoordenadas(t)"
                      class="p-1.5 bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white rounded-lg text-xs transition cursor-pointer"
                      title="Mover posición en el plano"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
                      </svg>
                    </button>

                    <button 
                      (click)="darDeBajaMesa(t)"
                      class="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-lg text-xs transition cursor-pointer"
                      title="Dar de baja / Desactivar mesa"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  </div>

                </div>
              }
            </div>
          }

          <!-- Panel Inspector Administrativo de Mesa -->
          @if (selectedMesa(); as mesa) {
            <div class="p-6 bg-[#14161a] rounded-2xl border border-polleria-gold/30 shadow-2xl flex flex-col md:flex-row justify-between gap-6 items-center">
              <div class="space-y-1">
                <div class="flex items-center gap-3">
                  <h3 class="font-display text-2xl font-bold text-white">Inspección de Mesa #{{ mesa.numero }}</h3>
                  <span class="text-xs font-mono px-2.5 py-0.5 rounded bg-white/10 text-slate-300 font-bold">
                    Zona: {{ (mesa.zona || 'SALON_PRINCIPAL').replace('_', ' ') }}
                  </span>
                  <span class="text-xs font-mono px-2.5 py-0.5 rounded bg-polleria-gold/20 text-polleria-gold font-bold">
                    Estado: {{ mesa.estado }}
                  </span>
                </div>
                @if (mesa.ordenActiva) {
                  <p class="text-xs text-slate-300">
                    Comanda en curso <strong>#{{ mesa.ordenActiva.codigoSeguimiento || mesa.ordenActiva.ordenId }}</strong> • Monto: <strong class="text-polleria-gold">{{ mesa.ordenActiva.total | currencyPEN }}</strong> • Estado: <strong class="text-amber-300">{{ mesa.ordenActiva.estadoOrden }}</strong>
                  </p>
                  <div class="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] font-bold">
                    <span class="px-2 py-0.5 rounded-full bg-white/10 text-slate-300">Creada hace {{ mesa.ordenActiva.tiempoEsperaMinutos }} min</span>
                    <span class="text-slate-600">→</span>
                    <span class="px-2 py-0.5 rounded-full" [ngClass]="mesa.ordenActiva.estadoOrden === 'LISTO' ? 'bg-amber-500/20 text-amber-300' : 'bg-sky-500/20 text-sky-300'">
                      {{ mesa.ordenActiva.estadoOrden === 'LISTO' ? 'Lista' : 'En cocina' }}
                    </span>
                    <span class="text-slate-600">→</span>
                    @if (mesa.ordenActiva.servidoEn) {
                      <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">Servida</span>
                    } @else {
                      <span class="px-2 py-0.5 rounded-full bg-white/10 text-slate-400">Pendiente de servir</span>
                    }
                  </div>
                } @else {
                  <p class="text-xs text-slate-400">Sin comanda activa vinculada. Capacidad configurada: {{ mesa.capacidad }} personas.</p>
                }
              </div>

              <div class="flex flex-wrap gap-2">
                @if (mesa.ordenActiva) {
                  <button 
                    (click)="abrirAgregarPlatosMesa(mesa)"
                    class="px-4 py-2 bg-sky-600/20 hover:bg-sky-600/40 text-sky-300 border border-sky-500/30 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                    title="Agregar una segunda ronda a la comanda activa"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                    </svg>
                    <span>Agregar platos</span>
                  </button>
                  <button 
                    (click)="cobrarComandaMesa(mesa)"
                    class="px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                    title="Cobrar la comanda y liberar la mesa"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
                    </svg>
                    <span>Cobrar comanda</span>
                  </button>
                } @else {
                  <button 
                    (click)="abrirTomarComandaMesa(mesa)"
                    class="px-4 py-2 bg-polleria-crimson hover:bg-polleria-crimsonHover text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                    title="Tomar la comanda de esta mesa"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                    </svg>
                    <span>Tomar comanda</span>
                  </button>
                }
                <button 
                  (click)="abrirEditarMesaModal(mesa)"
                  class="px-4 py-2 bg-polleria-gold hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                  <span>Editar Parámetros</span>
                </button>
                <button 
                  (click)="darDeBajaMesa(mesa)"
                  class="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                  <span>Dar de Baja</span>
                </button>
              </div>
            </div>
          }

        </main>
      }

      <!-- ================= TAB 3: INVENTARIO & CARTA ================= -->
      @if (activeTab() === 'INVENTARIO') {
        <main class="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
          
          <!-- Sub-tab Selector -->
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 class="text-2xl font-bold text-white">Inventario & Carta de Productos</h2>
              <p class="text-xs text-slate-400">Control de platos de la carta, disponibilidad y gestión de insumos.</p>
            </div>

            <div class="flex bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
              <button 
                (click)="inventarioSubTab.set('CARTA')"
                class="px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer"
                [ngClass]="inventarioSubTab() === 'CARTA' ? 'bg-polleria-gold text-slate-950 shadow' : 'text-slate-400 hover:text-white'"
              >
                Carta & Precios
              </button>
              <button 
                (click)="inventarioSubTab.set('INSUMOS')"
                class="px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer"
                [ngClass]="inventarioSubTab() === 'INSUMOS' ? 'bg-polleria-gold text-slate-950 shadow' : 'text-slate-400 hover:text-white'"
              >
                Insumos & Lotes
              </button>
              <button 
                (click)="inventarioSubTab.set('MERMAS')"
                class="px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer"
                [ngClass]="inventarioSubTab() === 'MERMAS' ? 'bg-polleria-gold text-slate-950 shadow' : 'text-slate-400 hover:text-white'"
              >
                Mermas Diarias
              </button>
              <button 
                (click)="inventarioSubTab.set('PREDICCION')"
                class="px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer"
                [ngClass]="inventarioSubTab() === 'PREDICCION' ? 'bg-polleria-gold text-slate-950 shadow' : 'text-slate-400 hover:text-white'"
              >
                Alertas
              </button>
            </div>
          </div>

          <!-- SUB-VIEW 1: CARTA & PLATOS -->
          @if (inventarioSubTab() === 'CARTA') {
            <div class="space-y-4">
              <div class="flex justify-between items-center bg-[#1c1f24] p-4 rounded-xl border border-white/5">
                <div>
                  <h3 class="font-bold text-white">Catálogo de la Carta</h3>
                  <p class="text-xs text-slate-400">Los cambios de disponibilidad y precios se reflejan inmediatamente en la app del cliente.</p>
                </div>
                <button 
                  (click)="showCreateProductModal = true"
                  class="px-4 py-2 bg-polleria-crimson hover:bg-polleria-crimsonHover text-white font-bold text-xs rounded-xl transition shadow cursor-pointer"
                >
                  + Agregar Nuevo Plato / Combo
                </button>
              </div>

              <div class="bg-[#14161a] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
                <table class="w-full text-left text-xs">
                  <thead class="bg-black/40 border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider">
                    <tr>
                      <th class="p-4">Plato / Combo</th>
                      <th class="p-4">Categoría</th>
                      <th class="p-4">Precio Regular</th>
                      <th class="p-4 text-center">Disponibilidad en Vivo</th>
                      <th class="p-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/5">
                    @for (p of productsService.products(); track p.id) {
                      <tr class="hover:bg-white/5 transition">
                        <td class="p-4 font-bold text-white flex items-center gap-3">
                          <img [src]="p.imagenUrl" class="w-9 h-9 rounded-lg object-cover bg-slate-800" />
                          <span>{{ p.nombre }}</span>
                        </td>
                        <td class="p-4 text-slate-400">{{ p.categoria }}</td>
                        <td class="p-4 font-mono font-bold text-polleria-gold">{{ p.precio | currencyPEN }}</td>
                        <td class="p-4 text-center">
                          <button 
                            (click)="productsService.toggleAgotado(p.id); notify.showSuccess('Disponibilidad actualizada')"
                            class="px-3.5 py-1 rounded-full text-xs font-bold transition cursor-pointer"
                            [ngClass]="p.agotado ? 'bg-rose-600/30 text-rose-400 border border-rose-500/30' : 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/30'"
                          >
                            {{ p.agotado ? 'AGOTADO' : 'DISPONIBLE' }}
                          </button>
                        </td>
                        <td class="p-4 text-center">
                          <button 
                            (click)="productsService.deleteProduct(p.id); notify.showInfo('Plato eliminado de la carta')"
                            class="p-1.5 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                            title="Eliminar producto"
                          >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }

          <!-- SUB-VIEW 2: INSUMOS & DESPACHO -->
          @if (inventarioSubTab() === 'INSUMOS') {
            <div class="space-y-4">
              <div class="flex justify-between items-center bg-[#1c1f24] p-4 rounded-xl border border-white/5">
                <div>
                  <h3 class="font-bold text-white flex items-center gap-2">
                    <span>Almacén Central de Insumos</span>
                  </h3>
                  <p class="text-xs text-slate-400">Control de stock de materias primas y despacho inmediato a cocina (inventory-service :8086).</p>
                </div>
                <button 
                  (click)="abrirModalDespacho()"
                  class="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition shadow cursor-pointer"
                >
                  Despachar Lote a Cocina
                </button>
              </div>

              <div class="bg-[#14161a] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
                <table class="w-full text-left text-xs">
                  <thead class="bg-black/40 border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider">
                    <tr>
                      <th class="p-4">Insumo</th>
                      <th class="p-4">Categoría</th>
                      <th class="p-4">Stock Actual</th>
                      <th class="p-4">Stock Mínimo</th>
                      <th class="p-4">Costo Unit.</th>
                      <th class="p-4 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/5">
                    @for (ins of inventoryService.insumos(); track ins.id) {
                      <tr class="hover:bg-white/5 transition">
                        <td class="p-4 font-bold text-white">{{ ins.nombre }}</td>
                        <td class="p-4 text-slate-400">{{ ins.categoria }}</td>
                        <td class="p-4 font-mono font-bold" [ngClass]="ins.estado === 'CRITICO' ? 'text-rose-400' : 'text-slate-200'">
                          {{ ins.stockActual }} {{ ins.unidadMedida }}
                        </td>
                        <td class="p-4 text-slate-400 font-mono">{{ ins.stockMinimo }} {{ ins.unidadMedida }}</td>
                        <td class="p-4 font-mono text-slate-300">{{ ins.costoUnitario | currencyPEN }}</td>
                        <td class="p-4 text-center">
                          <span 
                            class="px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                            [ngClass]="{
                              'bg-emerald-500/20 text-emerald-400': ins.estado === 'OPTIMO',
                              'bg-amber-500/20 text-amber-300': ins.estado === 'BAJO',
                              'bg-rose-500/20 text-rose-400 animate-pulse': ins.estado === 'CRITICO'
                            }"
                          >
                            {{ ins.estado }}
                          </span>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }

          <!-- SUB-VIEW 3: MERMAS DIARIAS (FASE 6 - EN VIVO) -->
          @if (inventarioSubTab() === 'MERMAS') {
            <div class="space-y-4">
              <div class="flex justify-between items-center bg-[#1c1f24] p-4 rounded-xl border border-white/5">
                <div>
                  <h3 class="font-bold text-white flex items-center gap-2">
                    <span>Registro de Mermas de Jornada</span>
                  </h3>
                  <p class="text-xs text-slate-400">Auditoría de descarte y control de costos por merma operativa.</p>
                </div>
                <button 
                  (click)="abrirModalMerma()"
                  class="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition shadow cursor-pointer"
                >
                  + Registrar Merma
                </button>
              </div>

              <div class="bg-[#14161a] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
                <table class="w-full text-left text-xs">
                  <thead class="bg-black/40 border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider">
                    <tr>
                      <th class="p-4">Fecha</th>
                      <th class="p-4">Insumo</th>
                      <th class="p-4">Cantidad</th>
                      <th class="p-4">Motivo</th>
                      <th class="p-4">Justificación</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/5">
                    @for (m of inventoryService.mermas(); track m.id) {
                      <tr class="hover:bg-white/5 transition">
                        <td class="p-4 font-mono text-slate-400">{{ m.fecha }}</td>
                        <td class="p-4 font-bold text-white">{{ m.insumoNombre }}</td>
                        <td class="p-4 font-mono text-rose-300 font-bold">{{ m.cantidad }} {{ unidadDeInsumo(m.insumoId) }}</td>
                        <td class="p-4 text-slate-300">{{ m.motivo.replace('_', ' ') }}</td>
                        <td class="p-4 text-slate-400">{{ m.justificacion || '—' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }

          <!-- SUB-VIEW 4: PREDICCIÓN & MÉTRICAS (FASE 6 - EN VIVO) -->
          @if (inventarioSubTab() === 'PREDICCION') {
            <div class="space-y-6">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="p-5 rounded-2xl bg-[#14161a] border border-white/10 space-y-3">
                  <span class="text-xs text-slate-400 uppercase font-bold">Valor del Inventario</span>
                  <p class="font-display text-3xl font-black text-polleria-gold">
                    {{ (inventoryService.rentabilidad()?.valorTotalInventario ?? 0) | currencyPEN }}
                  </p>
                  <p class="text-xs text-slate-400">{{ inventoryService.rentabilidad()?.totalInsumos ?? 0 }} insumos registrados</p>
                </div>

                <div class="p-5 rounded-2xl bg-[#14161a] border border-white/10 space-y-3">
                  <span class="text-xs text-slate-400 uppercase font-bold">Insumos Bajo Umbral</span>
                  <p class="font-display text-3xl font-black text-rose-400">{{ inventoryService.alertas().length }}</p>
                  <p class="text-xs text-slate-300">Stock igual o por debajo del mínimo configurado.</p>
                </div>

                <div class="p-5 rounded-2xl bg-[#14161a] border border-white/10 space-y-3">
                  <span class="text-xs text-slate-400 uppercase font-bold">Costo de Mermas</span>
                  <p class="font-display text-3xl font-black text-emerald-400">
                    {{ (inventoryService.rentabilidad()?.costoTotalMermas ?? 0) | currencyPEN }}
                  </p>
                  <p class="text-xs text-slate-300">Valorizado al costo unitario de cada insumo.</p>
                </div>
              </div>

              <!-- Lista de Alertas Predictivas -->
              <div class="bg-[#14161a] rounded-2xl border border-white/10 p-5 space-y-4">
                <h3 class="font-display text-lg text-white font-bold flex items-center gap-2">
                  <span>Alertas de Abastecimiento por Umbral (RF25)</span>
                </h3>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  @for (alerta of inventoryService.alertas(); track alerta.insumoId) {
                    <div 
                      class="p-4 rounded-xl border space-y-2"
                      [ngClass]="alerta.nivelCriticidad === 'CRITICO' ? 'bg-rose-500/10 border-rose-500/30' : 'bg-amber-500/10 border-amber-500/30'"
                    >
                      <div class="flex justify-between items-start">
                        <h4 class="font-bold text-white text-sm">{{ alerta.insumoNombre }}</h4>
                        <span 
                          class="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          [ngClass]="alerta.nivelCriticidad === 'CRITICO' ? 'bg-rose-500 text-white' : 'bg-amber-400 text-slate-950'"
                        >
                          {{ alerta.nivelCriticidad }}
                        </span>
                      </div>
                      <p class="text-xs text-slate-300">
                        Stock actual: <strong class="text-white">{{ alerta.stockActual }} {{ alerta.unidadMedida }}</strong> • Mínimo configurado: <strong>{{ alerta.stockMinimoAlerta }} {{ alerta.unidadMedida }}</strong>
                      </p>
                      <p class="text-xs text-amber-300/90 font-medium italic">
                        <svg class="w-3.5 h-3.5 inline mr-1 text-polleria-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>{{ alerta.mensaje }}
                      </p>
                    </div>
                  }
                </div>
              </div>
            </div>
          }

        </main>
      }


      <!-- ================= TAB 4: REPARTO & DELIVERY (RF18, datos reales) ================= -->
      @if (activeTab() === 'REPARTO') {
        <main class="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
          <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-[#14161a] p-4 rounded-2xl border border-white/10 shadow-lg">
            <div>
              <h2 class="text-2xl font-bold text-white flex items-center gap-2">
                <span>Flota de Delivery & Asignación</span>
              </h2>
              <p class="text-xs text-slate-400">Pedidos DELIVERY en curso, tomados de orders-service (:8082).</p>
            </div>
            <div class="flex gap-2">
              <span class="px-3 py-1.5 rounded-xl bg-[#1c1f24] border border-white/10 text-xs font-mono">
                Delivery en curso: <strong class="text-polleria-gold">{{ pedidosDeliveryEnCurso().length }}</strong>
              </span>
              <button
                (click)="ordersService.loadActiveOrders()"
                class="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition cursor-pointer"
              >
                Actualizar
              </button>
            </div>
          </div>

          <p class="text-[11px] text-slate-500">
            El motorizado se elige del roster real de <strong>auth-service</strong>
            (<code>GET /auth/admin/repartidores</code>); el nombre se resuelve por id y nunca se
            inventa un repartidor ni su vehículo.
          </p>

          <div class="bg-[#14161a] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
            <table class="w-full text-left text-xs">
              <thead class="bg-black/40 border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th class="p-4">Pedido</th>
                  <th class="p-4">Cliente / Teléfono</th>
                  <th class="p-4">Dirección</th>
                  <th class="p-4">Estado</th>
                  <th class="p-4">Repartidor</th>
                  <th class="p-4 text-center">Asignar</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5">
                @for (order of pedidosDeliveryEnCurso(); track order.id) {
                  <tr class="hover:bg-white/5 transition">
                    <td class="p-4 font-mono font-bold text-polleria-gold">#{{ getCodeNum(order.codigoSeguimiento) }}</td>
                    <td class="p-4 text-white">
                      {{ order.cliente.nombre }}
                      <span class="block text-slate-500">{{ order.cliente.celular }}</span>
                    </td>
                    <td class="p-4 text-slate-300">{{ order.cliente.direccion || '—' }}</td>
                    <td class="p-4 text-slate-300">{{ order.estado }}</td>
                    <td class="p-4">
                      @if (order.repartidorId) {
                        <span class="text-emerald-400 font-bold">{{ nombreMotorizado(order) }}</span>
                      } @else {
                        <span class="text-amber-300 font-bold">Por asignar</span>
                      }
                    </td>
                    <td class="p-4 text-center">
                      @if (puedeDespachar(order)) {
                        <button
                          (click)="abrirModalAsignarMotorizado(order)"
                          class="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 font-bold rounded-lg text-[11px] transition cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                        >
                          <span>🛵</span>
                          <span>{{ order.repartidorId ? 'Reasignar (' + nombreMotorizado(order) + ')' : 'Asignar motorizado' }}</span>
                        </button>
                      } @else {
                        <span class="block text-[11px] text-slate-500">
                          Se habilita cuando la cocina lo marque LISTO
                        </span>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6" class="p-8 text-center text-slate-500">
                      No hay pedidos de delivery en curso.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </main>
      }


      <!-- ================= TAB 5: FINANZAS & CAJA (FASE 6 - EN VIVO) ================= -->
      @if (activeTab() === 'FINANZAS') {
        <main class="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
          <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-[#14161a] p-4 rounded-2xl border border-white/10 shadow-lg">
            <div>
              <h2 class="text-2xl font-bold text-white flex items-center gap-2">
                <span>Finanzas, Caja Central & Arqueo</span>
              </h2>
              <p class="text-xs text-slate-400">Arqueo con discrepancia, flujo de caja menor y conciliación diaria (finance-service :8087).</p>
            </div>

            <div class="flex items-center gap-2">
              @if (financeService.cajaActual()?.estado === 'ABIERTA') {
                <button 
                  (click)="showMovimientoCajaModal = true"
                  class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  + Movimiento Caja Menor
                </button>
                <button 
                  (click)="abrirModalCierreCaja()"
                  class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow cursor-pointer"
                >
                  Arqueo y Cierre de Turno
                </button>
              } @else {
                <button 
                  (click)="showAbrirCajaModal = true"
                  class="px-4 py-2 bg-polleria-gold hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition shadow cursor-pointer"
                >
                  Abrir Turno de Caja
                </button>
              }
            </div>
          </div>

          <!-- Status Banner Caja -->
          <div class="p-4 rounded-2xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
            [ngClass]="financeService.cajaActual()?.estado === 'ABIERTA' ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-amber-950/20 border-amber-500/30'"
          >
            <div class="flex items-center gap-3">
              <span class="w-3 h-3 rounded-full" [ngClass]="financeService.cajaActual()?.estado === 'ABIERTA' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'"></span>
              <div>
                <span class="text-xs font-bold uppercase tracking-wider text-white">
                  Estado de Turno: {{ financeService.cajaActual()?.estado || 'SIN APERTURA' }}
                </span>
                <p class="text-xs text-slate-400">
                  Cajero: <strong class="text-slate-200">{{ financeService.cajaActual()?.cajero || authService.currentUser()?.nombre || 'Administrador' }}</strong> • 
                  Apertura con: <strong class="text-polleria-gold">{{ (financeService.cajaActual()?.montoInicial || 0) | currencyPEN }}</strong>
                </p>
              </div>
            </div>
            @if (financeService.cajaActual()?.estado === 'ABIERTA') {
              <span class="text-xs font-mono text-emerald-300">
                Apertura: {{ financeService.cajaActual()?.fechaApertura }}
              </span>
            }
          </div>

          <!-- Financial Metrics Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 space-y-1">
              <span class="text-[11px] text-slate-400 uppercase font-bold">Ventas Totales del Día</span>
              <p class="font-display text-2xl font-black text-white">
                {{ (financeService.balanceDiario()?.totalVentas || 0) | currencyPEN }}
              </p>
              <p class="text-[10px] text-emerald-400">Conciliado con orders-service</p>
            </div>
            <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 space-y-1">
              <span class="text-[11px] text-slate-400 uppercase font-bold">Caja Salón (Efectivo)</span>
              <p class="font-display text-2xl font-black text-polleria-gold">
                {{ (financeService.cajaActual()?.ventasEfectivo || 0) | currencyPEN }}
              </p>
              <p class="text-[10px] text-slate-400">Físico a rendir en gaveta</p>
            </div>
            <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 space-y-1">
              <span class="text-[11px] text-slate-400 uppercase font-bold">Pasarelas (Yape / Tarjetas)</span>
              <p class="font-display text-2xl font-black text-sky-400">
                {{ (financeService.cajaActual()?.ventasDigital || 0) | currencyPEN }}
              </p>
              <p class="text-[10px] text-slate-400">Acreditación automática en cuenta</p>
            </div>
            <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 space-y-1">
              <span class="text-[11px] text-slate-400 uppercase font-bold">Saldo Neto Consolidado</span>
              <p class="font-display text-2xl font-black text-emerald-400">
                {{ (financeService.balanceDiario()?.saldoNeto || 0) | currencyPEN }}
              </p>
              <p class="text-[10px] text-slate-400">Gastos: {{ (financeService.balanceDiario()?.totalGastos || 0) | currencyPEN }}</p>
            </div>
          </div>

          <!-- Cash Movements Table -->
          <div class="bg-[#14161a] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
            <div class="p-4 border-b border-white/5 font-bold text-sm text-white flex justify-between items-center">
              <span>Flujo de Movimientos de Caja Menor (RF20)</span>
              <span class="text-xs text-slate-400 font-mono">{{ financeService.movimientos().length }} transacciones</span>
            </div>
            <table class="w-full text-left text-xs">
              <thead class="bg-black/40 border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th class="p-4">ID</th>
                  <th class="p-4">Concepto</th>
                  <th class="p-4">Tipo</th>
                  <th class="p-4">Monto</th>
                  <th class="p-4">Fecha y Hora</th>
                  <th class="p-4">Registrado Por</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5">
                @for (m of financeService.movimientos(); track m.id) {
                  <tr class="hover:bg-white/5 transition">
                    <td class="p-4 font-mono text-slate-400">#{{ m.id }}</td>
                    <td class="p-4 font-bold text-white">{{ m.concepto }}</td>
                    <td class="p-4">
                      <span 
                        class="px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                        [ngClass]="{
                          'bg-emerald-500/20 text-emerald-400': m.tipo === 'INGRESO' || m.tipo === 'VENTA_EFECTIVO' || m.tipo === 'VENTA_DIGITAL',
                          'bg-rose-500/20 text-rose-400': m.tipo === 'EGRESO' || m.tipo === 'REEMBOLSO'
                        }"
                      >
                        {{ m.tipo }}
                      </span>
                    </td>
                    <td class="p-4 font-mono font-bold" [ngClass]="m.tipo === 'EGRESO' || m.tipo === 'REEMBOLSO' ? 'text-rose-400' : 'text-emerald-400'">
                      {{ m.tipo === 'EGRESO' || m.tipo === 'REEMBOLSO' ? '-' : '+' }}{{ m.monto | currencyPEN }}
                    </td>
                    <td class="p-4 text-slate-400 font-mono">{{ m.fechaHora }}</td>
                    <td class="p-4 text-slate-300">{{ m.usuario }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

        </main>
      }


      <!-- ================= TAB 6: FEEDBACK & RECLAMOS (FASE 4 - EN VIVO) ================= -->
      @if (activeTab() === 'FEEDBACK') {
        <main class="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
          <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-[#14161a] p-4 rounded-2xl border border-white/10 shadow-lg">
            <div>
              <h2 class="text-2xl font-bold text-white flex items-center gap-2">
                <span>Feedback, Reseñas & Reclamos</span>
                <span class="text-[11px] font-normal text-emerald-400 px-2.5 py-0.5 rounded-full bg-emerald-400/10 border border-emerald-400/20">
                  Fase 4 - En Vivo
                </span>
              </h2>
              <p class="text-xs text-slate-400">Calificaciones (1-5 estrellas) y Libro de Reclamaciones con reembolso automático (:8085).</p>
            </div>
            <div class="flex items-center gap-3">
              <div class="flex items-center gap-2 bg-black/40 px-4 py-2 rounded-xl border border-white/10">
                <span class="text-polleria-gold text-lg">★</span>
                <span class="font-bold text-white">{{ feedbackService.promedioEstrellas() }} / 5.0</span>
                <span class="text-xs text-slate-400 font-mono">({{ feedbackService.resenias().length }} reseñas)</span>
              </div>
              <span class="px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold">
                {{ feedbackService.reclamosPendientes().length }} Reclamos Pendientes
              </span>
            </div>
          </div>

          <!-- Libro de Reclamaciones Activo -->
          <div class="space-y-4">
            <h3 class="font-display text-lg text-white font-bold flex items-center gap-2">
              <span>Libro de Reclamaciones (RF28, RF29)</span>
            </h3>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              @for (rec of feedbackService.reportes(); track rec.id) {
                <div class="p-5 rounded-2xl bg-[#14161a] border border-white/10 space-y-3 flex flex-col justify-between">
                  <div>
                    <div class="flex justify-between items-start">
                      <div>
                        <div class="flex items-center gap-2">
                          <span class="font-mono text-xs px-2 py-0.5 rounded bg-white/10 text-polleria-gold font-bold">
                            REC-{{ rec.id }}
                          </span>
                          <span class="text-xs font-bold text-white">Orden #{{ rec.ordenId }}</span>
                        </div>
                        <p class="text-xs text-rose-400 font-semibold mt-1">Motivo: {{ rec.motivo.replace('_', ' ') }}</p>
                      </div>
                      <span 
                        class="px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                        [ngClass]="{
                          'bg-amber-500/20 text-amber-300': rec.estado === 'PENDIENTE' || rec.estado === 'EN_REVISION',
                          'bg-emerald-500/20 text-emerald-400': rec.estado === 'RESUELTO',
                          'bg-rose-500/20 text-rose-400': rec.estado === 'RECHAZADO'
                        }"
                      >
                        {{ rec.estado }}
                      </span>
                    </div>

                    <p class="text-xs text-slate-300 leading-relaxed mt-2 bg-black/30 p-3 rounded-xl border border-white/5">
                      "{{ rec.descripcion }}"
                    </p>

                    @if (rec.montoReclamado) {
                      <p class="text-xs text-polleria-gold font-bold mt-2">
                        Monto Reclamado: {{ rec.montoReclamado | currencyPEN }}
                      </p>
                    }

                    @if (rec.resolucion) {
                      <div class="mt-2 text-xs bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-xl text-emerald-300">
                        <strong>Resolución:</strong> {{ rec.resolucion }}
                      </div>
                    }
                  </div>

                  @if (rec.estado !== 'RESUELTO' && rec.estado !== 'RECHAZADO') {
                    <div class="pt-3 border-t border-white/10 flex justify-end">
                      <button 
                        (click)="abrirModalResolverReclamo(rec)"
                        class="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow"
                      >
                        Gestionar y Emitir Reembolso
                      </button>
                    </div>
                  }
                </div>
              }
            </div>
          </div>

          <!-- Reseñas y Calificaciones de la Experiencia -->
          <div class="space-y-4 pt-4 border-t border-white/10">
            <h3 class="font-display text-lg text-white font-bold flex items-center gap-2">
              <span>Reseñas Recientes de Clientes (RF26, RF27)</span>
            </h3>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              @for (item of feedbackService.resenias(); track item.id) {
                <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 space-y-2">
                  <div class="flex justify-between items-center">
                    <span class="text-xs font-mono text-slate-400">Orden #{{ item.ordenId }}</span>
                    <div class="text-polleria-gold text-sm font-bold">
                      {{ '★'.repeat(item.estrellas || 5) }}{{ '☆'.repeat(5 - (item.estrellas || 5)) }}
                    </div>
                  </div>
                  <p class="text-xs text-slate-300 italic">"{{ item.comentario }}"</p>
                  <p class="text-[11px] text-slate-500 font-mono text-right">{{ item.fecha }}</p>
                </div>
              }
            </div>
          </div>

        </main>
      }


      <!-- ================= TAB 7: NOTIFICACIONES & WHATSAPP (FASE 3) ================= -->
      @if (activeTab() === 'NOTIFICACIONES') {
        <main class="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">

          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#14161a] p-4 rounded-2xl border border-white/10 shadow-lg">
            <div>
              <h2 class="text-2xl font-bold text-white flex items-center gap-2">
                <span>Monitor de Notificaciones & WhatsApp</span>
                <span class="text-[11px] font-normal text-emerald-400 px-2.5 py-0.5 rounded-full bg-emerald-400/10 border border-emerald-400/20">
                  Fase 3 - En Vivo
                </span>
              </h2>
              <p class="text-xs text-slate-400">Historial de envíos (RF32) con cola de 10s entre mensajes (RNF10) en notification-service (:3001).</p>
            </div>

            <button
              (click)="cargarNotificaciones()"
              [disabled]="whatsappService.isLoading()"
              class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition cursor-pointer"
            >
              {{ whatsappService.isLoading() ? 'Actualizando...' : 'Actualizar' }}
            </button>
          </div>

          <!-- Estado de la sesión y totales -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-[#14161a] p-4 rounded-2xl border border-white/10">
              <p class="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Sesión WhatsApp</p>
              <p class="mt-1 text-lg font-bold" [ngClass]="whatsappService.status()?.whatsapp === 'connected' ? 'text-emerald-400' : 'text-amber-300'">
                {{ etiquetaSesionWhatsapp() }}
              </p>
              <p class="text-[11px] text-slate-500">En cola ahora: {{ whatsappService.status()?.colaPendiente ?? '-' }}</p>
            </div>
            <div class="bg-[#14161a] p-4 rounded-2xl border border-white/10">
              <p class="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Enviados</p>
              <p class="mt-1 text-2xl font-bold text-emerald-400">{{ whatsappService.totales().enviados }}</p>
            </div>
            <div class="bg-[#14161a] p-4 rounded-2xl border border-white/10">
              <p class="text-[11px] uppercase tracking-wider text-slate-400 font-bold">En cola</p>
              <p class="mt-1 text-2xl font-bold text-amber-300">{{ whatsappService.totales().enCola }}</p>
            </div>
            <div class="bg-[#14161a] p-4 rounded-2xl border border-white/10">
              <p class="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Con error</p>
              <p class="mt-1 text-2xl font-bold text-red-400">{{ whatsappService.totales().errores }}</p>
            </div>
          </div>

          <!-- Vincular WhatsApp: QR visible solo para ADMIN cuando no hay sesión -->
          @if (whatsappService.status() && whatsappService.status()?.whatsapp !== 'connected') {
            @if (whatsappService.qr() ?? { whatsapp: 'starting', qr: null }; as estadoQr) {
              <div class="bg-[#14161a] p-6 rounded-2xl border border-amber-400/30 flex flex-col md:flex-row items-center gap-6">
                <div class="w-[220px] h-[220px] shrink-0 rounded-xl bg-white flex items-center justify-center overflow-hidden">
                  @if (estadoQr.qr) {
                    <img [src]="estadoQr.qr" alt="Código QR para vincular WhatsApp" class="w-full h-full" />
                  } @else if (whatsappService.qrError()) {
                    <span class="text-xs text-red-500 px-4 text-center">{{ whatsappService.qrError() }}</span>
                  } @else if (whatsappService.diagnostico()) {
                    <span class="text-xs text-red-500 px-4 text-center">
                      WhatsApp no pudo iniciar. Reinicia el servicio de notificaciones.
                    </span>
                  } @else {
                    <span class="text-xs text-slate-500 px-4 text-center">Generando el código QR...</span>
                  }
                </div>
                <div class="space-y-3 text-sm">
                  <h3 class="text-lg font-bold text-white">Vincula el WhatsApp de la pollería</h3>
                  <p class="text-slate-400 text-xs">
                    Los avisos a clientes no se enviarán hasta que se vincule un número. Escanea el código con el celular del negocio:
                  </p>
                  <ol class="list-decimal list-inside text-xs text-slate-300 space-y-1">
                    <li>Abre WhatsApp en el celular.</li>
                    <li>Toca Más opciones (⋮) o Configuración y entra a <strong>Dispositivos vinculados</strong>.</li>
                    <li>Toca <strong>Vincular un dispositivo</strong> y apunta la cámara a este código.</li>
                  </ol>
                  <p class="text-[11px] text-slate-500">El código cambia cada pocos segundos; esta vista se actualiza sola.</p>
                </div>
              </div>
            }
          }

          <!-- Filtros -->
          <div class="flex flex-wrap items-end gap-3 bg-[#14161a] p-4 rounded-2xl border border-white/10">
            <label class="flex flex-col gap-1 text-[11px] text-slate-400 font-bold uppercase">
              N° Orden
              <input type="number" min="1" [(ngModel)]="filtroNotifOrdenId" placeholder="Todas"
                class="w-32 px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs normal-case font-normal" />
            </label>
            <label class="flex flex-col gap-1 text-[11px] text-slate-400 font-bold uppercase">
              Estado
              <select [(ngModel)]="filtroNotifEstado"
                class="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs normal-case font-normal">
                <option value="">Todos</option>
                <option value="EN_COLA">En cola</option>
                <option value="ENVIADO">Enviado</option>
                <option value="ERROR">Error</option>
              </select>
            </label>
            <label class="flex flex-col gap-1 text-[11px] text-slate-400 font-bold uppercase">
              Desde
              <input type="date" [(ngModel)]="filtroNotifDesde"
                class="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs normal-case font-normal" />
            </label>
            <button (click)="cargarNotificaciones()"
              class="px-4 py-2 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl transition cursor-pointer">
              Filtrar
            </button>
            <button (click)="limpiarFiltrosNotificaciones()"
              class="px-4 py-2 text-slate-400 hover:text-white font-bold text-xs rounded-xl transition cursor-pointer">
              Limpiar
            </button>
          </div>

          @if (whatsappService.error()) {
            <div class="p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs">
              {{ whatsappService.error() }}
            </div>
          }

          <div class="bg-[#14161a] rounded-2xl border border-white/10 overflow-x-auto shadow-xl">
            <table class="w-full text-left text-xs">
              <thead class="bg-black/40 border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th class="p-4">ID</th>
                  <th class="p-4">Orden</th>
                  <th class="p-4">Destinatario</th>
                  <th class="p-4">Tipo</th>
                  <th class="p-4">Mensaje</th>
                  <th class="p-4 text-center">Intentos</th>
                  <th class="p-4">Creado / Enviado</th>
                  <th class="p-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5">
                @for (log of whatsappService.historial(); track log.id) {
                  <tr class="hover:bg-white/5 transition align-top">
                    <td class="p-4 text-slate-500 font-mono text-[11px]">{{ log.id }}</td>
                    <td class="p-4 font-bold text-white">{{ log.ordenId ? '#' + log.ordenId : '—' }}</td>
                    <td class="p-4 text-slate-300 font-mono">{{ log.destinatario }}</td>
                    <td class="p-4 text-slate-300">{{ etiquetaTipoNotificacion(log.tipo) }}</td>
                    <td class="p-4 text-slate-400 max-w-xs">
                      <p class="truncate" [title]="log.mensaje">{{ log.mensaje }}</p>
                      @if (log.errorDetalle) {
                        <p class="mt-1 text-red-400 text-[11px]">{{ log.errorDetalle }}</p>
                      }
                    </td>
                    <td class="p-4 text-center font-mono text-slate-300">{{ log.intentos }}</td>
                    <td class="p-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                      {{ log.creadoEn | date:'dd/MM HH:mm:ss' }}
                      @if (log.enviadoEn) {
                        <br /><span class="text-emerald-400">{{ log.enviadoEn | date:'dd/MM HH:mm:ss' }}</span>
                      }
                    </td>
                    <td class="p-4 text-center">
                      <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold" [ngClass]="claseEstadoNotificacion(log.estado)">
                        {{ log.estado }}
                      </span>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="8" class="p-8 text-center text-slate-500">
                      {{ whatsappService.isLoading() ? 'Cargando historial...' : 'No hay notificaciones registradas con estos filtros.' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

        </main>
      }


      <!-- ================= TAB 8: SOPORTE & INCIDENTES (FASE 6 - EN VIVO) ================= -->
      @if (activeTab() === 'SOPORTE') {
        <main class="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
          
          <div class="flex justify-between items-center bg-[#14161a] p-4 rounded-2xl border border-white/10 shadow-lg">
            <div>
              <h2 class="text-2xl font-bold text-white flex items-center gap-2">
                <span>Centro de Soporte, Incidentes & Seguridad</span>
              </h2>
              <p class="text-xs text-slate-400">Bitácora de incidentes operativos (:8088) y control de IPs bloqueadas en auth-service (:8081).</p>
            </div>
            <button 
              (click)="showIncidenteModal = true"
              class="px-4 py-2 bg-polleria-crimson hover:bg-polleria-crimsonHover text-white font-bold text-xs rounded-xl transition shadow cursor-pointer"
            >
              + Documentar Incidente
            </button>
          </div>

          <!-- Bitácora de Incidentes -->
          <div class="space-y-4">
            <h3 class="font-display text-lg text-white font-bold">Bitácora de Incidentes Operativos</h3>
            <div class="space-y-4">
              @for (inc of securityAuditService.incidentes(); track inc.id) {
                <div class="p-5 rounded-2xl bg-[#14161a] border border-white/10 space-y-3 shadow-lg">
                  <div class="flex justify-between items-start">
                    <div class="flex items-center gap-3">
                      <span class="font-mono text-xs px-2 py-0.5 rounded bg-white/10 text-polleria-gold font-bold">
                        INC-{{ inc.id }}
                      </span>
                      <h3 class="font-bold text-base text-white">{{ inc.titulo }}</h3>
                    </div>
                    <span 
                      class="px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                      [ngClass]="inc.estado === 'RESUELTO' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'"
                    >
                      {{ inc.estado }}
                    </span>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-black/30 p-3 rounded-xl border border-white/5">
                    <div>
                      <span class="text-slate-500 font-bold block mb-0.5">CAUSA RAÍZ:</span>
                      <p class="text-slate-300">{{ inc.causaRaiz }}</p>
                    </div>
                    <div>
                      <span class="text-slate-500 font-bold block mb-0.5">SOLUCIÓN APLICADA:</span>
                      <p class="text-emerald-300 font-medium">{{ inc.solucionAplicada }}</p>
                    </div>
                  </div>

                  <div class="flex justify-between items-center text-[11px] text-slate-400 font-mono pt-1">
                    <span>Módulo: {{ inc.modulo }} • Severidad: {{ inc.severidad }}</span>
                    <span>Reportado por: {{ inc.reportadoPor }} • {{ inc.fechaHora }}</span>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Auditoría de Seguridad & IPs Bloqueadas (RNF02) -->
          <div class="space-y-4 pt-4 border-t border-white/10">
            <div class="flex justify-between items-center">
              <div>
                <h3 class="font-display text-lg text-white font-bold flex items-center gap-2">
                  <span>Lista Negra de Seguridad & IPs Bloqueadas</span>
                </h3>
                <p class="text-xs text-slate-400">Protección contra ataques de fuerza bruta y accesos no autorizados.</p>
              </div>
            </div>

            <div class="bg-[#14161a] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
              <table class="w-full text-left text-xs">
                <thead class="bg-black/40 border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider">
                  <tr>
                    <th class="p-4">Dirección IP</th>
                    <th class="p-4">Motivo de Bloqueo</th>
                    <th class="p-4">Intentos Fallidos</th>
                    <th class="p-4">Fecha Bloqueo</th>
                    <th class="p-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  @for (ipItem of securityAuditService.ipsBloqueadas(); track ipItem.ip) {
                    <tr class="hover:bg-white/5 transition">
                      <td class="p-4 font-mono font-bold text-rose-400">{{ ipItem.ip }}</td>
                      <td class="p-4 text-slate-300">{{ ipItem.motivo }}</td>
                      <td class="p-4 font-mono text-amber-400">{{ ipItem.intentosFallidos }}</td>
                      <td class="p-4 font-mono text-slate-400">{{ ipItem.fechaBloqueo }}</td>
                      <td class="p-4 text-center">
                        <button 
                          (click)="securityAuditService.desbloquearIp(ipItem.ip)"
                          class="px-3 py-1 bg-white/10 hover:bg-emerald-600 hover:text-white rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          Desbloquear IP
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

        </main>
      }


      <!-- ================= MODAL: DETALLE DE PEDIDO (INSPECTOR DE ORDEN) ================= -->
      @if (selectedOrderForModal(); as order) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div class="w-full max-w-xl bg-slate-900 border border-polleria-gold/40 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100 animate-scale-up">
            
            <!-- Modal Header -->
            <div class="flex justify-between items-start border-b border-white/10 pb-4">
              <div>
                <div class="flex items-center gap-2.5">
                  <span class="font-mono text-2xl font-black text-polleria-gold">
                    #{{ getCodeNum(order.codigoSeguimiento) }}
                  </span>
                  <span class="text-xs font-bold px-2 py-0.5 rounded bg-white/10 text-slate-300">
                    {{ order.tipo }}
                  </span>
                  <span 
                    class="text-xs font-bold px-2 py-0.5 rounded"
                    [ngClass]="{
                      'bg-rose-500/20 text-rose-400': order.estado === 'PENDIENTE_PAGO' || order.estado === 'PAGADO',
                      'bg-amber-500/20 text-amber-300': order.estado === 'EN_PREPARACION' || order.estado === 'LISTO_COCINA',
                      'bg-sky-500/20 text-sky-300': order.estado === 'EN_REPARTO',
                      'bg-emerald-500/20 text-emerald-400': order.estado === 'COMPLETADO',
                      'bg-slate-700 text-slate-400': order.estado === 'CANCELADO'
                    }"
                  >
                    {{ order.estado }}
                  </span>
                </div>
                <p class="text-xs text-slate-400 mt-1">Registrado el: {{ order.createdAt | date:'medium' }}</p>
              </div>

              <button 
                (click)="selectedOrderForModal.set(null)" 
                class="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <!-- Customer Info -->
            <div class="bg-black/30 p-3.5 rounded-xl border border-white/5 space-y-1.5 text-xs">
              <div class="flex justify-between">
                <span class="text-slate-400">Cliente:</span>
                <strong class="text-white">{{ order.cliente.nombre }}</strong>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">Teléfono:</span>
                <span class="text-slate-200 font-mono">{{ order.cliente.celular }}</span>
              </div>
              @if (order.cliente.direccion) {
                <div class="flex justify-between">
                  <span class="text-slate-400">Dirección:</span>
                  <span class="text-slate-200 text-right">{{ order.cliente.direccion }}</span>
                </div>
              }
              @if (order.cliente.referencia) {
                <div class="flex justify-between">
                  <span class="text-slate-400">Referencia:</span>
                  <span class="text-amber-300/90 italic text-right">{{ order.cliente.referencia }}</span>
                </div>
              }
              <div class="flex justify-between">
                <span class="text-slate-400">Método de Pago:</span>
                <span class="text-polleria-gold font-bold">{{ order.metodoPago || 'No registrado' }}</span>
              </div>
              @if (order.tipo === 'DELIVERY') {
                <div class="flex justify-between items-center pt-1.5 border-t border-white/5">
                  <span class="text-slate-400">Motorizado Asignado:</span>
                  @if (order.repartidorId) {
                    <span class="text-emerald-400 font-bold flex items-center gap-1">
                      <span>🛵</span>
                      <span>{{ nombreMotorizado(order) }}</span>
                    </span>
                  } @else {
                    <span class="text-amber-400 italic">Por asignar al despachar</span>
                  }
                </div>
              }
            </div>

            <!-- Items List -->
            <div class="space-y-2">
              <span class="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Detalle de Platos</span>
              <div class="max-h-48 overflow-y-auto space-y-2 pr-1 divide-y divide-white/5">
                @for (item of order.items; track item.product.id) {
                  <div class="pt-2 first:pt-0 flex justify-between items-start text-xs">
                    <div>
                      <p class="font-bold text-white">{{ item.cantidad }}x {{ item.product.nombre }}</p>
                      @if (item.notas) {
                        <p class="text-[11px] text-amber-300/80 italic">Instrucción: {{ item.notas }}</p>
                      }
                    </div>
                    <span class="font-mono font-bold text-slate-200">{{ item.subtotal | currencyPEN }}</span>
                  </div>
                }
              </div>
            </div>

            <!-- Total Breakdown -->
            <div class="bg-[#14161a] p-3 rounded-xl border border-white/5 flex justify-between items-center">
              <span class="font-bold text-sm text-white">Monto Total de la Orden:</span>
              <span class="font-display text-2xl font-black text-polleria-gold">{{ order.total | currencyPEN }}</span>
            </div>

            <!-- Action Buttons -->
            <div class="flex flex-wrap justify-end gap-2 pt-2 border-t border-white/10">
              @if (order.estado !== 'COMPLETADO' && order.estado !== 'CANCELADO') {
                <button 
                  (click)="cancelarOrden(order); selectedOrderForModal.set(null)"
                  class="px-3.5 py-2 rounded-xl bg-rose-900/40 hover:bg-rose-700 text-rose-300 text-xs font-bold transition cursor-pointer"
                >
                  Cancelar Orden
                </button>
              }

              @if (order.estado === 'PENDIENTE_PAGO' || order.estado === 'PAGADO') {
                <button 
                  (click)="advanceOrderStatus(order, 'EN_PREPARACION'); selectedOrderForModal.set(null)"
                  class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer"
                >
                  Aceptar & Pasar a Cocina
                </button>
              } @else if (order.estado === 'EN_PREPARACION') {
                <button 
                  (click)="marcarListo(order); selectedOrderForModal.set(null)"
                  class="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold transition cursor-pointer"
                >
                  Marcar Listo en Cocina
                </button>
              } @else if (order.estado === 'LISTO_COCINA') {
                <button 
                  (click)="advanceAfterReady(order); selectedOrderForModal.set(null)"
                  class="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition cursor-pointer"
                >
                  {{ order.tipo === 'DELIVERY' ? 'Despachar (En Camino)' : 'Marcar Entregado' }}
                </button>
              } @else if (order.estado === 'EN_REPARTO') {
                <button 
                  (click)="advanceOrderStatus(order, 'COMPLETADO'); selectedOrderForModal.set(null)"
                  class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer"
                >
                  Confirmar Entrega
                </button>
              }
            </div>

          </div>
        </div>
      }


      <!-- ================= MODAL: ASIGNACIÓN DE MOTORIZADO (RF18) ================= -->
      @if (orderToAssignDelivery(); as order) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div class="w-full max-w-lg bg-[#14161a] border border-amber-500/30 rounded-2xl p-6 shadow-2xl space-y-5 text-slate-100 animate-scale-up">
            
            <!-- Modal Header -->
            <div class="flex justify-between items-start border-b border-white/10 pb-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h2m-6 0a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/>
                  </svg>
                </div>
                <div>
                  <h3 class="font-display text-xl font-bold text-white flex items-center gap-2">
                    Asignar Motorizado
                    <span class="font-mono text-sm font-black text-polleria-gold px-2 py-0.5 rounded bg-black/40 border border-amber-500/30">
                      #{{ getCodeNum(order.codigoSeguimiento) }}
                    </span>
                  </h3>
                  <p class="text-xs text-slate-400 mt-0.5">
                    Selecciona el repartidor para despachar la orden a <span class="text-sky-300 font-bold">«En camino»</span>.
                  </p>
                </div>
              </div>

              <button 
                (click)="cerrarModalAsignarMotorizado()" 
                class="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
                aria-label="Cerrar modal"
              >
                ✕
              </button>
            </div>

            <!-- Order Quick Summary -->
            <div class="bg-black/40 p-3.5 rounded-xl border border-white/5 space-y-2 text-xs">
              <div class="flex justify-between items-center">
                <span class="text-slate-400 font-semibold">Cliente:</span>
                <span class="text-white font-bold">{{ order.cliente.nombre }} ({{ order.cliente.celular }})</span>
              </div>
              <div class="flex justify-between items-start gap-3">
                <span class="text-slate-400 font-semibold shrink-0">Dirección:</span>
                <span class="text-slate-200 text-right truncate font-medium">{{ order.cliente.direccion || 'Sin dirección especificada' }}</span>
              </div>
              @if (order.cliente.referencia) {
                <div class="flex justify-between items-start gap-3">
                  <span class="text-slate-400 font-semibold shrink-0">Referencia:</span>
                  <span class="text-amber-300/80 text-right italic">{{ order.cliente.referencia }}</span>
                </div>
              }
              <div class="flex justify-between items-center pt-1.5 border-t border-white/5">
                <span class="text-slate-400 font-semibold">Total / Pago:</span>
                <span class="font-bold text-polleria-gold">{{ order.total | currencyPEN }} <span class="text-slate-400 font-normal">({{ order.metodoPago || 'No registrado' }})</span></span>
              </div>
            </div>

            <!-- Motorizado Selector -->
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <label class="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Repartidores disponibles
                </label>
              </div>

              @if (repartidoresService.isLoading()) {
                <p class="text-xs text-slate-400">Cargando motorizados...</p>
              } @else if (repartidoresService.hasError()) {
                <div class="p-3 rounded-xl bg-rose-900/30 border border-rose-500/40 text-xs text-rose-200">
                  No se pudo leer el roster de motorizados (auth-service). Sin esa lista no se sabe a quién
                  mandar el pedido, así que el despacho queda bloqueado.
                </div>
              } @else if (repartidoresService.repartidores().length === 0) {
                <div class="p-3 rounded-xl bg-amber-900/30 border border-amber-500/40 text-xs text-amber-200">
                  No hay usuarios con rol REPARTIDOR activos. Registra un motorizado antes de despachar.
                </div>
              } @else {
                <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
                  @for (motorizado of repartidoresService.repartidores(); track motorizado.id) {
                    <div 
                      (click)="selectedRepartidorId = motorizado.id"
                      class="p-3 rounded-xl border transition cursor-pointer flex items-center justify-between group"
                      [ngClass]="selectedRepartidorId === motorizado.id 
                        ? 'bg-amber-500/10 border-amber-500/60 ring-1 ring-amber-500/40' 
                        : 'bg-black/30 border-white/5 hover:border-white/20 hover:bg-white/5'"
                    >
                      <div class="flex items-center gap-3">
                        <div 
                          class="w-9 h-9 rounded-lg flex items-center justify-center font-black text-xs transition"
                          [ngClass]="selectedRepartidorId === motorizado.id 
                            ? 'bg-amber-500 text-slate-950 font-bold shadow' 
                            : 'bg-white/10 text-slate-300 group-hover:bg-white/20'"
                        >
                          #{{ motorizado.id }}
                        </div>
                        <div>
                          <div class="text-xs font-bold text-white flex items-center gap-2">
                            <span>{{ motorizado.nombre }}</span>
                          </div>
                          <div class="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span class="font-mono">{{ motorizado.telefono || 'sin teléfono registrado' }}</span>
                            <span>•</span>
                            <span class="font-mono text-slate-500">{{ motorizado.email }}</span>
                          </div>
                        </div>
                      </div>

                      <div 
                        class="w-5 h-5 rounded-full border flex items-center justify-center transition"
                        [ngClass]="selectedRepartidorId === motorizado.id 
                          ? 'border-amber-400 bg-amber-400 text-slate-950' 
                          : 'border-white/20'"
                      >
                        @if (selectedRepartidorId === motorizado.id) {
                          <svg class="w-3.5 h-3.5 font-bold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
                          </svg>
                        }
                      </div>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Modal Actions -->
            <div class="flex justify-end items-center gap-3 pt-3 border-t border-white/10">
              <button 
                type="button"
                (click)="cerrarModalAsignarMotorizado()"
                class="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition cursor-pointer"
                [disabled]="isDispatchingDelivery()"
              >
                Cancelar
              </button>

              <button 
                type="button"
                (click)="confirmarAsignacionYDespacho()"
                class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold transition cursor-pointer shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                [disabled]="isDispatchingDelivery() || !puedeConfirmarDespacho()"
              >
                @if (isDispatchingDelivery()) {
                  <span class="inline-block w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                  <span>Despachando...</span>
                } @else {
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
                  </svg>
                  <span>Confirmar & Pasar a «En Camino»</span>
                }
              </button>
            </div>

          </div>
        </div>
      }


      <!-- ================= MODAL: NUEVA ORDEN MANUAL ================= -->
      @if (showCreateOrderModal) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div class="w-full max-w-lg bg-slate-900 border border-polleria-gold/40 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100 animate-scale-up">
            
            <div class="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 class="font-display text-xl font-bold text-white">
                @if (manualOrder.modo === 'AGREGAR') {
                  Agregar platos a la comanda #{{ getCodeNum(manualOrder.ordenId || '') }}
                } @else if (manualOrder.tipo === 'SALON') {
                  Tomar comanda de salón
                } @else {
                  Registrar Nueva Orden Manual
                }
              </h3>
              <button (click)="showCreateOrderModal = false" class="text-slate-400 hover:text-white cursor-pointer" aria-label="Cerrar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>

            <div class="space-y-3 text-xs">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-400 mb-1">Tipo de Pedido:</label>
                  <select 
                    [(ngModel)]="manualOrder.tipo"
                    [disabled]="manualOrder.modo === 'AGREGAR'"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="DELIVERY">Delivery</option>
                    <option value="SALON">Salón</option>
                    <option value="RECOJO">Recojo en Tienda</option>
                  </select>
                </div>

                <div>
                  <label class="block font-bold text-slate-400 mb-1">Método de Pago:</label>
                  <select 
                    [(ngModel)]="manualOrder.metodoPago"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                  >
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="YAPE">Yape / Plin</option>
                    <option value="TARJETA">Tarjeta</option>
                  </select>
                </div>
              </div>

              @if (manualOrder.modo === 'AGREGAR' && manualOrder.ordenId) {
                <div class="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-200 leading-snug">
                  Segunda ronda sobre la comanda <strong>#{{ getCodeNum(manualOrder.ordenId) }}</strong>.
                  Los platos se suman a la misma orden y la cocina vuelve a prepararla.
                </div>
              }

              @if (manualOrder.tipo === 'SALON') {
                <div>
                  <label class="block font-bold text-slate-400 mb-1">Mesa:</label>
                  <select 
                    [(ngModel)]="manualOrder.mesaId"
                    [disabled]="manualOrder.modo === 'AGREGAR'"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option [ngValue]="null">Seleccioná una mesa</option>
                    @for (m of salonService.mesas(); track m.id) {
                      <option [ngValue]="m.id">
                        Mesa {{ m.numero }} — {{ m.estado }}{{ m.ordenActiva ? ' (comanda #' + m.ordenActiva.ordenId + ')' : '' }}
                      </option>
                    }
                  </select>
                  @if (salonService.mesas().length === 0) {
                    <p class="text-[11px] text-amber-300 mt-1">No hay mesas registradas. Creá una en la pestaña Mesas.</p>
                  }
                </div>
              } @else {
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block font-bold text-slate-400 mb-1">Nombre del Cliente:</label>
                    <input 
                      type="text" 
                      [(ngModel)]="manualOrder.clienteNombre"
                      placeholder="Ej. Juan Pérez"
                      class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                    />
                  </div>

                  <div>
                    <label class="block font-bold text-slate-400 mb-1">Teléfono:</label>
                    <input 
                      type="text" 
                      [(ngModel)]="manualOrder.clienteCelular"
                      placeholder="987654321"
                      class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                    />
                  </div>
                </div>
              }

              @if (manualOrder.tipo === 'DELIVERY' && manualOrder.modo === 'CREAR') {
                <div>
                  <label class="block font-bold text-slate-400 mb-1">Dirección de Entrega:</label>
                  <input 
                    type="text" 
                    [(ngModel)]="manualOrder.direccion"
                    placeholder="Av. Los Maestros 450, Dpto 201"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                  />
                </div>
              }

              <div class="grid grid-cols-3 gap-3">
                <div class="col-span-2">
                  <label class="block font-bold text-slate-400 mb-1">Plato / Combo:</label>
                  <select 
                    [(ngModel)]="manualOrder.selectedProductId"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                  >
                    @for (p of productsService.products(); track p.id) {
                      <option [value]="p.id">{{ p.nombre }} - {{ p.precio | currencyPEN }}</option>
                    }
                  </select>
                </div>

                <div>
                  <label class="block font-bold text-slate-400 mb-1">Cantidad:</label>
                  <input 
                    type="number" 
                    min="1"
                    step="1"
                    [(ngModel)]="manualOrder.cantidad"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                  />
                </div>
              </div>

              <div>
                <label class="block font-bold text-slate-400 mb-1">Notas de Preparación / Observaciones:</label>
                <input 
                  type="text" 
                  [(ngModel)]="manualOrder.notas"
                  placeholder="Papas bien doradas, sin mayonesa..."
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                />
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button 
                (click)="showCreateOrderModal = false" 
                class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                (click)="crearOrdenManual()" 
                class="px-5 py-2 rounded-xl bg-polleria-crimson hover:bg-polleria-crimsonHover text-white text-xs font-bold transition cursor-pointer shadow"
              >
                @if (manualOrder.modo === 'AGREGAR') {
                  Agregar a la comanda
                } @else if (manualOrder.tipo === 'SALON') {
                  Tomar comanda
                } @else {
                  Crear Pedido
                }
              </button>
            </div>

          </div>
        </div>
      }


      <!-- ================= MODAL: CREAR PRODUCTO (INVENTARIO) ================= -->
      @if (showCreateProductModal) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div class="w-full max-w-lg bg-slate-900 border border-polleria-gold/40 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100 animate-scale-up">
            
            <div class="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 class="font-display text-xl font-bold text-white">Agregar Producto a la Carta</h3>
              <button (click)="showCreateProductModal = false" class="text-slate-400 hover:text-white cursor-pointer" aria-label="Cerrar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>

            <div class="space-y-3 text-xs">
              <div>
                <label class="block font-bold text-slate-400 mb-1">Nombre del Plato / Combo:</label>
                <input 
                  type="text" 
                  [(ngModel)]="newProduct.nombre" 
                  placeholder="Ej. 1/2 Pollo Parrillero con Ensalada"
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                />
              </div>

              <div>
                <label class="block font-bold text-slate-400 mb-1">Descripción detallada:</label>
                <textarea 
                  [(ngModel)]="newProduct.descripcion" 
                  rows="2"
                  placeholder="Incluye papas crujientes, ensalada y salsas de la casa..."
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                ></textarea>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-400 mb-1">Precio (S/.):</label>
                  <input 
                    type="number" 
                    [(ngModel)]="newProduct.precio" 
                    placeholder="35.00"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                  />
                </div>

                <div>
                  <label class="block font-bold text-slate-400 mb-1">Categoría:</label>
                  <select 
                    [(ngModel)]="newProduct.categoria"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                  >
                    <option value="POLLOS_A_LA_BRASA">Pollos a la Brasa</option>
                    <option value="COMBOS_FAMILIARES">Combos Familiares</option>
                    <option value="PIQUEOS_Y_BEBIDAS">Piqueos y Entradas</option>
                    <option value="BEBIDAS">Bebidas</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="block font-bold text-slate-400 mb-1">URL de la Imagen:</label>
                <input 
                  type="text" 
                  [(ngModel)]="newProduct.imagenUrl" 
                  placeholder="/assets/images/hero-panoramic.jpg"
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                />
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button 
                (click)="showCreateProductModal = false" 
                class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                (click)="guardarNuevoProducto()" 
                class="px-5 py-2 rounded-xl bg-polleria-crimson hover:bg-polleria-crimsonHover text-white text-xs font-bold transition cursor-pointer shadow"
              >
                Guardar Plato
              </button>
            </div>

          </div>
        </div>
      }

      <!-- ================= MODAL: DESPACHO DE INSUMO A COCINA (FASE 6) ================= -->
      @if (showDespachoModal) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div class="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100 animate-scale-up">
            <div class="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 class="font-display text-xl font-bold text-white flex items-center gap-2">
                <span>Despachar Lote a Cocina</span>
              </h3>
              <button (click)="showDespachoModal = false" class="text-slate-400 hover:text-white cursor-pointer" aria-label="Cerrar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>

            <div class="space-y-3 text-xs">
              <div>
                <label class="block font-bold text-slate-300 mb-1">Insumo a Despachar:</label>
                <select 
                  [(ngModel)]="despachoForm.insumoId"
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                >
                  @for (ins of inventoryService.insumos(); track ins.id) {
                    <option [value]="ins.id">{{ ins.nombre }} (Stock: {{ ins.stockActual }} {{ ins.unidadMedida }})</option>
                  }
                </select>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-300 mb-1">Cantidad:</label>
                  <input 
                    type="number" 
                    [(ngModel)]="despachoForm.cantidad"
                    min="1"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-300 mb-1">Estación Destino:</label>
                  <select 
                    [(ngModel)]="despachoForm.estacion"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                  >
                    <option value="HORNO">Horno de Brasa</option>
                    <option value="COCINA">Cocina Principal</option>
                    <option value="BAR">Bar & Bebidas</option>
                    <option value="EMPAQUE">Empaque Delivery</option>
                  </select>
                </div>
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button 
                (click)="showDespachoModal = false"
                class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                (click)="confirmarDespacho()"
                class="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold uppercase transition cursor-pointer shadow"
              >
                Confirmar Despacho
              </button>
            </div>
          </div>
        </div>
      }

      <!-- ================= MODAL: REGISTRAR MERMA (FASE 6) ================= -->
      @if (showMermaModal) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div class="w-full max-w-md bg-slate-900 border border-rose-500/40 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100 animate-scale-up">
            <div class="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 class="font-display text-xl font-bold text-rose-400 flex items-center gap-2">
                <span>Registrar Merma de Jornada</span>
              </h3>
              <button (click)="showMermaModal = false" class="text-slate-400 hover:text-white cursor-pointer" aria-label="Cerrar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>

            <div class="space-y-3 text-xs">
              <div>
                <label class="block font-bold text-slate-300 mb-1">Insumo:</label>
                <select 
                  [(ngModel)]="mermaForm.insumoId"
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-rose-400"
                >
                  @for (ins of inventoryService.insumos(); track ins.id) {
                    <option [value]="ins.id">{{ ins.nombre }}</option>
                  }
                </select>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-300 mb-1">Cantidad descartada:</label>
                  <input 
                    type="number" 
                    [(ngModel)]="mermaForm.cantidad"
                    min="0.1"
                    step="0.5"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-rose-400"
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-300 mb-1">Motivo:</label>
                  <select 
                    [(ngModel)]="mermaForm.motivo"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-rose-400"
                  >
                    <option value="VENCIMIENTO">Vencimiento de lote</option>
                    <option value="MAL_ESTADO">Mal estado / deterioro</option>
                    <option value="ERROR_COCINA">Error de cocina (cocción excesiva o descarte)</option>
                    <option value="CAIDA">Caída / accidente</option>
                    <option value="OTRO">Otro motivo</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="block font-bold text-slate-300 mb-1">Justificación:</label>
                <input 
                  type="text" 
                  [(ngModel)]="mermaForm.justificacion"
                  placeholder="Detalle del descarte para la bitácora"
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-rose-400"
                />
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button 
                (click)="showMermaModal = false"
                class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                (click)="confirmarMerma()"
                class="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold uppercase transition cursor-pointer shadow"
              >
                Registrar Merma
              </button>
            </div>
          </div>
        </div>
      }

      <!-- ================= MODAL: ABRIR CAJA (FASE 6) ================= -->
      @if (showAbrirCajaModal) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div class="w-full max-w-md bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100 animate-scale-up">
            <div class="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 class="font-display text-xl font-bold text-emerald-400">Apertura de Turno de Caja</h3>
              <button (click)="showAbrirCajaModal = false" class="text-slate-400 hover:text-white cursor-pointer" aria-label="Cerrar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>

            <div class="space-y-3 text-xs">
              <p class="text-slate-400">Ingresa el fondo de sencillo en efectivo con el que se inicia la jornada en caja central.</p>
              <div>
                <label class="block font-bold text-slate-300 mb-1">Monto Inicial en Efectivo (S/):</label>
                <input 
                  type="number" 
                  [(ngModel)]="montoApertura"
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono text-base focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button (click)="showAbrirCajaModal = false" class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold cursor-pointer">Cancelar</button>
              <button (click)="confirmarAperturaCaja()" class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase cursor-pointer">Abrir Caja</button>
            </div>
          </div>
        </div>
      }

      <!-- ================= MODAL: ARQUEO Y CIERRE DE CAJA (FASE 6) ================= -->
      @if (showCerrarCajaModal) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div class="w-full max-w-md bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100 animate-scale-up">
            <div class="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 class="font-display text-xl font-bold text-emerald-400">Arqueo y Cierre de Turno (RF22)</h3>
              <button (click)="showCerrarCajaModal = false" class="text-slate-400 hover:text-white cursor-pointer" aria-label="Cerrar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>

            <div class="space-y-3 text-xs">
              <div class="bg-black/30 p-3 rounded-xl border border-white/5 space-y-1">
                <div class="flex justify-between text-slate-400">
                  <span>Monto Inicial:</span>
                  <span class="font-mono text-white">{{ (financeService.cajaActual()?.montoInicial || 0) | currencyPEN }}</span>
                </div>
                <div class="flex justify-between text-slate-400">
                  <span>Ventas en Efectivo:</span>
                  <span class="font-mono text-polleria-gold">{{ (financeService.cajaActual()?.ventasEfectivo || 0) | currencyPEN }}</span>
                </div>
                <div class="flex justify-between pt-1 border-t border-white/10 font-bold text-white">
                  <span>Efectivo Teórico Esperado:</span>
                  <span class="font-mono text-emerald-400">
                    {{ ((financeService.cajaActual()?.montoInicial || 0) + (financeService.cajaActual()?.ventasEfectivo || 0)) | currencyPEN }}
                  </span>
                </div>
              </div>

              <div>
                <label class="block font-bold text-slate-300 mb-1">Efectivo Real Contado en Gaveta (S/):</label>
                <input 
                  type="number" 
                  [(ngModel)]="cierreEfectivoReal"
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono text-base focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>

              <div>
                <label class="block font-bold text-slate-300 mb-1">Observaciones del Cierre:</label>
                <input 
                  type="text" 
                  [(ngModel)]="cierreObservaciones"
                  placeholder="Detallar cualquier diferencia o novedad..."
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button (click)="showCerrarCajaModal = false" class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold cursor-pointer">Cancelar</button>
              <button (click)="confirmarCierreCaja()" class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase cursor-pointer">Cerrar y Cuadrar Caja</button>
            </div>
          </div>
        </div>
      }

      <!-- ================= MODAL: MOVIMIENTO DE CAJA MENOR (FASE 6) ================= -->
      @if (showMovimientoCajaModal) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div class="w-full max-w-md bg-slate-900 border border-white/20 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100 animate-scale-up">
            <div class="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 class="font-display text-xl font-bold text-white">Registrar Movimiento de Caja Menor</h3>
              <button (click)="showMovimientoCajaModal = false" class="text-slate-400 hover:text-white cursor-pointer" aria-label="Cerrar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>

            <div class="space-y-3 text-xs">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-300 mb-1">Tipo de Movimiento:</label>
                  <select 
                    [(ngModel)]="movimientoForm.tipo"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                  >
                    <option value="EGRESO">Egreso (Gasto Menor)</option>
                    <option value="INGRESO">Ingreso Extra</option>
                  </select>
                </div>
                <div>
                  <label class="block font-bold text-slate-300 mb-1">Monto (S/):</label>
                  <input 
                    type="number" 
                    [(ngModel)]="movimientoForm.monto"
                    min="1"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                  />
                </div>
              </div>

              <div>
                <label class="block font-bold text-slate-300 mb-1">Concepto / Justificación:</label>
                <input 
                  type="text" 
                  [(ngModel)]="movimientoForm.concepto"
                  placeholder="Ej. Compra de limones en mercado, compra de bolsas..."
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                />
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button (click)="showMovimientoCajaModal = false" class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold cursor-pointer">Cancelar</button>
              <button (click)="confirmarMovimientoCaja()" class="px-5 py-2 rounded-xl bg-polleria-gold hover:bg-amber-400 text-slate-950 text-xs font-bold uppercase cursor-pointer">Registrar</button>
            </div>
          </div>
        </div>
      }

      <!-- ================= MODAL: GESTIONAR RECLAMO & REEMBOLSO (FASE 4) ================= -->
      @if (showResolverReclamoModal && reclamoSeleccionado) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div class="w-full max-w-md bg-slate-900 border border-rose-500/40 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100 animate-scale-up">
            <div class="flex justify-between items-center border-b border-white/10 pb-3">
              <div>
                <h3 class="font-display text-xl font-bold text-rose-400">Atención de Reclamo #{{ reclamoSeleccionado.id }}</h3>
                <p class="text-xs text-slate-400">Orden asociada #{{ reclamoSeleccionado.ordenId }}</p>
              </div>
              <button (click)="showResolverReclamoModal = false" class="text-slate-400 hover:text-white cursor-pointer" aria-label="Cerrar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>

            <div class="space-y-3 text-xs">
              <div class="bg-black/40 p-3 rounded-xl border border-white/5 space-y-1">
                <span class="text-slate-500 font-bold block">MOTIVO DECLARADO:</span>
                <p class="text-slate-200">{{ reclamoSeleccionado.motivo }}</p>
                <p class="text-slate-300 italic">"{{ reclamoSeleccionado.descripcion }}"</p>
                @if (reclamoSeleccionado.montoReclamado) {
                  <p class="text-polleria-gold font-bold pt-1">Monto Solicitado: {{ reclamoSeleccionado.montoReclamado | currencyPEN }}</p>
                }
              </div>

              <div>
                <label class="block font-bold text-slate-300 mb-1">Resolución Administrativa:</label>
                <textarea 
                  [(ngModel)]="resolucionTexto"
                  rows="2"
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-rose-400"
                ></textarea>
              </div>

              <div class="flex items-center gap-2 p-3 bg-rose-500/10 rounded-xl border border-rose-500/20">
                <input 
                  type="checkbox" 
                  id="reembolsoCheck" 
                  [(ngModel)]="emitirReembolso" 
                  class="rounded text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                />
                <label for="reembolsoCheck" class="text-xs text-rose-300 font-bold cursor-pointer">
                  Emitir reembolso automático a pasarela / caja (RF29)
                </label>
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button (click)="showResolverReclamoModal = false" class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold cursor-pointer">Cancelar</button>
              <button (click)="confirmarResolverReclamo()" class="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold uppercase cursor-pointer">Resolver y Notificar</button>
            </div>
          </div>
        </div>
      }

      <!-- ================= MODAL: DOCUMENTAR INCIDENTE (FASE 6) ================= -->
      @if (showIncidenteModal) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div class="w-full max-w-lg bg-slate-900 border border-polleria-crimson/50 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100 animate-scale-up">
            <div class="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 class="font-display text-xl font-bold text-white">Documentar Incidente Operativo (RF34)</h3>
              <button (click)="showIncidenteModal = false" class="text-slate-400 hover:text-white cursor-pointer" aria-label="Cerrar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>

            <div class="space-y-3 text-xs">
              <div>
                <label class="block font-bold text-slate-300 mb-1">Título del Incidente:</label>
                <input 
                  type="text" 
                  [(ngModel)]="incidenteForm.titulo"
                  placeholder="Ej. Falla en sincronización de comanda de mesa 4"
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-300 mb-1">Módulo Afectado:</label>
                  <select 
                    [(ngModel)]="incidenteForm.modulo"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                  >
                    <option value="COCINA_HORNO">Cocina & Hornos</option>
                    <option value="PAGOS">Pagos & Pasarelas</option>
                    <option value="RED_WIFI">Red & Conectividad</option>
                    <option value="SISTEMA_LOCAL">Sistema Local / Terminal</option>
                  </select>
                </div>
                <div>
                  <label class="block font-bold text-slate-300 mb-1">Severidad:</label>
                  <select 
                    [(ngModel)]="incidenteForm.severidad"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                  >
                    <option value="BAJA">Baja</option>
                    <option value="MEDIA">Media</option>
                    <option value="ALTA">Alta (Crítica)</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="block font-bold text-slate-300 mb-1">Causa Raíz:</label>
                <textarea 
                  [(ngModel)]="incidenteForm.causaRaiz"
                  rows="2"
                  placeholder="Explicación técnica o procedimental de la causa..."
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                ></textarea>
              </div>

              <div>
                <label class="block font-bold text-slate-300 mb-1">Solución Aplicada / Acción Correctiva:</label>
                <textarea 
                  [(ngModel)]="incidenteForm.solucionAplicada"
                  rows="2"
                  placeholder="Acción tomada para solucionar y prevenir recurrencia..."
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                ></textarea>
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button (click)="showIncidenteModal = false" class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold cursor-pointer">Cancelar</button>
              <button (click)="confirmarRegistroIncidente()" class="px-5 py-2 rounded-xl bg-polleria-crimson hover:bg-polleria-crimsonHover text-white text-xs font-bold uppercase cursor-pointer">Registrar en Auditoría</button>
            </div>
          </div>
        </div>
      }

      <!-- ================= MODAL: EDITAR COORDENADAS PLANO (FASE 2) ================= -->
      @if (showEditarCoordenadasModal && mesaEditarCoordenadas) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div class="w-full max-w-sm bg-slate-900 border border-polleria-gold/40 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100 animate-scale-up">
            <div class="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 class="font-display text-xl font-bold text-white">Editar Posición en Plano</h3>
              <button (click)="showEditarCoordenadasModal = false" class="text-slate-400 hover:text-white cursor-pointer" aria-label="Cerrar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>

            <div class="space-y-3 text-xs">
              <p class="text-slate-400">Coordenadas espaciales de <strong>{{ mesaEditarCoordenadas.nombre }}</strong> en el salón virtual.</p>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-300 mb-1">Posición X:</label>
                  <input 
                    type="number" 
                    [(ngModel)]="coordX"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-300 mb-1">Posición Y:</label>
                  <input 
                    type="number" 
                    [(ngModel)]="coordY"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                  />
                </div>
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button 
                (click)="showEditarCoordenadasModal = false" 
                [disabled]="isProcesandoMesa()"
                class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button 
                (click)="guardarCoordenadasMesa()" 
                [disabled]="isProcesandoMesa()"
                class="px-5 py-2 rounded-xl bg-polleria-gold hover:bg-amber-400 text-slate-950 text-xs font-bold uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                @if (isProcesandoMesa()) {
                  <svg class="animate-spin w-3.5 h-3.5 text-slate-950" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>Guardando...</span>
                } @else {
                  <span>Guardar Posición</span>
                }
              </button>
            </div>
          </div>
        </div>
      }

      
      <!-- ================= MODAL: CREAR MESA (FASE 2 - ADMIN) ================= -->
      @if (showCrearMesaModal) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div class="w-full max-w-md bg-slate-900 border border-polleria-gold/40 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100 animate-scale-up">
            <div class="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 class="font-display text-xl font-bold text-white flex items-center gap-2">
                <svg class="w-5 h-5 text-polleria-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
                <span>Crear Nueva Mesa</span>
              </h3>
              <button (click)="!isProcesandoMesa() && (showCrearMesaModal = false)" [disabled]="isProcesandoMesa()" class="text-slate-400 hover:text-white cursor-pointer disabled:opacity-50" aria-label="Cerrar">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div class="space-y-3 text-xs">
              <div>
                <label class="block font-bold text-slate-300 mb-1">Número de Mesa:</label>
                <input 
                  type="number" 
                  [(ngModel)]="crearMesaForm.numero"
                  [disabled]="isProcesandoMesa()"
                  min="1"
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono focus:outline-none focus:ring-1 focus:ring-polleria-gold disabled:opacity-50"
                  placeholder="Ej. 12"
                />
              </div>

              <div>
                <label class="block font-bold text-slate-300 mb-1">Capacidad (Comensales):</label>
                <input 
                  type="number" 
                  [(ngModel)]="crearMesaForm.capacidad"
                  [disabled]="isProcesandoMesa()"
                  min="1"
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono focus:outline-none focus:ring-1 focus:ring-polleria-gold disabled:opacity-50"
                  placeholder="Ej. 4"
                />
              </div>

              <div>
                <label class="block font-bold text-slate-300 mb-1">Zona del Salón:</label>
                <select 
                  [(ngModel)]="crearMesaForm.zona"
                  [disabled]="isProcesandoMesa()"
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold cursor-pointer disabled:opacity-50"
                >
                  @for (z of zonasSalon; track z.id) {
                    <option [value]="z.id">{{ z.nombre }}</option>
                  }
                </select>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-300 mb-1">Coordenada X:</label>
                  <input 
                    type="number" 
                    [(ngModel)]="crearMesaForm.posicionX"
                    [disabled]="isProcesandoMesa()"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono focus:outline-none focus:ring-1 focus:ring-polleria-gold disabled:opacity-50"
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-300 mb-1">Coordenada Y:</label>
                  <input 
                    type="number" 
                    [(ngModel)]="crearMesaForm.posicionY"
                    [disabled]="isProcesandoMesa()"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono focus:outline-none focus:ring-1 focus:ring-polleria-gold disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button 
                (click)="showCrearMesaModal = false" 
                [disabled]="isProcesandoMesa()"
                class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button 
                (click)="guardarCrearMesa()" 
                [disabled]="isProcesandoMesa()"
                class="px-5 py-2.5 rounded-xl bg-polleria-crimson hover:bg-polleria-crimsonHover text-white text-xs font-bold uppercase transition flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                @if (isProcesandoMesa()) {
                  <svg class="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>Creando Mesa...</span>
                } @else {
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                  </svg>
                  <span>Registrar Mesa</span>
                }
              </button>
            </div>
          </div>
        </div>
      }

      <!-- ================= MODAL: EDITAR MESA (FASE 2 - ADMIN) ================= -->
      @if (showEditarMesaModal) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div class="w-full max-w-md bg-slate-900 border border-polleria-gold/40 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100 animate-scale-up">
            <div class="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 class="font-display text-xl font-bold text-white flex items-center gap-2">
                <svg class="w-5 h-5 text-polleria-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
                <span>Editar Mesa #{{ editarMesaForm.numero }}</span>
              </h3>
              <button (click)="!isProcesandoMesa() && (showEditarMesaModal = false)" [disabled]="isProcesandoMesa()" class="text-slate-400 hover:text-white cursor-pointer disabled:opacity-50" aria-label="Cerrar">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div class="space-y-3 text-xs">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-300 mb-1">Número:</label>
                  <input 
                    type="number" 
                    [(ngModel)]="editarMesaForm.numero"
                    [disabled]="isProcesandoMesa()"
                    min="1"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono focus:outline-none focus:ring-1 focus:ring-polleria-gold disabled:opacity-50"
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-300 mb-1">Capacidad:</label>
                  <input 
                    type="number" 
                    [(ngModel)]="editarMesaForm.capacidad"
                    [disabled]="isProcesandoMesa()"
                    min="1"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono focus:outline-none focus:ring-1 focus:ring-polleria-gold disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label class="block font-bold text-slate-300 mb-1">Zona del Salón:</label>
                <select 
                  [(ngModel)]="editarMesaForm.zona"
                  [disabled]="isProcesandoMesa()"
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold cursor-pointer disabled:opacity-50"
                >
                  @for (z of zonasSalon; track z.id) {
                    <option [value]="z.id">{{ z.nombre }}</option>
                  }
                </select>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-300 mb-1">Coordenada X:</label>
                  <input 
                    type="number" 
                    [(ngModel)]="editarMesaForm.posicionX"
                    [disabled]="isProcesandoMesa()"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono focus:outline-none focus:ring-1 focus:ring-polleria-gold disabled:opacity-50"
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-300 mb-1">Coordenada Y:</label>
                  <input 
                    type="number" 
                    [(ngModel)]="editarMesaForm.posicionY"
                    [disabled]="isProcesandoMesa()"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono focus:outline-none focus:ring-1 focus:ring-polleria-gold disabled:opacity-50"
                  />
                </div>
              </div>

              <div class="pt-2">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" [(ngModel)]="editarMesaForm.activo" [disabled]="isProcesandoMesa()" class="rounded bg-black/50 border-white/20 text-polleria-gold focus:ring-0 w-4 h-4 disabled:opacity-50" />
                  <span class="font-bold text-slate-200">Mesa Activa (Disponible para atención)</span>
                </label>
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button 
                (click)="showEditarMesaModal = false" 
                [disabled]="isProcesandoMesa()"
                class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button 
                (click)="guardarEditarMesa()" 
                [disabled]="isProcesandoMesa()"
                class="px-5 py-2.5 rounded-xl bg-polleria-gold hover:bg-amber-400 text-slate-950 text-xs font-bold uppercase transition flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                @if (isProcesandoMesa()) {
                  <svg class="animate-spin w-4 h-4 text-slate-950" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>Guardando...</span>
                } @else {
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span>Guardar Cambios</span>
                }
              </button>
            </div>
          </div>
        </div>
      }

      </div> <!-- Cierre Main Content Wrapper -->
    </div> <!-- Cierre Root Container -->
  `
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  readonly ordersService = inject(OrdersService);
  readonly productsService = inject(ProductsService);
  readonly authService = inject(AuthService);
  readonly salonService = inject(SalonService);
  readonly inventoryService = inject(InventoryService);
  readonly financeService = inject(FinanceService);
  readonly feedbackService = inject(FeedbackService);
  readonly securityAuditService = inject(SecurityAuditService);
  readonly whatsappService = inject(WhatsappNotificationsService);
  readonly repartidoresService = inject(RepartidoresService);
  readonly notify = inject(NotificationService);
  readonly router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  private pollingSub?: Subscription;

  readonly activeTab = signal<DashboardTab>('ORDENES');
  readonly inventarioSubTab = signal<'CARTA' | 'INSUMOS' | 'MERMAS' | 'PREDICCION'>('CARTA');
  readonly orderStateFilter = signal<'TODAS' | 'NUEVAS' | 'PREPARANDOSE' | 'EN_CAMINO' | 'COMPLETADO'>('TODAS');
  searchQuery = '';

  getActiveTabLabel(): string {
    switch (this.activeTab()) {
      case 'ORDENES': return 'Órdenes en Vivo & Producción';
      case 'MESAS': return 'Mesas & Salón en Vivo';
      case 'INVENTARIO': return 'Control de Inventario & Carta';
      case 'REPARTO': return 'Monitoreo de Flota & Repartidores';
      case 'FINANZAS': return 'Flujo de Caja & Transacciones';
      case 'FEEDBACK': return 'Calidad & Atención al Cliente';
      case 'NOTIFICACIONES': return 'Mensajería & Notificaciones WhatsApp';
      case 'SOPORTE': return 'Bitácora de Incidentes & Soporte';
      default: return 'Panel Administrativo';
    }
  }

  // Modal de Detalle de Orden (Inspector)
  readonly selectedOrderForModal = signal<Order | null>(null);

  // Modal de Creación de Orden Manual
  showCreateOrderModal = false;
  manualOrder = {
    // CREAR abre una comanda nueva; AGREGAR suma platos a la comanda activa de la mesa.
    modo: 'CREAR' as 'CREAR' | 'AGREGAR',
    ordenId: null as string | null,
    mesaId: null as string | number | null,
    tipo: 'DELIVERY' as OrderType,
    metodoPago: 'EFECTIVO_CONTRAENTREGA' as PaymentMethod,
    clienteNombre: '',
    clienteCelular: '',
    direccion: '',
    selectedProductId: '1',
    cantidad: 1,
    notas: ''
  };

  // Modal para creación de productos
  showCreateProductModal = false;
  newProduct: Omit<Product, 'id'> = {
    nombre: '',
    descripcion: '',
    precio: 0,
    categoria: 'POLLOS_A_LA_BRASA',
    imagenUrl: '/assets/images/hero-panoramic.jpg',
    agotado: false,
    tiempoEstimadoMin: 20
  };

  // Modal de Despacho de Insumo (Fase 6)
  showDespachoModal = false;
  despachoForm = {
    insumoId: 1,
    cantidad: 10,
    estacion: 'HORNO'
  };

  // Modal de Registro de Merma (Fase 6)
  showMermaModal = false;
  mermaForm = {
    insumoId: 1,
    cantidad: 1,
    motivo: 'VENCIMIENTO' as MotivoMerma,
    justificacion: ''
  };

  // Modal de Apertura de Caja (Fase 6)
  showAbrirCajaModal = false;
  montoApertura = 200.00;

  // Modal de Cierre / Arqueo de Caja (Fase 6)
  showCerrarCajaModal = false;
  cierreEfectivoReal = 0;
  cierreObservaciones = '';

  // Modal de Movimiento de Caja Menor (Fase 6)
  showMovimientoCajaModal = false;
  movimientoForm = {
    tipo: 'EGRESO' as TipoMovimiento,
    concepto: '',
    monto: 0
  };

  // Modal de Resolver Reclamo (Fase 4)
  showResolverReclamoModal = false;
  reclamoSeleccionado: ReporteReclamo | null = null;
  resolucionTexto = '';
  emitirReembolso = true;

  // Modal de Documentar Incidente (Fase 6)
  showIncidenteModal = false;
  incidenteForm = {
    titulo: '',
    modulo: 'COCINA_HORNO' as 'PAGOS' | 'COCINA_HORNO' | 'RED_WIFI' | 'SISTEMA_LOCAL',
    severidad: 'MEDIA' as 'ALTA' | 'MEDIA' | 'BAJA',
    causaRaiz: '',
    solucionAplicada: ''
  };

  // Modal de Editar Coordenadas de Mesa (Fase 2)
  showEditarCoordenadasModal = false;
  mesaEditarCoordenadas: MesaSalon | null = null;

  // Modales de Gestión de Mesas CRUD (Fase 2)
  showCrearMesaModal = false;
  crearMesaForm = {
    numero: 1,
    capacidad: 4,
    zona: 'SALON_PRINCIPAL' as SalonZona,
    posicionX: 0,
    posicionY: 0
  };

  showEditarMesaModal = false;
  editarMesaForm = {
    id: 0 as string | number,
    numero: 1,
    capacidad: 4,
    zona: 'SALON_PRINCIPAL' as SalonZona,
    posicionX: 0,
    posicionY: 0,
    activo: true
  };

  coordX = 0;
  coordY = 0;

  // Croquis Virtual por Zonas (Slides) & Cuadrícula Personalizable
  readonly mesaViewMode = signal<'CROQUIS' | 'CARDS'>('CROQUIS');

  get zonasSalon(): ZonaSalonConfig[] {
    return this.salonService.zonasSalon();
  }

  readonly activeZonaIndex = signal<number>(0);
  readonly currentZona = computed(() => this.salonService.zonasSalon()[this.activeZonaIndex()] || this.salonService.zonasSalon()[0]);
  readonly mesaEnMovimiento = signal<MesaSalon | null>(null);

  // Estado de Carga y Espera para Procesos de Salón/Mesas (Spinner interactivo)
  readonly isProcesandoMesa = signal<boolean>(false);
  readonly mensajeProcesandoMesa = signal<string>('Sincronizando con el servidor...');

  // Mesa seleccionada para detalle
  readonly selectedMesa = signal<MesaSalon | null>(null);

  // Reparto (RF18): los pedidos y el repartidor salen del backend, sin roster local.
  readonly pedidosDeliveryEnCurso = computed(() =>
    this.ordersService.orders().filter(o =>
      o.tipo === 'DELIVERY' && o.estado !== 'COMPLETADO' && o.estado !== 'CANCELADO')
  );

  // Modal de Asignación de Motorizado (RF18)
  readonly orderToAssignDelivery = signal<Order | null>(null);
  /** Id del motorizado elegido en el modal. Sale del roster real de auth-service, no de una lista local. */
  selectedRepartidorId: number | null = null;
  readonly isDispatchingDelivery = signal<boolean>(false);

  // Notificaciones WhatsApp (RF30, RF31, RF32 - Fase 3)
  filtroNotifOrdenId: number | null = null;
  filtroNotifEstado: EstadoNotificacion | '' = '';
  filtroNotifDesde = '';

  // El QR solo se consulta mientras la pestaña de WhatsApp está abierta
  // El QR solo se consulta mientras la pestaña de WhatsApp está abierta
  private readonly sondeoQrPorPestana = effect(() => {
    const enWhatsapp = this.activeTab() === 'NOTIFICACIONES';
    untracked(() => {
      if (enWhatsapp && isPlatformBrowser(this.platformId)) {
        this.whatsappService.iniciarSondeoQr();
      } else {
        this.whatsappService.detenerSondeoQr();
      }
    });
  });

  /**
   * El roster de motorizados se pide al abrir la pestaña de reparto, no en el constructor:
   * el endpoint exige rol ADMIN y `/admin` también es accesible para MOZO, COCINA y REPARTIDOR.
   * Sin esta carga, la tabla mostraría "Motorizado #7" hasta abrir el modal de despacho.
   */
  private readonly rosterAlAbrirReparto = effect(() => {
    const enReparto = this.activeTab() === 'REPARTO';
    if (enReparto && isPlatformBrowser(this.platformId)) {
      untracked(() => this.repartidoresService.cargar());
    }
  });

  cargarNotificaciones(): void {
    this.whatsappService.cargar({
      ordenId: this.filtroNotifOrdenId,
      estado: this.filtroNotifEstado,
      desde: this.filtroNotifDesde
    });
  }

  limpiarFiltrosNotificaciones(): void {
    this.filtroNotifOrdenId = null;
    this.filtroNotifEstado = '';
    this.filtroNotifDesde = '';
    this.cargarNotificaciones();
  }

  etiquetaSesionWhatsapp(): string {
    const etiquetas: Record<string, string> = {
      connected: 'Conectado',
      waiting_qr: 'Esperando QR',
      starting: 'Iniciando',
      disconnected: 'Desconectado',
      auth_failure: 'Error de sesión',
      error_inicio: 'No pudo iniciar'
    };
    const status = this.whatsappService.status();
    return status ? (etiquetas[status.whatsapp] ?? status.whatsapp) : 'Sin conexión';
  }

  etiquetaTipoNotificacion(tipo: TipoNotificacion): string {
    const etiquetas: Record<TipoNotificacion, string> = {
      PAGO_CONFIRMADO: 'Pago confirmado',
      ESTADO_EN_PREPARACION: 'En preparación',
      ESTADO_EN_CAMINO: 'En camino',
      ESTADO_ENTREGADO: 'Entregado',
      CODIGO_SEGUIMIENTO: 'Código de seguimiento'
    };
    return etiquetas[tipo] ?? tipo;
  }

  claseEstadoNotificacion(estado: EstadoNotificacion): string {
    if (estado === 'ENVIADO') return 'bg-emerald-500/20 text-emerald-400';
    if (estado === 'ERROR') return 'bg-red-500/20 text-red-400';
    return 'bg-amber-500/20 text-amber-300';
  }

  ngOnInit(): void {
    this.ordersService.loadActiveOrders();
    this.productsService.loadProducts();
    this.salonService.cargarMesas();
    this.inventoryService.cargarInsumos();
    this.inventoryService.cargarMermas();
    this.inventoryService.cargarAlertas();
    this.financeService.cargarCajaActual();
    this.financeService.cargarBalanceDiario();
    this.financeService.cargarMovimientos();
    this.feedbackService.cargarResenias();
    this.feedbackService.cargarReportes();
    this.securityAuditService.cargarIncidentes();
    this.securityAuditService.cargarIpsBloqueadas();

    // Polling cada 2.5 seg para mantener actualizado el dashboard en tiempo real
    if (isPlatformBrowser(this.platformId)) {
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
    this.whatsappService.detenerSondeoQr();
  }

  getCodeNum(code: string): string {
    return code ? code.replace('POL-', '') : '1001';
  }

  getNewOrdersRawCount(): number {
    return this.ordersService.orders().filter(o => 
      o.estado === 'PENDIENTE_PAGO' || o.estado === 'PAGADO'
    ).length;
  }

  getPreparingOrdersRawCount(): number {
    return this.ordersService.orders().filter(o => 
      o.estado === 'EN_PREPARACION' || o.estado === 'LISTO_COCINA'
    ).length;
  }

  getDispatchedOrdersRawCount(): number {
    return this.ordersService.orders().filter(o => 
      o.estado === 'EN_REPARTO'
    ).length;
  }

  getCompletedOrdersRawCount(): number {
    return this.ordersService.orders().filter(o => 
      o.estado === 'COMPLETADO'
    ).length;
  }

  private filterByQuery(orders: Order[]): Order[] {
    const q = (this.searchQuery || '').toLowerCase().trim();
    if (!q) return orders;

    return orders.filter(o =>
      (o.codigoSeguimiento && o.codigoSeguimiento.toLowerCase().includes(q)) ||
      (o.cliente?.nombre && o.cliente.nombre.toLowerCase().includes(q)) ||
      (o.cliente?.celular && o.cliente.celular.includes(q))
    );
  }

  getNewOrders(): Order[] {
    const list = this.ordersService.orders().filter(o => 
      o.estado === 'PENDIENTE_PAGO' || o.estado === 'PAGADO'
    );
    return this.filterByQuery(list);
  }

  getPreparingOrders(): Order[] {
    const list = this.ordersService.orders().filter(o => 
      o.estado === 'EN_PREPARACION' || o.estado === 'LISTO_COCINA'
    );
    return this.filterByQuery(list);
  }

  getDispatchedOrders(): Order[] {
    const list = this.ordersService.orders().filter(o => 
      o.estado === 'EN_REPARTO'
    );
    return this.filterByQuery(list);
  }

  getCompletedOrders(): Order[] {
    const list = this.ordersService.orders().filter(o => 
      o.estado === 'COMPLETADO'
    );
    return this.filterByQuery(list);
  }

  advanceOrderStatus(order: Order, nextStatus: OrderStatus): void {
    this.ordersService.updateOrderStatus(order.id, nextStatus).subscribe({
      next: () => {
        this.notify.showSuccess(`Orden #${this.getCodeNum(order.codigoSeguimiento)} actualizada a ${nextStatus}`);
      },
      error: () => {
        this.notify.showError(`Error al actualizar estado de la orden #${this.getCodeNum(order.codigoSeguimiento)}`);
      }
    });
  }

  /**
   * El backend solo acepta `EN_PREPARACION -> LISTO`. Sin este paso, un pedido de salón o de
   * recojo en preparación no se podía cerrar desde el panel: el botón único intentaba
   * `EN_PREPARACION -> ENTREGADO` y el backend lo rechazaba.
   */
  marcarListo(order: Order): void {
    this.advanceOrderStatus(order, 'LISTO_COCINA');
  }

  advanceAfterReady(order: Order): void {
    if (order.tipo === 'DELIVERY') {
      this.abrirModalAsignarMotorizado(order);
    } else {
      this.advanceOrderStatus(order, 'COMPLETADO');
    }
  }

  /**
   * Estados desde los que el panel puede abrir el despacho con motorizado:
   * - `EN_PREPARACION`: el despacho encadena el paso `LISTO` antes de `EN_CAMINO`.
   * - `LISTO_COCINA`: transición directa a `EN_CAMINO` con `repartidorId`.
   * - `EN_REPARTO`: reasignar un pedido ya en ruta; el backend acepta reenviar el mismo estado
   *   con otro `repartidorId`.
   *
   * En `PAGADO`/`PENDIENTE_PAGO` el backend solo admite `EN_PREPARACION`: la cocina todavía no
   * empezó ese pedido, así que la acción no se ofrece.
   */
  puedeDespachar(order: Order): boolean {
    return ['EN_PREPARACION', 'LISTO_COCINA', 'EN_REPARTO'].includes(order.estado);
  }

  /**
   * Nombre real del motorizado, resuelto contra el roster de auth-service.
   * Sin ese roster se muestra el id: nunca un nombre inventado.
   */
  nombreMotorizado(order: Order): string {
    const id = order.repartidorId;
    if (id == null) return 'Por asignar';
    return this.repartidoresService.nombrePorId()[id] ?? `Motorizado #${id}`;
  }

  /** Sin un motorizado elegido no hay a quién despachar el pedido. */
  puedeConfirmarDespacho(): boolean {
    const id = Number(this.selectedRepartidorId);
    return Number.isInteger(id) && id > 0;
  }

  abrirModalAsignarMotorizado(order: Order): void {
    this.orderToAssignDelivery.set(order);
    // El roster exige rol ADMIN y no se consulta desde el constructor: se pide al abrir el modal.
    this.repartidoresService.cargar();
    this.selectedRepartidorId = order.repartidorId ?? null;
  }

  cerrarModalAsignarMotorizado(): void {
    this.orderToAssignDelivery.set(null);
    this.isDispatchingDelivery.set(false);
  }

  confirmarAsignacionYDespacho(): void {
    const order = this.orderToAssignDelivery();
    if (!order) return;

    if (!this.puedeConfirmarDespacho()) {
      this.notify.showWarning('Selecciona un motorizado de la lista para despachar el pedido');
      return;
    }

    const repId = Number(this.selectedRepartidorId);
    this.isDispatchingDelivery.set(true);

    this.ordersService.dispatchDeliveryOrder(order, repId).subscribe({
      next: () => {
        const nombre = this.repartidoresService.nombrePorId()[repId] ?? `Motorizado #${repId}`;
        this.notify.showSuccess(`Orden #${this.getCodeNum(order.codigoSeguimiento)} asignada a ${nombre} y en camino`);
        this.cerrarModalAsignarMotorizado();
      },
      error: (err) => {
        // El backend rechaza la transición (p. ej. EN_PREPARACION -> EN_CAMINO): se muestra su motivo.
        this.isDispatchingDelivery.set(false);
        this.notify.showError(
          err?.error?.error || `No se pudo despachar la orden #${this.getCodeNum(order.codigoSeguimiento)}`
        );
      }
    });
  }

  cancelarOrden(order: Order): void {
    this.ordersService.updateOrderStatus(order.id, 'CANCELADO').subscribe({
      next: () => {
        this.notify.showInfo(`Orden #${this.getCodeNum(order.codigoSeguimiento)} cancelada`);
      },
      error: () => {
        this.notify.showError('No se pudo cancelar la orden');
      }
    });
  }

  abrirModalNuevaOrden(): void {
    const prods = this.productsService.products();
    this.manualOrder = {
      modo: 'CREAR',
      ordenId: null,
      mesaId: null,
      tipo: 'DELIVERY',
      metodoPago: 'EFECTIVO_CONTRAENTREGA',
      clienteNombre: '',
      clienteCelular: '',
      direccion: '',
      selectedProductId: prods.length > 0 ? prods[0].id : '1',
      cantidad: 1,
      notas: ''
    };
    this.showCreateOrderModal = true;
  }

  /** Toma de comanda de salón desde el inspector de la mesa (sin comanda activa). */
  abrirTomarComandaMesa(mesa: MesaSalon): void {
    const prods = this.productsService.products();
    this.manualOrder = {
      modo: 'CREAR',
      ordenId: null,
      mesaId: mesa.id,
      tipo: 'SALON',
      metodoPago: 'EFECTIVO_CONTRAENTREGA',
      clienteNombre: '',
      clienteCelular: '',
      direccion: '',
      selectedProductId: prods.length > 0 ? prods[0].id : '1',
      cantidad: 1,
      notas: ''
    };
    this.showCreateOrderModal = true;
  }

  /** Segunda ronda: suma platos a la comanda activa de la mesa. */
  abrirAgregarPlatosMesa(mesa: MesaSalon): void {
    if (!mesa.ordenActiva) {
      this.abrirTomarComandaMesa(mesa);
      return;
    }
    const prods = this.productsService.products();
    this.manualOrder = {
      modo: 'AGREGAR',
      ordenId: String(mesa.ordenActiva.ordenId),
      mesaId: mesa.id,
      tipo: 'SALON',
      metodoPago: 'EFECTIVO_CONTRAENTREGA',
      clienteNombre: '',
      clienteCelular: '',
      direccion: '',
      selectedProductId: prods.length > 0 ? prods[0].id : '1',
      cantidad: 1,
      notas: ''
    };
    this.showCreateOrderModal = true;
  }

  /** Cobro de una comanda de salón: cierra la orden y el backend libera la mesa. */
  cobrarComandaMesa(mesa: MesaSalon): void {
    const orden = mesa.ordenActiva;
    if (!orden) {
      this.notify.showWarning('La mesa no tiene una comanda activa');
      return;
    }
    if (orden.estadoOrden !== 'LISTO') {
      this.notify.showWarning(
        'La comanda todavía no está lista',
        `Cocina debe marcarla LISTO antes de cobrar (estado actual: ${orden.estadoOrden}).`
      );
      return;
    }

    this.ordersService.updateOrderStatus(String(orden.ordenId), 'COMPLETADO').subscribe({
      next: () => {
        this.recargarSalonYOrdenes();
        this.selectedMesa.set(null);
        this.notify.showSuccess(`Comanda #${orden.ordenId} cobrada; la mesa quedó libre`);
      },
      error: (err) => {
        const motivo = err?.error?.error || err?.error?.message || err?.message
          || 'El backend rechazó el cierre de la comanda';
        this.notify.showError('No se pudo cobrar la comanda', motivo);
      }
    });
  }

  private recargarSalonYOrdenes(): void {
    this.salonService.cargarMesas();
    this.ordersService.loadActiveOrders();
  }

  crearOrdenManual(): void {
    const prod = this.productsService.products().find(p => p.id === this.manualOrder.selectedProductId);
    if (!prod) {
      this.notify.showError('Selecciona un producto válido');
      return;
    }

    const cantidad = Math.max(1, Number(this.manualOrder.cantidad) || 1);
    const items = [{ productoId: prod.id, cantidad, notas: this.manualOrder.notas }];

    if (this.manualOrder.modo === 'AGREGAR') {
      const ordenId = this.manualOrder.ordenId;
      if (!ordenId) {
        this.notify.showError('No se pudo determinar la comanda a ampliar');
        return;
      }
      this.ordersService.agregarItemsAOrden(ordenId, items).subscribe({
        next: () => {
          this.showCreateOrderModal = false;
          this.recargarSalonYOrdenes();
          this.notify.showSuccess(`${cantidad} plato(s) agregado(s) a la comanda #${this.getCodeNum(ordenId)}`);
        },
        error: (err) => this.notify.showError(
          'No se pudieron agregar los platos',
          err?.message || 'El servidor rechazó los platos nuevos'
        )
      });
      return;
    }

    const tipo = this.manualOrder.tipo;

    if (tipo === 'SALON') {
      const mesaId = Number(this.manualOrder.mesaId);
      const mesa = this.salonService.mesas().find(m => Number(m.id) === mesaId);
      if (!mesa) {
        this.notify.showError('Selecciona la mesa de la comanda');
        return;
      }
      if (mesa.ordenActiva) {
        this.notify.showWarning(
          'La mesa ya tiene una comanda activa',
          'Usá «Agregar platos» en el inspector de la mesa para sumar la segunda ronda.'
        );
        return;
      }

      this.ordersService.createOrder({
        tipo: 'SALON',
        mesaId,
        metodoPago: this.manualOrder.metodoPago,
        cliente: {
          nombre: `Mesa ${String(mesa.numero).padStart(2, '0')}`,
          celular: '',
          mesaNumero: mesa.numero
        },
        items
      }).subscribe({
        next: (created) => {
          this.showCreateOrderModal = false;
          this.recargarSalonYOrdenes();
          this.notify.showSuccess(`Comanda de ${mesa.nombre} creada (Orden #${this.getCodeNum(created.codigoSeguimiento)})`);
        },
        error: (err) => this.notify.showError(
          'Error al crear la comanda',
          err?.message || 'El servidor rechazó la comanda'
        )
      });
      return;
    }

    // DELIVERY / RECOJO: el cliente y su contacto son obligatorios.
    if (!this.manualOrder.clienteNombre || !this.manualOrder.clienteCelular) {
      this.notify.showError('Por favor ingresa nombre y celular del cliente');
      return;
    }

    if (tipo === 'DELIVERY' && !this.manualOrder.direccion.trim()) {
      this.notify.showError('Ingresa la dirección de entrega para un pedido de delivery');
      return;
    }

    this.ordersService.createOrder({
      tipo,
      metodoPago: this.manualOrder.metodoPago,
      cliente: {
        nombre: this.manualOrder.clienteNombre,
        celular: this.manualOrder.clienteCelular,
        // Sin dirección inventada: RECOJO no lleva dirección de entrega.
        direccion: tipo === 'DELIVERY' ? (this.manualOrder.direccion || undefined) : undefined
      },
      items
    }).subscribe({
      next: (created) => {
        this.showCreateOrderModal = false;
        this.ordersService.loadActiveOrders();
        this.notify.showSuccess(`Orden #${this.getCodeNum(created.codigoSeguimiento)} creada con éxito`);
      },
      error: (err) => this.notify.showError(
        'Error al crear orden en el backend',
        err?.message || 'El servidor rechazó el pedido'
      )
    });
  }

  guardarNuevoProducto(): void {
    if (!this.newProduct.nombre || this.newProduct.precio <= 0) {
      this.notify.showError('Por favor ingresa nombre y precio válido');
      return;
    }

    this.productsService.createProduct(this.newProduct);
    this.notify.showSuccess(`Plato "${this.newProduct.nombre}" creado exitosamente`);
    this.showCreateProductModal = false;

    this.newProduct = {
      nombre: '',
      descripcion: '',
      precio: 0,
      categoria: 'POLLOS_A_LA_BRASA',
      imagenUrl: '/assets/images/hero-panoramic.jpg',
      agotado: false,
      tiempoEstimadoMin: 20
    };
  }

  // ================= MÉTODOS DE SALÓN Y MESAS (FASE 2) =================

  
  // ================= MÉTODOS CRUD DE MESAS (FASE 2 - ADMIN) =================

  abrirCrearMesaModal(): void {
    const existing = this.salonService.mesas();
    const nextNum = existing.length > 0 ? Math.max(...existing.map(m => Number(m.numero || 0))) + 1 : 1;
    this.crearMesaForm = {
      numero: nextNum,
      capacidad: 4,
      zona: 'SALON_PRINCIPAL',
      posicionX: 0,
      posicionY: 0
    };
    this.showCrearMesaModal = true;
  }

  guardarCrearMesa(): void {
    if (this.crearMesaForm.numero <= 0 || this.crearMesaForm.capacidad <= 0) {
      this.notify.showWarning('El número de mesa y la capacidad deben ser mayores a 0');
      return;
    }
    this.isProcesandoMesa.set(true);
    this.mensajeProcesandoMesa.set(`Creando y registrando Mesa #${this.crearMesaForm.numero}...`);
    this.salonService.crearMesa({
      numero: this.crearMesaForm.numero,
      capacidad: this.crearMesaForm.capacidad,
      zona: this.crearMesaForm.zona,
      posicionX: this.crearMesaForm.posicionX,
      posicionY: this.crearMesaForm.posicionY
    }).subscribe({
      next: (m) => {
        this.isProcesandoMesa.set(false);
        this.showCrearMesaModal = false;
        this.notify.showSuccess(`Mesa #${m.numero} registrada exitosamente`);
      },
      error: (err) => {
        this.isProcesandoMesa.set(false);
        this.notify.showError(err?.error?.message || 'Error al crear la mesa');
      }
    });
  }

  abrirEditarMesaModal(mesa: MesaSalon): void {
    this.editarMesaForm = {
      id: mesa.id,
      numero: mesa.numero || 1,
      capacidad: mesa.capacidad || 4,
      zona: (mesa.zona || 'SALON_PRINCIPAL') as SalonZona,
      posicionX: mesa.posicionX || 0,
      posicionY: mesa.posicionY || 0,
      activo: mesa.activo !== undefined ? mesa.activo : true
    };
    this.showEditarMesaModal = true;
  }

  guardarEditarMesa(): void {
    if (this.editarMesaForm.numero <= 0 || this.editarMesaForm.capacidad <= 0) {
      this.notify.showWarning('El número y la capacidad deben ser válidos');
      return;
    }
    this.isProcesandoMesa.set(true);
    this.mensajeProcesandoMesa.set(`Guardando cambios de Mesa #${this.editarMesaForm.numero}...`);
    this.salonService.actualizarMesa(this.editarMesaForm.id, {
      numero: this.editarMesaForm.numero,
      capacidad: this.editarMesaForm.capacidad,
      zona: this.editarMesaForm.zona,
      posicionX: this.editarMesaForm.posicionX,
      posicionY: this.editarMesaForm.posicionY,
      activo: this.editarMesaForm.activo
    }).subscribe({
      next: () => {
        this.isProcesandoMesa.set(false);
        this.showEditarMesaModal = false;
        this.notify.showSuccess(`Mesa #${this.editarMesaForm.numero} actualizada exitosamente`);
      },
      error: (err) => {
        this.isProcesandoMesa.set(false);
        this.notify.showError(err?.error?.message || 'Error al actualizar mesa');
      }
    });
  }

  darDeBajaMesa(mesa: MesaSalon): void {
    if (confirm(`¿Estás seguro de dar de baja la Mesa #${mesa.numero}? Se preservará el histórico contable.`)) {
      this.isProcesandoMesa.set(true);
      this.mensajeProcesandoMesa.set(`Dando de baja Mesa #${mesa.numero}...`);
      this.salonService.eliminarMesa(mesa.id).subscribe({
        next: () => {
          this.isProcesandoMesa.set(false);
          if (this.selectedMesa()?.id === mesa.id) {
            this.selectedMesa.set(null);
          }
        },
        error: (err) => {
          this.isProcesandoMesa.set(false);
          this.notify.showError(err?.error?.message || 'No se pudo dar de baja la mesa');
        }
      });
    }
  }

  abrirEditarCoordenadas(mesa: MesaSalon): void {
    this.mesaEditarCoordenadas = mesa;
    this.coordX = mesa.posicionX || 0;
    this.coordY = mesa.posicionY || 0;
    this.showEditarCoordenadasModal = true;
  }

  guardarCoordenadasMesa(): void {
    if (!this.mesaEditarCoordenadas) return;
    this.isProcesandoMesa.set(true);
    this.mensajeProcesandoMesa.set(`Guardando coordenadas de Mesa #${this.mesaEditarCoordenadas.numero}...`);
    this.salonService.actualizarPosicionMesa(this.mesaEditarCoordenadas.id, this.coordX, this.coordY).subscribe({
      next: () => {
        this.isProcesandoMesa.set(false);
        this.notify.showSuccess(`Posición de ${this.mesaEditarCoordenadas?.nombre} actualizada a (${this.coordX}, ${this.coordY})`);
        this.showEditarCoordenadasModal = false;
      },
      error: () => {
        this.isProcesandoMesa.set(false);
        this.notify.showError('No se pudo guardar la posición de la mesa');
      }
    });
  }

  cambiarEstadoMesaDirecto(mesa: MesaSalon, nuevoEstado: MesaEstado): void {
    // El backend rechaza LIBRE/EN_LIMPIEZA con comanda activa (409). En la UI se avisa antes
    // de disparar la petición, igual que en la ventana del mozo.
    if ((nuevoEstado === 'LIBRE' || nuevoEstado === 'EN_LIMPIEZA') && mesa.ordenActiva) {
      this.notify.showWarning(
        'Comanda activa',
        `Cobrá o cancelá la comanda #${mesa.ordenActiva.ordenId} antes de pasar la mesa a ${nuevoEstado}.`
      );
      return;
    }

    this.isProcesandoMesa.set(true);
    this.mensajeProcesandoMesa.set(`Actualizando estado de Mesa #${mesa.numero} a ${nuevoEstado}...`);
    this.salonService.actualizarEstadoMesa(mesa.id, nuevoEstado).subscribe({
      next: () => {
        this.isProcesandoMesa.set(false);
        this.notify.showSuccess(`${mesa.nombre} cambiada a ${nuevoEstado}`);
      },
      error: () => {
        this.isProcesandoMesa.set(false);
        this.notify.showError(`No se pudo cambiar ${mesa.nombre} a ${nuevoEstado}`);
      }
    });
  }

  toggleEstadoMesa(m: MesaSalon): void {
    let siguiente: MesaEstado = 'LIBRE';
    if (m.estado === 'LIBRE') siguiente = 'OCUPADA';
    else if (m.estado === 'OCUPADA') siguiente = 'POR_COBRAR';
    else if (m.estado === 'POR_COBRAR') siguiente = 'EN_LIMPIEZA';
    else siguiente = 'LIBRE';

    this.cambiarEstadoMesaDirecto(m, siguiente);
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
    return this.salonService.mesas().find(m => 
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
      this.selectedMesa.set(mesa);
      this.notify.showInfo(`Mesa #${mesa.numero} en modo mover. Haz clic en una casilla vacía.`);
    }
  }

  onCasillaClick(row: number, col: number): void {
    const mesaExistente = this.getMesaEnCasilla(row, col);
    if (mesaExistente) {
      if (this.mesaEnMovimiento() && this.mesaEnMovimiento()?.id !== mesaExistente.id) {
        this.notify.showWarning(`La casilla (${col}, ${row}) ya está ocupada por la Mesa #${mesaExistente.numero}`);
      } else {
        this.selectedMesa.set(mesaExistente);
      }
      return;
    }

    const enMovimiento = this.mesaEnMovimiento();
    if (enMovimiento) {
      const zonaActual = this.currentZona().id;
      this.isProcesandoMesa.set(true);
      this.mensajeProcesandoMesa.set(`Reubicando Mesa #${enMovimiento.numero} a F${row}:C${col}...`);
      this.salonService.actualizarMesa(enMovimiento.id, {
        posicionX: col,
        posicionY: row,
        zona: zonaActual
      }).subscribe({
        next: () => {
          this.isProcesandoMesa.set(false);
          enMovimiento.posicionX = col;
          enMovimiento.posicionY = row;
          enMovimiento.zona = zonaActual;
          this.notify.showSuccess(`Mesa #${enMovimiento.numero} reubicada en (${col}, ${row}) de ${this.currentZona().nombre}`);
          this.mesaEnMovimiento.set(null);
        },
        error: (err) => {
          this.isProcesandoMesa.set(false);
          this.notify.showError(err?.error?.message || 'Error al reubicar mesa');
        }
      });
      return;
    }

    // Casilla vacía: crear nueva mesa
    const existing = this.salonService.mesas();
    const nextNum = existing.length > 0 ? Math.max(...existing.map(m => Number(m.numero || 0))) + 1 : 1;
    this.crearMesaForm = {
      numero: nextNum,
      capacidad: 4,
      zona: this.currentZona().id,
      posicionX: col,
      posicionY: row
    };
    this.showCrearMesaModal = true;
  }

  onDragStartMesa(event: DragEvent, mesa: MesaSalon): void {
    event.dataTransfer?.setData('text/plain', String(mesa.id));
    this.mesaEnMovimiento.set(mesa);
    this.selectedMesa.set(mesa);
  }

  onDragOverCasilla(event: DragEvent): void {
    event.preventDefault();
  }

  onDropCasilla(event: DragEvent, row: number, col: number): void {
    event.preventDefault();
    const mesaId = event.dataTransfer?.getData('text/plain');
    if (!mesaId) return;

    if (this.getMesaEnCasilla(row, col)) {
      this.notify.showWarning('Esa casilla ya está ocupada');
      return;
    }

    const mesa = this.salonService.mesas().find(m => String(m.id) === String(mesaId));
    if (!mesa) return;

    const zonaActual = this.currentZona().id;
    this.isProcesandoMesa.set(true);
    this.mensajeProcesandoMesa.set(`Reubicando Mesa #${mesa.numero} a F${row}:C${col}...`);
    this.salonService.actualizarMesa(mesa.id, {
      posicionX: col,
      posicionY: row,
      zona: zonaActual
    }).subscribe({
      next: () => {
        this.isProcesandoMesa.set(false);
        mesa.posicionX = col;
        mesa.posicionY = row;
        mesa.zona = zonaActual;
        this.notify.showSuccess(`Mesa #${mesa.numero} movida a Casilla (${col}, ${row})`);
        this.mesaEnMovimiento.set(null);
      },
      error: (err) => {
        this.isProcesandoMesa.set(false);
        this.notify.showError(err?.error?.message || 'Error al mover mesa');
      }
    });
  }

  autoOrganizarCuadricula(): void {
    const zonaActual = this.currentZona();
    const mesasZona = this.salonService.mesas()
      .filter(m => (m.zona || 'SALON_PRINCIPAL') === zonaActual.id)
      .sort((a, b) => Number(a.numero || 0) - Number(b.numero || 0));

    if (mesasZona.length === 0) {
      this.notify.showInfo(`No hay mesas registradas en ${zonaActual.nombre}`);
      return;
    }

    this.isProcesandoMesa.set(true);
    this.mensajeProcesandoMesa.set(`Organizando mesas en cuadrícula de ${zonaActual.nombre}...`);

    let r = 1;
    let c = 1;
    const peticiones = mesasZona.map(m => {
      const targetCol = c;
      const targetRow = r;
      c++;
      if (c > zonaActual.columnas) {
        c = 1;
        r++;
      }
      return this.salonService.actualizarMesa(m.id, {
        posicionX: targetCol,
        posicionY: targetRow,
        zona: zonaActual.id
      });
    });

    forkJoin(peticiones).subscribe({
      next: () => {
        this.isProcesandoMesa.set(false);
        this.notify.showSuccess(`Mesas de ${zonaActual.nombre} organizadas en cuadrícula`);
      },
      error: () => {
        this.isProcesandoMesa.set(false);
        this.notify.showError(
          '❌ Error al auto-organizar',
          'Falló la reubicación de mesas. Restaurando cuadrícula original...'
        );
        this.salonService.cargarMesas();
      }
    });
  }

  // ================= MÉTODOS DE INVENTARIO Y MERMAS (FASE 6) =================

  abrirModalDespacho(): void {
    const insumos = this.inventoryService.insumos();
    if (insumos.length > 0) {
      this.despachoForm.insumoId = insumos[0].id;
    }
    this.despachoForm.cantidad = 5;
    this.despachoForm.estacion = 'HORNO';
    this.showDespachoModal = true;
  }

  confirmarDespacho(): void {
    if (this.despachoForm.cantidad <= 0) {
      this.notify.showWarning('Ingresa una cantidad mayor a 0');
      return;
    }
    this.inventoryService.despacharACocina({
      insumoId: Number(this.despachoForm.insumoId),
      cantidad: Number(this.despachoForm.cantidad),
      estacionDestino: this.despachoForm.estacion
    }).subscribe({
      next: () => {
        this.notify.showSuccess(`Despacho de ${this.despachoForm.cantidad} unidades enviado a ${this.despachoForm.estacion}`);
        this.showDespachoModal = false;
      },
      error: () => {
        this.notify.showError(`No se pudo registrar el despacho a ${this.despachoForm.estacion}`);
      }
    });
  }

  /** Unidad de medida real del insumo (MermaResponse no la incluye). */
  unidadDeInsumo(insumoId: number): string {
    return this.inventoryService.insumos().find(i => i.id === insumoId)?.unidadMedida ?? '';
  }

  abrirModalMerma(): void {
    const insumos = this.inventoryService.insumos();
    if (insumos.length > 0) {
      this.mermaForm.insumoId = insumos[0].id;
    }
    this.mermaForm.cantidad = 1;
    this.mermaForm.motivo = 'VENCIMIENTO';
    this.mermaForm.justificacion = '';
    this.showMermaModal = true;
  }

  confirmarMerma(): void {
    if (this.mermaForm.cantidad <= 0) {
      this.notify.showWarning('Ingresa una cantidad válida de merma');
      return;
    }
    this.inventoryService.registrarMerma({
      insumoId: Number(this.mermaForm.insumoId),
      cantidad: Number(this.mermaForm.cantidad),
      motivo: this.mermaForm.motivo,
      justificacion: this.mermaForm.justificacion || undefined
    }).subscribe({
      next: () => {
        this.notify.showSuccess('Merma registrada en bitácora de inventario');
        this.showMermaModal = false;
      },
      error: () => {
        this.notify.showError('No se pudo registrar la merma');
      }
    });
  }

  // ================= MÉTODOS DE FINANZAS Y CAJA (FASE 6) =================

  confirmarAperturaCaja(): void {
    this.financeService.abrirCaja(this.montoApertura).subscribe({
      next: () => {
        this.notify.showSuccess(`Caja de turno abierta con S/. ${this.montoApertura.toFixed(2)}`);
        this.showAbrirCajaModal = false;
      },
      error: () => {
        this.notify.showError('No se pudo abrir la caja del turno');
      }
    });
  }

  abrirModalCierreCaja(): void {
    const caja = this.financeService.cajaActual();
    const esperado = (caja?.montoInicial || 0) + (caja?.ventasEfectivo || 0);
    this.cierreEfectivoReal = esperado;
    this.cierreObservaciones = 'Cierre de turno regular sin novedades';
    this.showCerrarCajaModal = true;
  }

  confirmarCierreCaja(): void {
    this.financeService.cerrarCaja(this.cierreEfectivoReal, this.cierreObservaciones).subscribe({
      next: (cierre) => {
        const disc = cierre.discrepancia || 0;
        if (Math.abs(disc) > 0.01) {
          this.notify.showWarning(`Caja cerrada con descuadre de S/. ${disc.toFixed(2)}`);
        } else {
          this.notify.showSuccess('Arqueo de caja cuadrado a la perfección');
        }
        this.showCerrarCajaModal = false;
      },
      error: () => {
        this.notify.showError('No se pudo cerrar la caja del turno');
      }
    });
  }

  confirmarMovimientoCaja(): void {
    if (!this.movimientoForm.concepto.trim() || this.movimientoForm.monto <= 0) {
      this.notify.showWarning('Ingresa concepto y monto válido');
      return;
    }
    this.financeService.registrarMovimiento({
      tipo: this.movimientoForm.tipo,
      concepto: this.movimientoForm.concepto,
      monto: Number(this.movimientoForm.monto)
    }).subscribe({
      next: () => {
        this.notify.showSuccess(`Movimiento de S/. ${this.movimientoForm.monto.toFixed(2)} registrado en caja menor`);
        this.showMovimientoCajaModal = false;
        this.movimientoForm.concepto = '';
        this.movimientoForm.monto = 0;
      },
      error: () => {
        this.notify.showError('No se pudo registrar el movimiento de caja chica');
      }
    });
  }

  // ================= MÉTODOS DE FEEDBACK Y RECLAMOS (FASE 4) =================

  abrirModalResolverReclamo(rec: ReporteReclamo): void {
    this.reclamoSeleccionado = rec;
    this.resolucionTexto = 'Se verificó la orden y se procede con la compensación al cliente.';
    this.emitirReembolso = true;
    this.showResolverReclamoModal = true;
  }

  confirmarResolverReclamo(): void {
    if (!this.reclamoSeleccionado) return;
    this.feedbackService.resolverReclamo(
      this.reclamoSeleccionado.id,
      this.resolucionTexto,
      this.emitirReembolso
    ).subscribe({
      next: () => {
        this.notify.showSuccess(`Reclamo #${this.reclamoSeleccionado?.id} resuelto.`);
        this.showResolverReclamoModal = false;
      },
      error: () => {
        this.notify.showError(`No se pudo resolver el reclamo #${this.reclamoSeleccionado?.id}`);
      }
    });
  }

  // ================= MÉTODOS DE SOPORTE E INCIDENTES (FASE 6) =================

  confirmarRegistroIncidente(): void {
    if (!this.incidenteForm.titulo.trim() || !this.incidenteForm.causaRaiz.trim()) {
      this.notify.showWarning('Por favor ingresa título y causa raíz del incidente');
      return;
    }
    this.securityAuditService.registrarIncidente({
      titulo: this.incidenteForm.titulo,
      modulo: this.incidenteForm.modulo,
      severidad: this.incidenteForm.severidad,
      causaRaiz: this.incidenteForm.causaRaiz,
      solucionAplicada: this.incidenteForm.solucionAplicada || 'En seguimiento',
      reportadoPor: this.authService.currentUser()?.nombre || 'Administrador'
    }).subscribe({
      next: () => {
        this.notify.showSuccess('Incidente documentado en bitácora de soporte');
        this.showIncidenteModal = false;
        this.incidenteForm.titulo = '';
        this.incidenteForm.causaRaiz = '';
        this.incidenteForm.solucionAplicada = '';
      },
      error: () => {
        this.notify.showError('No se pudo documentar el incidente');
      }
    });
  }

  cerrarSesion(): void {
    this.authService.logout();
    this.notify.showInfo('Sesión finalizada', 'Has salido del panel administrativo.');
    this.router.navigate(['/login']);
  }
}
