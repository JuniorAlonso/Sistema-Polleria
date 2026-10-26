import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { KitchenTab } from '../kitchen.types';

@Component({
  selector: 'app-kitchen-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
        <header class="h-16 bg-[#14161a]/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-md">

          <div class="flex items-center gap-2.5">
            <h1 class="text-base sm:text-lg font-extrabold text-white tracking-wide uppercase">
              {{ label() }}
            </h1>
          </div>

          <div class="flex items-center gap-3">
            <div class="hidden sm:flex items-center gap-3 text-xs">
              <span class="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                <svg class="w-3.5 h-3.5 inline mr-1 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>En Preparación: {{ preparingCount() }}
              </span>
              <span class="px-3 py-1 rounded-xl bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                <svg class="w-3.5 h-3.5 inline mr-1 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>Listos para Reparto: {{ readyCount() }}
              </span>
            </div>

            @if (activeTab() === 'DESPACHO_INSUMOS') {
              <button
                (click)="solicitarLote.emit()"
                class="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow"
              >
                <span>+ Solicitar Lote</span>
              </button>
            } @else if (activeTab() === 'MERMAS') {
              <button
                (click)="registrarMerma.emit()"
                class="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow"
              >
                <span>+ Registrar Merma</span>
              </button>
            }
          </div>

        </header>
  `
})
export class KitchenHeaderComponent {
  readonly label = input.required<string>();
  readonly activeTab = input.required<KitchenTab>();
  readonly preparingCount = input.required<number>();
  readonly readyCount = input.required<number>();
  readonly solicitarLote = output<void>();
  readonly registrarMerma = output<void>();
}
