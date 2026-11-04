import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DeliverySubFilter } from './delivery.types';

@Component({
  selector: 'app-delivery-filters',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
            <!-- Filters Toolbar -->
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#14161a] p-3.5 rounded-2xl border border-white/10 shadow">
              <div class="flex items-center gap-1.5 text-xs bg-black/40 p-1 rounded-xl border border-white/5">
                <button
                  type="button"
                  (click)="onFilterChange.emit('TODAS')"
                  class="px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5"
                  [ngClass]="subFilter() === 'TODAS' ? 'bg-sky-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'"
                >
                  <span>Todas Activas</span>
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" [ngClass]="subFilter() === 'TODAS' ? 'bg-black/20 text-slate-950' : 'bg-white/10 text-slate-300'">{{ activasCount() }}</span>
                </button>

                <button
                  type="button"
                  (click)="onFilterChange.emit('POR_RECOGER')"
                  class="px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5"
                  [ngClass]="subFilter() === 'POR_RECOGER' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'"
                >
                  <span>Por Recoger en Cocina</span>
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" [ngClass]="subFilter() === 'POR_RECOGER' ? 'bg-black/30 text-white' : 'bg-white/10 text-slate-300'">{{ porRecogerCount() }}</span>
                </button>

                <button
                  type="button"
                  (click)="onFilterChange.emit('EN_RUTA')"
                  class="px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5"
                  [ngClass]="subFilter() === 'EN_RUTA' ? 'bg-sky-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'"
                >
                  <span>Mis Entregas</span>
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" [ngClass]="subFilter() === 'EN_RUTA' ? 'bg-black/30 text-slate-950' : 'bg-white/10 text-slate-300'">{{ misEntregasCount() }}</span>
                </button>
              </div>

              <span class="text-xs text-slate-400">Actualización en vivo cada 2.5s</span>
            </div>
  `
})
export class DeliveryFiltersComponent {
  readonly subFilter = input.required<DeliverySubFilter>();
  readonly activasCount = input.required<number>();
  readonly porRecogerCount = input.required<number>();
  readonly misEntregasCount = input.required<number>();
  readonly onFilterChange = output<DeliverySubFilter>();
}
