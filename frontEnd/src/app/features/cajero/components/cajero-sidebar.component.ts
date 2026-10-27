import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { CajeroTab } from '../models/cajero.models';

@Component({
  selector: 'app-cajero-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, CurrencyPENPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
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
                  Fondo: {{ fondoApertura() | currencyPEN }}
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
            (click)="tabChange.emit('POS')"
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
              {{ totalPorCobrar() }}
            </span>
          </button>

          <button 
            type="button"
            (click)="tabChange.emit('CAPTURAS_PAGO')"
            class="w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold transition cursor-pointer"
            [ngClass]="activeTab() === 'CAPTURAS_PAGO' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-sky-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
              </svg>
              <span>Capturas Yape / Plin</span>
            </div>
            <span class="px-2 py-0.5 rounded-full font-bold text-xs" [ngClass]="totalCapturas() > 0 ? 'bg-sky-500 text-slate-950 animate-pulse' : 'bg-slate-800 text-slate-400'">
              {{ totalCapturas() }}
            </span>
          </button>

          <button 
            type="button"
            (click)="tabChange.emit('LLAMADAS_CONTRAPAGO')"
            class="w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold transition cursor-pointer"
            [ngClass]="activeTab() === 'LLAMADAS_CONTRAPAGO' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
              </svg>
              <span>Llamadas ContraPago</span>
            </div>
            <span class="px-2 py-0.5 rounded-full font-bold text-xs" [ngClass]="totalLlamadas() > 0 ? 'bg-amber-500 text-slate-950 animate-pulse' : 'bg-slate-800 text-slate-400'">
              {{ totalLlamadas() }}
            </span>
          </button>

          <button 
            type="button"
            (click)="tabChange.emit('RECOJO_TIENDA')"
            class="w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold transition cursor-pointer"
            [ngClass]="activeTab() === 'RECOJO_TIENDA' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
              </svg>
              <span>Recojo en Tienda</span>
            </div>
            <span class="px-2 py-0.5 rounded-full font-bold text-xs" [ngClass]="totalRecojo() > 0 ? 'bg-emerald-500 text-slate-950 animate-pulse' : 'bg-slate-800 text-slate-400'">
              {{ totalRecojo() }}
            </span>
          </button>

          <button 
            type="button"
            (click)="tabChange.emit('LIQUIDACIONES')"
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
              {{ totalLiquidaciones() }}
            </span>
          </button>

          <button 
            type="button"
            (click)="tabChange.emit('MERMAS_FANTASMA')"
            class="w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold transition cursor-pointer"
            [ngClass]="activeTab() === 'MERMAS_FANTASMA' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              <span>Mermas / Pedidos Fantasma</span>
            </div>
            <span class="px-2 py-0.5 rounded-full font-bold text-xs" [ngClass]="totalFantasma() > 0 ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-400'">
              {{ totalFantasma() }}
            </span>
          </button>

          <button 
            type="button"
            (click)="tabChange.emit('ARQUEO')"
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
            (click)="tabChange.emit('HISTORIAL')"
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
              {{ totalCobros() }}
            </span>
          </button>
        </nav>

        <!-- Sidebar Footer con Usuario & Salir -->
        <div class="p-4 border-t border-white/10 bg-black/20 shrink-0">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-xs">
              {{ (usuarioNombre()?.substring(0, 2) || 'CJ') | uppercase }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-bold text-white truncate">
                {{ usuarioNombre() || 'Cajero San Pollo' }}
              </p>
              <p class="text-[10px] text-emerald-400 font-medium uppercase tracking-wider">
                Rol: Cajero de Turno
              </p>
            </div>
          </div>
          <button 
            type="button"
            (click)="logout.emit()"
            class="w-full py-2 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>
  `
})
export class CajeroSidebarComponent {
  readonly activeTab = input.required<CajeroTab>();
  readonly cajaAbierta = input.required<boolean>();
  readonly fondoApertura = input<number>(0);
  readonly totalPorCobrar = input<number>(0);
  readonly totalLlamadas = input<number>(0);
  readonly totalCapturas = input<number>(0);
  readonly totalRecojo = input<number>(0);
  readonly totalLiquidaciones = input<number>(0);
  readonly totalFantasma = input<number>(0);
  readonly totalCobros = input<number>(0);
  readonly usuarioNombre = input<string | undefined>(undefined);

  readonly tabChange = output<CajeroTab>();
  readonly logout = output<void>();
}
