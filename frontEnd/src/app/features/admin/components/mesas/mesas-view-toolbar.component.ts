import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Selector de vista (croquis/catálogo) y acciones de zona. Presentacional. */
@Component({
  selector: 'app-mesas-view-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#14161a] p-3 rounded-2xl border border-white/10 shadow-lg">
            <div class="flex items-center gap-2">
              <button 
                type="button"
                (click)="viewModeChange.emit('CROQUIS')"
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
                (click)="viewModeChange.emit('CARDS')"
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
                  (click)="autoOrganize.emit()"
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
                (click)="createTable.emit()"
                class="px-4 py-2 bg-polleria-crimson hover:bg-polleria-crimsonHover text-white font-bold text-xs rounded-xl transition shadow flex items-center gap-1.5 cursor-pointer"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
                <span>+ Crear Mesa</span>
              </button>
            </div>
          </div>
  `
})
export class MesasViewToolbarComponent {
  readonly mesaViewMode = input.required<'CROQUIS' | 'CARDS'>();

  readonly viewModeChange = output<'CROQUIS' | 'CARDS'>();
  readonly autoOrganize = output<void>();
  readonly createTable = output<void>();
}
