import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderStateFilter } from '../../models/admin-forms';

/** Barra de filtros por estado + botón de orden manual. Presentacional: solo input()/output(). */
@Component({
  selector: 'app-orders-filter-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
          <!-- Top Filter & Action Bar -->
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#14161a] p-3.5 rounded-2xl border border-white/10 shadow">
            
            <!-- State Filters -->
            <div class="flex items-center gap-1.5 text-xs bg-black/40 p-1 rounded-xl border border-white/5 overflow-x-auto no-scrollbar">
              <button 
                type="button"
                (click)="filterChange.emit('TODAS')"
                class="px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0"
                [ngClass]="orderStateFilter() === 'TODAS' ? 'bg-polleria-gold text-slate-950 shadow' : 'text-slate-400 hover:text-white'"
              >
                <span>TODAS</span>
                <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" [ngClass]="orderStateFilter() === 'TODAS' ? 'bg-black/20 text-slate-950' : 'bg-white/10 text-slate-300'">{{ totalCount() }}</span>
              </button>
              <button 
                type="button"
                (click)="filterChange.emit('ATENCION')"
                class="px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0"
                [ngClass]="orderStateFilter() === 'ATENCION' ? 'bg-fuchsia-500 text-white shadow' : 'text-slate-400 hover:text-white'"
              >
                <span class="w-2 h-2 rounded-full bg-fuchsia-400"></span>
                <span>ATENCIÓN</span>
                <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" [ngClass]="orderStateFilter() === 'ATENCION' ? 'bg-black/30 text-white' : 'bg-white/10 text-slate-300'">{{ attentionCount() }}</span>
              </button>
              <button 
                type="button"
                (click)="filterChange.emit('NUEVAS')"
                class="px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0"
                [ngClass]="orderStateFilter() === 'NUEVAS' ? 'bg-rose-500 text-white shadow' : 'text-slate-400 hover:text-white'"
              >
                <span class="w-2 h-2 rounded-full bg-rose-400"></span>
                <span>NUEVAS ORDENES</span>
                <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" [ngClass]="orderStateFilter() === 'NUEVAS' ? 'bg-black/30 text-white' : 'bg-white/10 text-slate-300'">{{ newCount() }}</span>
              </button>
              <button 
                type="button"
                (click)="filterChange.emit('PREPARANDOSE')"
                class="px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0"
                [ngClass]="orderStateFilter() === 'PREPARANDOSE' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'"
              >
                <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>PREPARANDOSE</span>
                <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" [ngClass]="orderStateFilter() === 'PREPARANDOSE' ? 'bg-black/30 text-slate-950' : 'bg-white/10 text-slate-300'">{{ preparingCount() }}</span>
              </button>
              <button 
                type="button"
                (click)="filterChange.emit('EN_CAMINO')"
                class="px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0"
                [ngClass]="orderStateFilter() === 'EN_CAMINO' ? 'bg-sky-500 text-white shadow' : 'text-slate-400 hover:text-white'"
              >
                <span class="w-2 h-2 rounded-full bg-sky-400"></span>
                <span>EN CAMINO</span>
                <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" [ngClass]="orderStateFilter() === 'EN_CAMINO' ? 'bg-black/30 text-white' : 'bg-white/10 text-slate-300'">{{ dispatchedCount() }}</span>
              </button>
              <button 
                type="button"
                (click)="filterChange.emit('COMPLETADO')"
                class="px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0"
                [ngClass]="orderStateFilter() === 'COMPLETADO' ? 'bg-emerald-500 text-white shadow' : 'text-slate-400 hover:text-white'"
              >
                <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>COMPLETADO</span>
                <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" [ngClass]="orderStateFilter() === 'COMPLETADO' ? 'bg-black/30 text-white' : 'bg-white/10 text-slate-300'">{{ completedCount() }}</span>
              </button>
              <button 
                type="button"
                (click)="filterChange.emit('INCIDENCIAS')"
                class="px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0"
                [ngClass]="orderStateFilter() === 'INCIDENCIAS' ? 'bg-slate-500 text-white shadow' : 'text-slate-400 hover:text-white'"
              >
                <span class="w-2 h-2 rounded-full bg-slate-300"></span>
                <span>INCIDENCIAS</span>
                <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" [ngClass]="orderStateFilter() === 'INCIDENCIAS' ? 'bg-black/30 text-white' : 'bg-white/10 text-slate-300'">{{ incidentsCount() }}</span>
              </button>
            </div>

            <!-- New Manual Order Button -->
            <div class="flex items-center gap-2">
              <button 
                (click)="newOrder.emit()"
                class="px-4 py-2 bg-polleria-crimson hover:bg-polleria-crimsonHover text-white font-bold text-xs rounded-xl transition shadow flex items-center gap-1.5 cursor-pointer"
              >
                <span>+ Nueva Orden Manual</span>
              </button>
            </div>

          </div>
  `
})
export class OrdersFilterBarComponent {
  readonly orderStateFilter = input.required<OrderStateFilter>();
  readonly totalCount = input.required<number>();
  readonly attentionCount = input.required<number>();
  readonly incidentsCount = input.required<number>();
  readonly newCount = input.required<number>();
  readonly preparingCount = input.required<number>();
  readonly dispatchedCount = input.required<number>();
  readonly completedCount = input.required<number>();

  readonly filterChange = output<OrderStateFilter>();
  readonly newOrder = output<void>();
}
