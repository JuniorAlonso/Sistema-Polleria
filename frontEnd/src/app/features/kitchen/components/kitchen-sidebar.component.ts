import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { KitchenTab } from '../kitchen.types';

@Component({
  selector: 'app-kitchen-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule],
  template: `
      <aside class="w-full md:w-64 bg-[#14161a] border-r border-white/10 flex flex-col shrink-0 md:sticky md:top-0 md:h-screen z-40">

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

        <nav class="flex-1 p-3.5 space-y-1 overflow-y-auto no-scrollbar">
          <div class="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 px-3 py-1.5">
            Producción & KDS
          </div>

          <button
            type="button"
            (click)="tabChange.emit('KDS')"
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
            (click)="tabChange.emit('DESPACHO_INSUMOS')"
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
            (click)="tabChange.emit('MERMAS')"
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

        <div class="p-3 border-t border-white/10 bg-[#101215] shrink-0">
          <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/5">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-8 h-8 rounded-full ring-2 ring-amber-400 overflow-hidden bg-slate-800 flex items-center justify-center text-xs font-black text-amber-400 shrink-0 shadow">
                <span>{{ (userName()?.substring(0, 2) || 'CH') | uppercase }}</span>
              </div>
              <div class="flex flex-col text-left leading-tight min-w-0">
                <span class="text-xs font-bold text-white truncate">
                  {{ userName() || 'Chef Cocina' }}
                </span>
                <span class="text-[10px] font-mono text-amber-400 font-bold">
                  COCINA / HORNO
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

      </aside>
  `
})
export class KitchenSidebarComponent {
  readonly activeTab = input.required<KitchenTab>();
  readonly kitchenOrdersCount = input.required<number>();
  readonly userName = input<string | undefined>(undefined);
  readonly tabChange = output<KitchenTab>();
  readonly logout = output<void>();
}
