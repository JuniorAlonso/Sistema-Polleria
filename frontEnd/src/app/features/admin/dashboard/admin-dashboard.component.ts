import { Component, inject, signal, computed, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { OrdersService } from '../../../core/services/orders.service';
import { ProductsService } from '../../../core/services/products.service';
import { AuthService } from '../../../core/services/auth.service';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { NotificationService } from '../../../core/services/notification.service';
import { Order, OrderStatus, OrderType, PaymentMethod } from '../../../core/models/order.model';
import { Product } from '../../../core/models/product.model';

export type DashboardTab = 
  | 'ORDENES' 
  | 'MESAS' 
  | 'INVENTARIO' 
  | 'REPARTO' 
  | 'FINANZAS' 
  | 'FEEDBACK' 
  | 'NOTIFICACIONES' 
  | 'SOPORTE';

interface TableSalon {
  id: number;
  nombre: string;
  zona: 'SALON_PRINCIPAL' | 'TERRAZA' | 'ZONA_VIP';
  capacidad: number;
  estado: 'LIBRE' | 'OCUPADA' | 'POR_COBRAR' | 'RESERVADA';
  mozo?: string;
  comensales?: number;
  tiempoMinutos?: number;
  totalConsumo?: number;
  platosListos?: boolean;
}

interface InsumoAlmacen {
  id: string;
  nombre: string;
  categoria: 'CARNES' | 'VERDURAS' | 'ABARROTES' | 'BEBIDAS' | 'INSUMOS_FUEGO';
  stockActual: number;
  stockMinimo: number;
  unidadMedida: string;
  costoUnitario: number;
  estado: 'OPTIMO' | 'BAJO' | 'CRITICO';
}

interface RegistroMerma {
  id: string;
  fecha: string;
  insumo: string;
  cantidad: number;
  unidad: string;
  motivo: 'COCCION_EXCESIVA' | 'VENCIMIENTO' | 'DESCARTE_MANIPULACION' | 'DEFECTO_PROVEEDOR';
  costoPerdida: number;
  responsable: string;
}

interface MotorizadoDelivery {
  id: string;
  nombre: string;
  telefono: string;
  placa: string;
  pedidosHoy: number;
  estado: 'DISPONIBLE' | 'EN_RUTA' | 'DESCANSO';
  pedidoActual?: string;
}

interface TransaccionFinanzas {
  id: string;
  ordenCodigo: string;
  canal: 'DELIVERY' | 'SALON' | 'RECOJO';
  metodoPago: 'VISA' | 'MASTERCARD' | 'YAPE' | 'PLIN' | 'EFECTIVO';
  monto: number;
  estado: 'APROBADO' | 'PENDIENTE' | 'REEMBOLSADO' | 'RECHAZADO';
  fechaHora: string;
  referencia: string;
}

interface ReporteFeedback {
  id: string;
  cliente: string;
  telefono: string;
  ordenCodigo: string;
  tipo: 'RESEÑA' | 'RECLAMO';
  estrellas?: number;
  mensaje: string;
  evidenciaFotoUrl?: string;
  estado: 'ABIERTO' | 'EN_REVISION' | 'RESUELTO';
  fecha: string;
  solucion?: string;
}

interface NotificacionLog {
  id: string;
  destinatario: string;
  telefono: string;
  canal: 'WHATSAPP' | 'WEBSOCKET_MOZO' | 'EMAIL';
  plantilla: string;
  estado: 'ENVIADO' | 'EN_COLA' | 'FALLIDO';
  latenciaMs: number;
  fechaHora: string;
}

interface IncidenteSoporte {
  id: string;
  titulo: string;
  modulo: 'PAGOS' | 'COCINA_HORNO' | 'RED_WIFI' | 'SISTEMA_LOCAL';
  severidad: 'ALTA' | 'MEDIA' | 'BAJA';
  estado: 'RESUELTO' | 'EN_INVESTIGACION';
  causaRaiz: string;
  solucionAplicada: string;
  reportadoPor: string;
  fechaHora: string;
}

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
            (click)="activeTab.set('NOTIFICACIONES')"
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

                        <button 
                          (click)="advanceAfterReady(order)"
                          class="px-4 py-1.5 rounded-lg bg-[#2a2e36] hover:bg-purple-600 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-xs"
                        >
                          {{ order.tipo === 'DELIVERY' ? 'A REPARTO' : 'ENTREGAR' }}
                        </button>
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
                          ✓ Entregado
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


      <!-- ================= TAB 2: MESAS & SALÓN (FASE 2 - PRÓXIMAMENTE) ================= -->
      @if (activeTab() === 'MESAS') {
        <main class="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
          
          <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-[#14161a] p-4 rounded-2xl border border-white/10 shadow-lg">
            <div>
              <h2 class="text-2xl font-bold text-white flex items-center gap-2">
                <span>Gestión de Salón & Mesas</span>
                <span class="text-[11px] font-normal text-amber-400 px-2.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20">
                  Fase 2 - Próximamente
                </span>
              </h2>
              <p class="text-xs text-slate-400">Control de ocupación, comandas de mozo y aviso en tiempo real de platos listos.</p>
            </div>

            <!-- Legend Badges -->
            <div class="flex flex-wrap items-center gap-3 text-xs">
              <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-emerald-500"></span> Libre ({{ getFreeTablesCount() }})</span>
              <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-rose-500"></span> Ocupada ({{ getOccupiedTablesCount() }})</span>
              <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-amber-400"></span> Por Cobrar (1)</span>
              <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-sky-500"></span> Reservada (1)</span>
            </div>
          </div>

          <!-- Tables Grid Layout -->
          <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            @for (t of mesas; track t.id) {
              <div 
                (click)="selectedMesa.set(t)"
                class="p-5 rounded-2xl border transition duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between"
                [ngClass]="{
                  'bg-[#121418] border-emerald-500/30 hover:border-emerald-400': t.estado === 'LIBRE',
                  'bg-[#1e1518] border-rose-500/40 hover:border-rose-400': t.estado === 'OCUPADA',
                  'bg-[#1e1b12] border-amber-500/40 hover:border-amber-400': t.estado === 'POR_COBRAR',
                  'bg-[#121820] border-sky-500/40 hover:border-sky-400': t.estado === 'RESERVADA',
                  'ring-2 ring-polleria-gold': selectedMesa()?.id === t.id
                }"
              >
                @if (t.platosListos) {
                  <div class="absolute top-2 right-2 flex items-center gap-1 bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full animate-bounce">
                    <span>⚡ PLATO LISTO</span>
                  </div>
                }

                <div>
                  <div class="flex justify-between items-start mb-2">
                    <span class="font-display text-xl font-bold text-white">{{ t.nombre }}</span>
                    <span 
                      class="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      [ngClass]="{
                        'bg-emerald-500/20 text-emerald-400': t.estado === 'LIBRE',
                        'bg-rose-500/20 text-rose-400': t.estado === 'OCUPADA',
                        'bg-amber-500/20 text-amber-300': t.estado === 'POR_COBRAR',
                        'bg-sky-500/20 text-sky-300': t.estado === 'RESERVADA'
                      }"
                    >
                      {{ t.estado }}
                    </span>
                  </div>
                  
                  <p class="text-xs text-slate-400">{{ t.zona.replace('_', ' ') }} • {{ t.capacidad }} personas</p>

                  @if (t.estado === 'OCUPADA' || t.estado === 'POR_COBRAR') {
                    <div class="mt-3 text-xs space-y-1">
                      <p class="text-slate-300"><span class="text-slate-500">Mozo:</span> {{ t.mozo }}</p>
                      <p class="text-slate-300"><span class="text-slate-500">Tiempo:</span> {{ t.tiempoMinutos }} min</p>
                    </div>
                  }
                </div>

                <div class="mt-4 pt-3 border-t border-white/10 flex justify-between items-center">
                  <span class="font-display text-lg font-bold text-polleria-gold">
                    {{ (t.totalConsumo || 0) | currencyPEN }}
                  </span>
                  <button 
                    (click)="toggleEstadoMesa(t); $event.stopPropagation()"
                    class="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    {{ t.estado === 'LIBRE' ? 'Ocupar' : 'Liberar' }}
                  </button>
                </div>

              </div>
            }
          </div>

          <!-- Panel de Detalle de Mesa Seleccionada -->
          @if (selectedMesa(); as mesa) {
            <div class="p-6 bg-[#14161a] rounded-2xl border border-polleria-gold/30 shadow-2xl flex flex-col md:flex-row justify-between gap-6 items-center">
              <div class="space-y-1">
                <div class="flex items-center gap-3">
                  <h3 class="font-display text-2xl font-bold text-white">Comanda Activa: {{ mesa.nombre }}</h3>
                  <span class="text-xs font-mono px-2.5 py-0.5 rounded bg-polleria-gold/20 text-polleria-gold font-bold">
                    Mozo: {{ mesa.mozo || 'Sin Asignar' }}
                  </span>
                </div>
                <p class="text-xs text-slate-400">1x 1 Pollo a la Brasa Tradicional + 1x Jarra Chicha 1L + 2x Porción Papas Extra</p>
              </div>

              <div class="flex flex-wrap gap-2">
                <button 
                  (click)="notify.showSuccess('Comanda enviada a cocina (KDS Horno)')"
                  class="px-4 py-2 bg-polleria-crimson hover:bg-polleria-crimsonHover text-white font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  + Agregar Platos
                </button>
                <button 
                  (click)="notify.showInfo('Pre-cuenta generada', 'Imprimiendo ticket para ' + mesa.nombre)"
                  class="px-4 py-2 bg-[#2a2e36] hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Emitir Pre-Cuenta
                </button>
                <button 
                  (click)="mesa.platosListos = false; notify.showSuccess('Alerta de plato servido')"
                  class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Marcar Servido
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
                Predicción
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

          <!-- SUB-VIEW 2: INSUMOS & DESPACHO (FASE 4 - PRÓXIMAMENTE) -->
          @if (inventarioSubTab() === 'INSUMOS') {
            <div class="space-y-4">
              <div class="flex justify-between items-center bg-[#1c1f24] p-4 rounded-xl border border-white/5">
                <div>
                  <h3 class="font-bold text-white flex items-center gap-2">
                    <span>Almacén Central de Insumos</span>
                    <span class="text-[10px] text-amber-400 px-2 py-0.5 rounded bg-amber-400/10">Fase 4 - Próximamente</span>
                  </h3>
                  <p class="text-xs text-slate-400">Despacho de lotes autorizado por el Chef hacia hornos y freidoras.</p>
                </div>
                <button 
                  (click)="solicitarDespachoModal()"
                  class="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition shadow cursor-pointer"
                >
                  ⚡ Solicitar Despacho de Lote a Cocina
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
                    @for (ins of insumos; track ins.id) {
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

          <!-- SUB-VIEW 3: MERMAS DIARIAS (FASE 4 - PRÓXIMAMENTE) -->
          @if (inventarioSubTab() === 'MERMAS') {
            <div class="space-y-4">
              <div class="flex justify-between items-center bg-[#1c1f24] p-4 rounded-xl border border-white/5">
                <div>
                  <h3 class="font-bold text-white flex items-center gap-2">
                    <span>Registro de Mermas de Jornada</span>
                    <span class="text-[10px] text-amber-400 px-2 py-0.5 rounded bg-amber-400/10">Fase 4 - Próximamente</span>
                  </h3>
                  <p class="text-xs text-slate-400">Insumos no comercializados o descartados durante el turno.</p>
                </div>
                <button 
                  (click)="registrarMermaModal()"
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
                      <th class="p-4">Costo Pérdida</th>
                      <th class="p-4">Responsable</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/5">
                    @for (m of mermas; track m.id) {
                      <tr class="hover:bg-white/5 transition">
                        <td class="p-4 font-mono text-slate-400">{{ m.fecha }}</td>
                        <td class="p-4 font-bold text-white">{{ m.insumo }}</td>
                        <td class="p-4 font-mono text-rose-300 font-bold">{{ m.cantidad }} {{ m.unidad }}</td>
                        <td class="p-4 text-slate-300">{{ m.motivo.replace('_', ' ') }}</td>
                        <td class="p-4 font-mono font-bold text-rose-400">{{ m.costoPerdida | currencyPEN }}</td>
                        <td class="p-4 text-slate-400">{{ m.responsable }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }

          <!-- SUB-VIEW 4: PREDICCIÓN & MÉTRICAS (FASE 4 - PRÓXIMAMENTE) -->
          @if (inventarioSubTab() === 'PREDICCION') {
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div class="p-5 rounded-2xl bg-[#14161a] border border-white/10 space-y-3">
                <span class="text-xs text-slate-400 uppercase font-bold">Consumo Promedio Diario</span>
                <p class="font-display text-3xl font-black text-polleria-gold">85 Pollos / día</p>
                <p class="text-xs text-emerald-400">↑ +14% los fines de semana</p>
              </div>

              <div class="p-5 rounded-2xl bg-[#14161a] border border-white/10 space-y-3">
                <span class="text-xs text-slate-400 uppercase font-bold">Alerta Predictiva de Compra</span>
                <p class="font-display text-3xl font-black text-rose-400">Papas Canchán</p>
                <p class="text-xs text-slate-300">Stock estimado suficiente para 1.5 días. Reabastecer mañana.</p>
              </div>

              <div class="p-5 rounded-2xl bg-[#14161a] border border-white/10 space-y-3">
                <span class="text-xs text-slate-400 uppercase font-bold">Índice de Merma / Venta</span>
                <p class="font-display text-3xl font-black text-emerald-400">1.8%</p>
                <p class="text-xs text-slate-300">Dentro del rango óptimo institucional (&lt; 2.5%).</p>
              </div>
            </div>
          }

        </main>
      }


      <!-- ================= TAB 4: REPARTO & DELIVERY (FASE 3 - PRÓXIMAMENTE) ================= -->
      @if (activeTab() === 'REPARTO') {
        <main class="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
          <div class="flex justify-between items-center">
            <div>
              <h2 class="text-2xl font-bold text-white flex items-center gap-2">
                <span>Flota de Delivery & Asignación</span>
                <span class="text-[11px] font-normal text-amber-400 px-2.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20">
                  Fase 3 - Próximamente
                </span>
              </h2>
              <p class="text-xs text-slate-400">Asignación de motorizados y seguimiento de despachos en curso.</p>
            </div>
            <div class="flex gap-2">
              <span class="px-3 py-1.5 rounded-xl bg-[#1c1f24] border border-white/10 text-xs font-mono">
                Motorizados activos: <strong class="text-polleria-gold">3</strong>
              </span>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="space-y-3 lg:col-span-1">
              <h3 class="font-bold text-sm text-slate-300 uppercase tracking-wider">Motorizados</h3>
              @for (mot of motorizados; track mot.id) {
                <div class="p-4 rounded-xl bg-[#14161a] border border-white/10 space-y-2">
                  <div class="flex justify-between items-center">
                    <span class="font-bold text-white">{{ mot.nombre }}</span>
                    <span 
                      class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      [ngClass]="mot.estado === 'DISPONIBLE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-300'"
                    >
                      {{ mot.estado }}
                    </span>
                  </div>
                  <p class="text-xs text-slate-400">Moto: {{ mot.placa }} • Tel: {{ mot.telefono }}</p>
                  <p class="text-xs text-slate-300">Entregas hoy: <strong>{{ mot.pedidosHoy }} pedidos</strong></p>
                </div>
              }
            </div>

            <div class="space-y-3 lg:col-span-2">
              <h3 class="font-bold text-sm text-slate-300 uppercase tracking-wider">Envíos en Curso</h3>
              <div class="bg-[#14161a] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
                <table class="w-full text-left text-xs">
                  <thead class="bg-black/40 border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider">
                    <tr>
                      <th class="p-4">Orden</th>
                      <th class="p-4">Cliente / Teléfono</th>
                      <th class="p-4">Dirección</th>
                      <th class="p-4">Motorizado</th>
                      <th class="p-4 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/5">
                    <tr class="hover:bg-white/5 transition">
                      <td class="p-4 font-mono font-bold text-polleria-gold">#POL-1001</td>
                      <td class="p-4 text-white">Juan Pérez (987654321)</td>
                      <td class="p-4 text-slate-300">Av. Larco 1234, Dpto 402</td>
                      <td class="p-4 text-emerald-400 font-bold">Carlos Ramos</td>
                      <td class="p-4 text-center">
                        <button (click)="notify.showSuccess('Ubicación GPS consultada')" class="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-[11px] cursor-pointer">
                          Ver Ruta
                        </button>
                      </td>
                    </tr>
                    <tr class="hover:bg-white/5 transition">
                      <td class="p-4 font-mono font-bold text-polleria-gold">#POL-1004</td>
                      <td class="p-4 text-white">Rosa Flores (988112233)</td>
                      <td class="p-4 text-slate-300">Calle Los Pinos 230, San Isidro</td>
                      <td class="p-4 text-amber-300 font-bold">Por Asignar</td>
                      <td class="p-4 text-center">
                        <button (click)="notify.showSuccess('Motorizado asignado')" class="px-3 py-1 bg-polleria-crimson text-white font-bold rounded text-[11px] cursor-pointer">
                          Asignar
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </main>
      }


      <!-- ================= TAB 5: FINANZAS & CAJA (FASE 4 - PRÓXIMAMENTE) ================= -->
      @if (activeTab() === 'FINANZAS') {
        <main class="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
          <div class="flex justify-between items-center">
            <div>
              <h2 class="text-2xl font-bold text-white flex items-center gap-2">
                <span>Finanzas, Caja Central & Transacciones</span>
                <span class="text-[11px] font-normal text-amber-400 px-2.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20">
                  Fase 4 - Próximamente
                </span>
              </h2>
              <p class="text-xs text-slate-400">Consolidación de pagos de pasarela, cobros de salón y reembolsos.</p>
            </div>
            <button 
              (click)="cerrarCajaModal()"
              class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow cursor-pointer"
            >
              📊 Arqueo y Cierre de Turno
            </button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 space-y-1">
              <span class="text-[11px] text-slate-400 uppercase font-bold">Ventas Totales Hoy</span>
              <p class="font-display text-2xl font-black text-white">S/. 5,280.50</p>
              <p class="text-[10px] text-emerald-400">42 transacciones aprobadas</p>
            </div>
            <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 space-y-1">
              <span class="text-[11px] text-slate-400 uppercase font-bold">Pasarela Online (Yape/Tarjeta)</span>
              <p class="font-display text-2xl font-black text-polleria-gold">S/. 3,120.00</p>
              <p class="text-[10px] text-slate-400">59% del volumen total</p>
            </div>
            <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 space-y-1">
              <span class="text-[11px] text-slate-400 uppercase font-bold">Caja Salón (Efectivo/POS)</span>
              <p class="font-display text-2xl font-black text-sky-400">S/. 2,160.50</p>
              <p class="text-[10px] text-slate-400">Monto físico verificado</p>
            </div>
            <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 space-y-1">
              <span class="text-[11px] text-slate-400 uppercase font-bold">Reembolsos Emitidos</span>
              <p class="font-display text-2xl font-black text-rose-400">S/. 65.00</p>
              <p class="text-[10px] text-slate-400">1 reclamo procedente</p>
            </div>
          </div>

          <div class="bg-[#14161a] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
            <div class="p-4 border-b border-white/5 font-bold text-sm text-white">
              Historial Centralizado de Transacciones
            </div>
            <table class="w-full text-left text-xs">
              <thead class="bg-black/40 border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th class="p-4">TX ID</th>
                  <th class="p-4">Orden</th>
                  <th class="p-4">Canal</th>
                  <th class="p-4">Método</th>
                  <th class="p-4">Monto</th>
                  <th class="p-4">Fecha y Hora</th>
                  <th class="p-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5">
                @for (tx of transacciones; track tx.id) {
                  <tr class="hover:bg-white/5 transition">
                    <td class="p-4 font-mono text-slate-400">{{ tx.id }}</td>
                    <td class="p-4 font-mono font-bold text-white">{{ tx.ordenCodigo }}</td>
                    <td class="p-4 text-slate-300">{{ tx.canal }}</td>
                    <td class="p-4 font-bold text-slate-200">{{ tx.metodoPago }}</td>
                    <td class="p-4 font-mono font-bold text-polleria-gold">{{ tx.monto | currencyPEN }}</td>
                    <td class="p-4 text-slate-400 font-mono">{{ tx.fechaHora }}</td>
                    <td class="p-4 text-center">
                      <span 
                        class="px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                        [ngClass]="{
                          'bg-emerald-500/20 text-emerald-400': tx.estado === 'APROBADO',
                          'bg-rose-500/20 text-rose-400': tx.estado === 'RECHAZADO' || tx.estado === 'REEMBOLSADO',
                          'bg-amber-500/20 text-amber-300': tx.estado === 'PENDIENTE'
                        }"
                      >
                        {{ tx.estado }}
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

        </main>
      }


      <!-- ================= TAB 6: FEEDBACK & RECLAMOS (FASE 3 - PRÓXIMAMENTE) ================= -->
      @if (activeTab() === 'FEEDBACK') {
        <main class="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
          <div class="flex justify-between items-center">
            <div>
              <h2 class="text-2xl font-bold text-white flex items-center gap-2">
                <span>Feedback, Reseñas & Reclamos</span>
                <span class="text-[11px] font-normal text-amber-400 px-2.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20">
                  Fase 3 - Próximamente
                </span>
              </h2>
              <p class="text-xs text-slate-400">Calificaciones de clientes, atención de reportes y emisión de reembolsos.</p>
            </div>
            <div class="flex items-center gap-2 bg-[#1c1f24] px-4 py-2 rounded-xl border border-white/10">
              <span class="text-polleria-gold text-lg">★★★★★</span>
              <span class="font-bold text-white">4.9 / 5.0</span>
              <span class="text-xs text-slate-400">(148 valoraciones)</span>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            @for (item of feedbackList; track item.id) {
              <div class="p-5 rounded-2xl bg-[#14161a] border border-white/10 space-y-3 flex flex-col justify-between">
                <div>
                  <div class="flex justify-between items-start">
                    <div>
                      <h4 class="font-bold text-white">{{ item.cliente }}</h4>
                      <p class="text-xs text-slate-400">{{ item.ordenCodigo }} • {{ item.fecha }}</p>
                    </div>
                    <span 
                      class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      [ngClass]="item.tipo === 'RECLAMO' ? 'bg-rose-500/20 text-rose-400' : 'bg-polleria-gold/20 text-polleria-gold'"
                    >
                      {{ item.tipo }}
                    </span>
                  </div>

                  @if (item.estrellas) {
                    <div class="text-polleria-gold text-sm my-1">
                      {{ '★'.repeat(item.estrellas) }}{{ '☆'.repeat(5 - item.estrellas) }}
                    </div>
                  }

                  <p class="text-xs text-slate-300 leading-relaxed mt-2 italic">
                    "{{ item.mensaje }}"
                  </p>
                </div>

                @if (item.tipo === 'RECLAMO') {
                  <div class="pt-3 border-t border-white/10 flex justify-between items-center">
                    <span class="text-[10px] font-mono text-amber-300">Estado: {{ item.estado }}</span>
                    <button 
                      (click)="resolverReclamo(item)"
                      class="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg transition cursor-pointer"
                    >
                      Gestionar Reembolso
                    </button>
                  </div>
                }
              </div>
            }
          </div>
        </main>
      }


      <!-- ================= TAB 7: NOTIFICACIONES & WHATSAPP (FASE 2/3 - PRÓXIMAMENTE) ================= -->
      @if (activeTab() === 'NOTIFICACIONES') {
        <main class="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
          
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#14161a] p-4 rounded-2xl border border-white/10 shadow-lg">
            <div>
              <h2 class="text-2xl font-bold text-white flex items-center gap-2">
                <span>Monitor de Notificaciones & WhatsApp</span>
                <span class="text-[11px] font-normal text-amber-400 px-2.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20">
                  Fase 2/3 - Próximamente
                </span>
              </h2>
              <p class="text-xs text-slate-400">Cola de mensajes con control de espera de 10s (RNF10) y push WebSocket a mozos.</p>
            </div>

            <button 
              (click)="notify.showSuccess('Mensaje de prueba enviado por WhatsApp')"
              class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Probar Envío WhatsApp
            </button>
          </div>

          <div class="bg-[#14161a] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
            <table class="w-full text-left text-xs">
              <thead class="bg-black/40 border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th class="p-4">Destinatario</th>
                  <th class="p-4">Canal</th>
                  <th class="p-4">Plantilla</th>
                  <th class="p-4">Latencia</th>
                  <th class="p-4">Fecha y Hora</th>
                  <th class="p-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5">
                @for (log of notificaciones; track log.id) {
                  <tr class="hover:bg-white/5 transition">
                    <td class="p-4 font-bold text-white">
                      {{ log.destinatario }} <span class="text-slate-500 font-mono text-[11px]">({{ log.telefono }})</span>
                    </td>
                    <td class="p-4 text-slate-300 font-mono">{{ log.canal }}</td>
                    <td class="p-4 text-slate-300">{{ log.plantilla }}</td>
                    <td class="p-4 font-mono text-emerald-400">{{ log.latenciaMs }} ms</td>
                    <td class="p-4 text-slate-400 font-mono">{{ log.fechaHora }}</td>
                    <td class="p-4 text-center">
                      <span 
                        class="px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                        [ngClass]="log.estado === 'ENVIADO' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-300'"
                      >
                        {{ log.estado }}
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

        </main>
      }


      <!-- ================= TAB 8: SOPORTE & INCIDENTES (FASE 4 - PRÓXIMAMENTE) ================= -->
      @if (activeTab() === 'SOPORTE') {
        <main class="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
          
          <div class="flex justify-between items-center">
            <div>
              <h2 class="text-2xl font-bold text-white flex items-center gap-2">
                <span>Centro de Soporte & Bitácora de Incidentes</span>
                <span class="text-[11px] font-normal text-amber-400 px-2.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20">
                  Fase 4 - Próximamente
                </span>
              </h2>
              <p class="text-xs text-slate-400">Documentación de fallas operativas, causa raíz y soluciones aplicadas.</p>
            </div>
            <button 
              (click)="registrarIncidenteModal()"
              class="px-4 py-2 bg-polleria-crimson hover:bg-polleria-crimsonHover text-white font-bold text-xs rounded-xl transition shadow cursor-pointer"
            >
              + Documentar Incidente
            </button>
          </div>

          <div class="space-y-4">
            @for (inc of incidentes; track inc.id) {
              <div class="p-5 rounded-2xl bg-[#14161a] border border-white/10 space-y-3 shadow-lg">
                <div class="flex justify-between items-start">
                  <div class="flex items-center gap-3">
                    <span class="font-mono text-xs px-2 py-0.5 rounded bg-white/10 text-polleria-gold font-bold">
                      {{ inc.id }}
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
                <span class="text-polleria-gold font-bold">{{ order.metodoPago }}</span>
              </div>
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
              } @else if (order.estado === 'EN_PREPARACION' || order.estado === 'LISTO_COCINA') {
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


      <!-- ================= MODAL: NUEVA ORDEN MANUAL ================= -->
      @if (showCreateOrderModal) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div class="w-full max-w-lg bg-slate-900 border border-polleria-gold/40 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100 animate-scale-up">
            
            <div class="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 class="font-display text-xl font-bold text-white">Registrar Nueva Orden Manual</h3>
              <button (click)="showCreateOrderModal = false" class="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>

            <div class="space-y-3 text-xs">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-400 mb-1">Tipo de Pedido:</label>
                  <select 
                    [(ngModel)]="manualOrder.tipo"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
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

              @if (manualOrder.tipo === 'DELIVERY') {
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

              <div>
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
                Crear Pedido
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
              <button (click)="showCreateProductModal = false" class="text-slate-400 hover:text-white cursor-pointer">✕</button>
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

      </div> <!-- Cierre Main Content Wrapper -->
    </div> <!-- Cierre Root Container -->
  `
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  readonly ordersService = inject(OrdersService);
  readonly productsService = inject(ProductsService);
  readonly authService = inject(AuthService);
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
    tipo: 'DELIVERY' as OrderType,
    metodoPago: 'EFECTIVO_CONTRAENTREGA' as PaymentMethod,
    clienteNombre: '',
    clienteCelular: '',
    direccion: '',
    selectedProductId: '1',
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

  // Mesas Data (RF11, RF12, RF33 - Fase 2)
  readonly selectedMesa = signal<TableSalon | null>(null);
  mesas: TableSalon[] = [
    { id: 1, nombre: 'Mesa 01', zona: 'SALON_PRINCIPAL', capacidad: 4, estado: 'OCUPADA', mozo: 'Yovana M.', comensales: 3, tiempoMinutos: 35, totalConsumo: 89.00 },
    { id: 2, nombre: 'Mesa 02', zona: 'SALON_PRINCIPAL', capacidad: 4, estado: 'LIBRE', totalConsumo: 0 },
    { id: 3, nombre: 'Mesa 03', zona: 'SALON_PRINCIPAL', capacidad: 6, estado: 'OCUPADA', mozo: 'Yovana M.', comensales: 5, tiempoMinutos: 42, totalConsumo: 154.00, platosListos: true },
    { id: 4, nombre: 'Mesa 04', zona: 'SALON_PRINCIPAL', capacidad: 4, estado: 'POR_COBRAR', mozo: 'Mozo Salon', comensales: 2, tiempoMinutos: 55, totalConsumo: 65.00 },
    { id: 5, nombre: 'Mesa 05', zona: 'SALON_PRINCIPAL', capacidad: 2, estado: 'LIBRE', totalConsumo: 0 },
    { id: 6, nombre: 'Mesa 06', zona: 'SALON_PRINCIPAL', capacidad: 4, estado: 'LIBRE', totalConsumo: 0 },
    { id: 7, nombre: 'Mesa 07', zona: 'TERRAZA', capacidad: 4, estado: 'RESERVADA', totalConsumo: 0 },
    { id: 8, nombre: 'Mesa 08', zona: 'TERRAZA', capacidad: 4, estado: 'LIBRE', totalConsumo: 0 },
    { id: 9, nombre: 'Mesa 09', zona: 'TERRAZA', capacidad: 6, estado: 'OCUPADA', mozo: 'Yovana M.', comensales: 4, tiempoMinutos: 18, totalConsumo: 95.00 },
    { id: 10, nombre: 'Mesa 10 (VIP)', zona: 'ZONA_VIP', capacidad: 8, estado: 'OCUPADA', mozo: 'Mozo Salon', comensales: 7, tiempoMinutos: 50, totalConsumo: 240.00 },
    { id: 11, nombre: 'Mesa 11 (VIP)', zona: 'ZONA_VIP', capacidad: 8, estado: 'LIBRE', totalConsumo: 0 },
    { id: 12, nombre: 'Mesa 12', zona: 'SALON_PRINCIPAL', capacidad: 4, estado: 'LIBRE', totalConsumo: 0 },
  ];

  // Insumos Data (RF23, RF25 - Fase 4)
  insumos: InsumoAlmacen[] = [
    { id: 'INS-01', nombre: 'Pollo Entero Fresco (Granja)', categoria: 'CARNES', stockActual: 120, stockMinimo: 40, unidadMedida: 'unid', costoUnitario: 18.50, estado: 'OPTIMO' },
    { id: 'INS-02', nombre: 'Papas Canchán Seleccionadas', categoria: 'VERDURAS', stockActual: 45, stockMinimo: 50, unidadMedida: 'kg', costoUnitario: 3.20, estado: 'CRITICO' },
    { id: 'INS-03', nombre: 'Carbón Vegetal de Algarrobo', categoria: 'INSUMOS_FUEGO', stockActual: 18, stockMinimo: 10, unidadMedida: 'sacos', costoUnitario: 45.00, estado: 'OPTIMO' },
    { id: 'INS-04', nombre: 'Aceite Vegetal Granel', categoria: 'ABARROTES', stockActual: 60, stockMinimo: 30, unidadMedida: 'litros', costoUnitario: 7.80, estado: 'OPTIMO' },
    { id: 'INS-05', nombre: 'Aderezo Tradicional San Pollo', categoria: 'ABARROTES', stockActual: 15, stockMinimo: 20, unidadMedida: 'kg', costoUnitario: 12.00, estado: 'BAJO' },
    { id: 'INS-06', nombre: 'Maíz Morado para Chicha', categoria: 'BEBIDAS', stockActual: 30, stockMinimo: 15, unidadMedida: 'kg', costoUnitario: 5.50, estado: 'OPTIMO' }
  ];

  // Mermas Data (RF24 - Fase 4)
  mermas: RegistroMerma[] = [
    { id: 'MR-01', fecha: '2026-08-23', insumo: 'Papas fritas excedente', cantidad: 3.5, unidad: 'kg', motivo: 'COCCION_EXCESIVA', costoPerdida: 18.20, responsable: 'Jefe de Cocina' },
    { id: 'MR-02', fecha: '2026-08-22', insumo: 'Ensalada fresca preparada', cantidad: 2.0, unidad: 'kg', motivo: 'VENCIMIENTO', costoPerdida: 12.00, responsable: 'Jefe de Cocina' },
    { id: 'MR-03', fecha: '2026-08-21', insumo: '1/4 Pollo dorado de exhibición', cantidad: 2, unidad: 'unid', motivo: 'DESCARTE_MANIPULACION', costoPerdida: 24.00, responsable: 'Jefe de Cocina' }
  ];

  // Motorizados Data (RF18 - Fase 3)
  motorizados: MotorizadoDelivery[] = [
    { id: 'MOT-01', nombre: 'Carlos Ramos', telefono: '987000013', placa: '4321-7B', pedidosHoy: 8, estado: 'EN_RUTA', pedidoActual: 'POL-1001' },
    { id: 'MOT-02', nombre: 'Mitrufely Dev', telefono: '987000014', placa: '9812-4A', pedidosHoy: 6, estado: 'DISPONIBLE' },
    { id: 'MOT-03', nombre: 'Jorge Silva', telefono: '987000015', placa: '1122-3C', pedidosHoy: 9, estado: 'DISPONIBLE' }
  ];

  // Finanzas Data (RF19, RF20, RF21, RF22, RF29 - Fase 4)
  transacciones: TransaccionFinanzas[] = [
    { id: 'TXN-56714E92', ordenCodigo: 'POL-1001', canal: 'DELIVERY', metodoPago: 'VISA', monto: 130.00, estado: 'APROBADO', fechaHora: '2026-08-23 17:43', referencia: 'AUTH-992384' },
    { id: 'TXN-99120A11', ordenCodigo: 'POL-1002', canal: 'SALON', metodoPago: 'YAPE', monto: 89.00, estado: 'APROBADO', fechaHora: '2026-08-23 17:15', referencia: 'YAPE-7721' },
    { id: 'TXN-33418B88', ordenCodigo: 'POL-1003', canal: 'SALON', metodoPago: 'EFECTIVO', monto: 65.00, estado: 'APROBADO', fechaHora: '2026-08-23 16:50', referencia: 'CAJA-SALON-01' },
    { id: 'TXN-12004F44', ordenCodigo: 'POL-0998', canal: 'DELIVERY', metodoPago: 'VISA', monto: 65.00, estado: 'REEMBOLSADO', fechaHora: '2026-08-23 15:30', referencia: 'REFUND-001' }
  ];

  // Feedback Data (RF26, RF27, RF28, RF29 - Fase 3)
  feedbackList: ReporteFeedback[] = [
    { id: 'FB-01', cliente: 'Mariana Costa', telefono: '987112233', ordenCodigo: 'POL-1001', tipo: 'RESEÑA', estrellas: 5, mensaje: '¡El pollo estaba súper jugoso y la chicha morada deliciosa! Llegó en 25 minutos exactos.', estado: 'RESUELTO', fecha: '2026-08-23' },
    { id: 'FB-02', cliente: 'Pedro Castillo', telefono: '987445566', ordenCodigo: 'POL-0995', tipo: 'RESEÑA', estrellas: 5, mensaje: 'Excelente atención en salón por la moza Yovana, muy amable.', estado: 'RESUELTO', fecha: '2026-08-23' },
    { id: 'FB-03', cliente: 'Carla Benítez', telefono: '987778899', ordenCodigo: 'POL-0998', tipo: 'RECLAMO', mensaje: 'Faltaron las cremas extras que solicité en la nota de mi pedido delivery.', estado: 'EN_REVISION', fecha: '2026-08-23' }
  ];

  // Notificaciones Logs (RF30, RF31, RF32, RF33 - Fase 2/3)
  notificaciones: NotificacionLog[] = [
    { id: 'NOTIF-01', destinatario: 'Juan Pérez', telefono: '987654321', canal: 'WHATSAPP', plantilla: 'Confirmación de Pago Aprobado', estado: 'ENVIADO', latenciaMs: 140, fechaHora: '17:43:52' },
    { id: 'NOTIF-02', destinatario: 'Carlos Ramos (Moto)', telefono: '987000013', canal: 'WHATSAPP', plantilla: 'Nuevo Delivery Asignado #POL-1001', estado: 'ENVIADO', latenciaMs: 165, fechaHora: '17:44:05' },
    { id: 'NOTIF-03', destinatario: 'Mozo Salón (Mesa 03)', telefono: '987000003', canal: 'WEBSOCKET_MOZO', plantilla: 'Plato Listo en Cocina: 1x Pollo Entero', estado: 'ENVIADO', latenciaMs: 18, fechaHora: '17:45:10' }
  ];

  // Incidentes Data (RF34 - Fase 4)
  incidentes: IncidenteSoporte[] = [
    {
      id: 'INC-01',
      titulo: 'Retraso de 2 minutos en confirmación de webhook Yape',
      modulo: 'PAGOS',
      severidad: 'MEDIA',
      estado: 'RESUELTO',
      causaRaiz: 'Intermitencia externa de la pasarela bancaria durante hora pico.',
      solucionAplicada: 'Se activó el reintento automático exponencial y se aprobó la orden.',
      reportadoPor: 'Admin General',
      fechaHora: '2026-08-23 15:45'
    },
    {
      id: 'INC-02',
      titulo: 'Termostato secundario de horno a leña descalibrado',
      modulo: 'COCINA_HORNO',
      severidad: 'BAJA',
      estado: 'RESUELTO',
      causaRaiz: 'Acumulación de ceniza en el sensor perimetral.',
      solucionAplicada: 'Limpieza y calibración por el Jefe de Cocina.',
      reportadoPor: 'Jefe de Cocina',
      fechaHora: '2026-08-23 13:10'
    }
  ];

  ngOnInit(): void {
    this.ordersService.loadActiveOrders();
    this.productsService.loadProducts();

    // Polling cada 2.5 seg para mantener actualizado el dashboard en tiempo real
    if (isPlatformBrowser(this.platformId)) {
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

  advanceAfterReady(order: Order): void {
    if (order.tipo === 'DELIVERY') {
      this.advanceOrderStatus(order, 'EN_REPARTO');
    } else {
      this.advanceOrderStatus(order, 'COMPLETADO');
    }
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
      tipo: 'DELIVERY',
      metodoPago: 'EFECTIVO_CONTRAENTREGA',
      clienteNombre: '',
      clienteCelular: '',
      direccion: '',
      selectedProductId: prods.length > 0 ? prods[0].id : '1',
      notas: ''
    };
    this.showCreateOrderModal = true;
  }

  crearOrdenManual(): void {
    if (!this.manualOrder.clienteNombre || !this.manualOrder.clienteCelular) {
      this.notify.showError('Por favor ingresa nombre y celular del cliente');
      return;
    }

    const prod = this.productsService.products().find(p => p.id === this.manualOrder.selectedProductId);
    if (!prod) {
      this.notify.showError('Selecciona un producto válido');
      return;
    }

    this.ordersService.createOrder({
      tipo: this.manualOrder.tipo,
      metodoPago: this.manualOrder.metodoPago,
      cliente: {
        nombre: this.manualOrder.clienteNombre,
        celular: this.manualOrder.clienteCelular,
        correo: 'orden.manual@sanpollo.pe',
        direccion: this.manualOrder.direccion || 'Presencial / Salón'
      },
      items: [
        {
          productoId: prod.id,
          cantidad: 1,
          notas: this.manualOrder.notas
        }
      ]
    }).subscribe({
      next: (created) => {
        this.notify.showSuccess(`Orden #${this.getCodeNum(created.codigoSeguimiento)} creada con éxito`);
        this.showCreateOrderModal = false;
      },
      error: () => {
        this.notify.showError('Error al crear orden en el backend');
      }
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

  getFreeTablesCount(): number {
    return this.mesas.filter(m => m.estado === 'LIBRE').length;
  }

  getOccupiedTablesCount(): number {
    return this.mesas.filter(m => m.estado === 'OCUPADA').length;
  }

  toggleEstadoMesa(m: TableSalon): void {
    if (m.estado === 'LIBRE') {
      m.estado = 'OCUPADA';
      m.tiempoMinutos = 1;
      m.totalConsumo = 65.00;
      m.mozo = 'Yovana M.';
      this.notify.showSuccess(`${m.nombre} marcada como OCUPADA`);
    } else {
      m.estado = 'LIBRE';
      m.tiempoMinutos = 0;
      m.totalConsumo = 0;
      m.mozo = undefined;
      m.platosListos = false;
      this.notify.showInfo(`${m.nombre} liberada`);
    }
  }

  solicitarDespachoModal(): void {
    this.notify.showSuccess('Despacho de lote solicitado al Almacén', 'Se enviará notificación al Chef.');
  }

  registrarMermaModal(): void {
    this.notify.showSuccess('Formulario de merma abierto', 'Registrando merma de cierre de jornada.');
  }

  cerrarCajaModal(): void {
    this.notify.showSuccess('Arqueo de caja completado', 'Balance cuadrado: S/. 5,280.50.');
  }

  resolverReclamo(item: ReporteFeedback): void {
    item.estado = 'RESUELTO';
    this.notify.showSuccess(`Reembolso emitido para ${item.cliente}`, 'Transacción reembolsada por S/. 65.00.');
  }

  registrarIncidenteModal(): void {
    this.notify.showInfo('Bitácora de Incidentes', 'Ingrese causa raíz y solución aplicada para registrar en auditoría.');
  }

  cerrarSesion(): void {
    this.authService.logout();
    this.notify.showInfo('Sesión finalizada', 'Has salido del panel administrativo.');
    this.router.navigate(['/login']);
  }
}
