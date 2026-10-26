import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KdsFilter } from '../kitchen.types';

@Component({
  selector: 'app-kitchen-filter-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#14161a] p-3.5 rounded-2xl border border-white/10 shadow">
              <div class="flex items-center gap-1.5 text-xs bg-black/40 p-1 rounded-xl border border-white/5">
                <button
                  type="button"
                  (click)="filterChange.emit('TODAS')"
                  class="px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5"
                  [ngClass]="filter() === 'TODAS' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'"
                >
                  <span>Todas</span>
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" [ngClass]="filter() === 'TODAS' ? 'bg-black/20 text-slate-950' : 'bg-white/10 text-slate-300'">{{ totalCount() }}</span>
                </button>

                <button
                  type="button"
                  (click)="filterChange.emit('POR_PREPARAR')"
                  class="px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5"
                  [ngClass]="filter() === 'POR_PREPARAR' ? 'bg-rose-500 text-white shadow' : 'text-slate-400 hover:text-white'"
                >
                  <span>Por Preparar</span>
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" [ngClass]="filter() === 'POR_PREPARAR' ? 'bg-black/30 text-white' : 'bg-white/10 text-slate-300'">{{ pendingCount() }}</span>
                </button>

                <button
                  type="button"
                  (click)="filterChange.emit('EN_PREPARACION')"
                  class="px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5"
                  [ngClass]="filter() === 'EN_PREPARACION' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'"
                >
                  <span>En Horno / Fritura</span>
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" [ngClass]="filter() === 'EN_PREPARACION' ? 'bg-black/30 text-slate-950' : 'bg-white/10 text-slate-300'">{{ preparingCount() }}</span>
                </button>

                <button
                  type="button"
                  (click)="filterChange.emit('LISTOS')"
                  class="px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5"
                  [ngClass]="filter() === 'LISTOS' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'"
                >
                  <span>Listos en Empaque</span>
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" [ngClass]="filter() === 'LISTOS' ? 'bg-black/30 text-white' : 'bg-white/10 text-slate-300'">{{ readyCount() }}</span>
                </button>
              </div>

              <div class="text-xs text-slate-400 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Actualizado en tiempo real</span>
              </div>
            </div>
  `
})
export class KitchenFilterBarComponent {
  readonly filter = input.required<KdsFilter>();
  readonly totalCount = input.required<number>();
  readonly pendingCount = input.required<number>();
  readonly preparingCount = input.required<number>();
  readonly readyCount = input.required<number>();
  readonly filterChange = output<KdsFilter>();
}
