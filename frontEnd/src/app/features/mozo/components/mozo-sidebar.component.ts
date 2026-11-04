import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MesaSalon, MozoTab } from '../mozo.types';

@Component({
  selector: 'app-mozo-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'w-full md:w-64 bg-[#14161a] border-r border-white/10 flex flex-col shrink-0 md:sticky md:top-0 md:h-screen z-40' },
  template: `
        
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
            (click)="tabChange.emit('MESAS')"
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
              {{ mesasCount() }}
            </span>
          </button>

          <button 
            type="button"
            (click)="tabChange.emit('TOMAR_COMANDA')"
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
            (click)="tabChange.emit('ALERTAS_COCINA')"
            class="w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold transition cursor-pointer"
            [ngClass]="activeTab() === 'ALERTAS_COCINA' ? 'bg-polleria-gold/15 text-polleria-gold border border-polleria-gold/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
              </svg>
              <span>Platos Listos</span>
            </div>
            @if (alertasCount() > 0) {
              <span class="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center animate-bounce">
                {{ alertasCount() }}
              </span>
            }
          </button>

          <div class="pt-3 pb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 px-3">
            Caja & Turno
          </div>

          <button 
            type="button"
            (click)="tabChange.emit('HISTORIAL_TURNO')"
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
                <span>{{ (userName()?.substring(0, 2) || 'MZ') | uppercase }}</span>
              </div>
              <div class="flex flex-col text-left leading-tight min-w-0">
                <span class="text-xs font-bold text-white truncate">
                  {{ userName() || 'Mozo Salón' }}
                </span>
                <span class="text-[10px] font-mono text-polleria-gold font-bold">
                  MOZO / SALÓN
                </span>
              </div>
            </div>
            <button 
              type="button"
              (click)="logout.emit()"
              class="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/20 transition cursor-pointer shrink-0"
              title="Cerrar Sesión"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
            </button>
          </div>
        </div>

  `
})
export class MozoSidebarComponent {
  readonly activeTab = input.required<MozoTab>();
  readonly mesasCount = input.required<number>();
  readonly alertasCount = input.required<number>();
  readonly userName = input<string | null | undefined>();

  readonly tabChange = output<MozoTab>();
  readonly logout = output<void>();
}
