import { Component, OnDestroy, OnInit, PLATFORM_ID, computed, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { Subscription, filter, interval, map } from 'rxjs';
import { OrdersService } from '../../../core/services/orders.service';
import { ProductsService } from '../../../core/services/products.service';
import { AuthService } from '../../../core/services/auth.service';
import { SalonService } from '../../../core/services/salon.service';
import { PaymentService } from '../../../core/services/payment.service';
import { NotificationService } from '../../../core/services/notification.service';
import { MesaSalon } from '../../../core/models/table.model';
import { Insumo } from '../../../core/models/inventory.model';
import { AdminShellStore } from '../state/admin-shell.store';
import { AdminOrderModalsComponent } from '../pages/shared/admin-order-modals.component';

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

/** Segmento de ruta (`/admin/<segmento>`) de cada pestaña. */
const TAB_BY_SEGMENT: Record<string, DashboardTab> = {
  ordenes: 'ORDENES',
  mesas: 'MESAS',
  inventario: 'INVENTARIO',
  reparto: 'REPARTO',
  finanzas: 'FINANZAS',
  feedback: 'FEEDBACK',
  notificaciones: 'NOTIFICACIONES',
  soporte: 'SOPORTE'
};

/**
 * Shell del panel admin: sidebar, barra superior y `<router-outlet>`. Cada pestaña es una ruta hija
 * lazy con su propio contenedor (ver `admin.routes.ts`); aquí solo vive lo común a todas:
 * carga y sondeo de órdenes/pagos y los modales de despacho y orden manual compartidos.
 */
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, AdminOrderModalsComponent],
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
            routerLink="ordenes"
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
            routerLink="mesas"
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
            routerLink="inventario"
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
            routerLink="reparto"
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
            routerLink="finanzas"
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
            routerLink="feedback"
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
            routerLink="notificaciones"
            class="w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold transition cursor-pointer"
            [ngClass]="activeTab() === 'NOTIFICACIONES' ? 'bg-polleria-gold/15 text-polleria-gold border border-polleria-gold/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-polleria-gold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
              </svg>
              <span>WhatsApp</span>
            </div>
            @if (store.comprobantesWhatsappPendientes().length > 0) {
              <span class="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] animate-pulse">
                {{ store.comprobantesWhatsappPendientes().length }}
              </span>
            }
          </button>

          <button 
            type="button"
            routerLink="soporte"
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
              routerLink="inventario" (click)="store.inventarioSubTab.set('CARTA')"
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

      <!-- Contenido de la pestaña activa (ruta hija lazy) -->
      <router-outlet />

      <!-- Modales compartidos entre pestañas -->
      <app-admin-order-modals />

      </div> <!-- Cierre Main Content Wrapper -->
    </div> <!-- Cierre Root Container -->
  `
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  readonly ordersService = inject(OrdersService);
  readonly productsService = inject(ProductsService);
  readonly authService = inject(AuthService);
  readonly salonService = inject(SalonService);
  readonly paymentService = inject(PaymentService);
  readonly notify = inject(NotificationService);
  readonly router = inject(Router);
  readonly store = inject(AdminShellStore);
  private platformId = inject(PLATFORM_ID);

  private pollingSub?: Subscription;

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  /** Pestaña activa, derivada de la ruta hija (ORDENES si la URL no coincide con ninguna). */
  readonly activeTab = computed<DashboardTab>(() => {
    const segments = this.currentUrl().split(/[?#]/)[0].split('/').filter(Boolean);
    for (let i = segments.length - 1; i >= 0; i--) {
      const tab = TAB_BY_SEGMENT[segments[i]];
      if (tab) return tab;
    }
    return 'ORDENES';
  });

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

  ngOnInit(): void {
    // Datos compartidos por varias pestañas (sidebar, modal de orden manual, despacho).
    this.ordersService.loadActiveOrders();
    this.paymentService.cargarPagos().subscribe();
    this.productsService.loadProducts();
    this.salonService.cargarMesas();

    // Polling cada 2.5 seg para mantener actualizado el dashboard en tiempo real
    if (isPlatformBrowser(this.platformId)) {
      this.pollingSub = interval(2500).subscribe(() => {
        // Pestaña oculta: no se consulta el backend hasta que el usuario vuelva.
        if (typeof document !== 'undefined' && document.hidden) return;
        this.ordersService.loadActiveOrders();
        this.paymentService.cargarPagos().subscribe();
      });
    }
  }

  ngOnDestroy(): void {
    if (this.pollingSub) {
      this.pollingSub.unsubscribe();
    }
  }

  cerrarSesion(): void {
    this.authService.logout();
    this.notify.showInfo('Sesión finalizada', 'Has salido del panel administrativo.');
    this.router.navigate(['/login']);
  }
}
