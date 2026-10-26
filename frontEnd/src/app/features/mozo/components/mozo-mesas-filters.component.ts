import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ZonaSalonConfig } from '../../../core/services/salon.service';

@Component({
  selector: 'app-mozo-mesas-filters',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-[#14161a] p-4 rounded-2xl border border-white/10 shadow-lg' },
  template: `
              <div>
                <h2 class="text-xl font-bold text-white flex items-center gap-2">
                  <span>Control del Salón y Comensales</span>
                </h2>
                <p class="text-xs text-slate-400">Toca una mesa en el croquis o catálogo para ver su cuenta, agregar platos, cobrar o liberarla.</p>
              </div>

              <div class="flex items-center gap-3 flex-wrap">
                <!-- Toggle Vista Croquis vs Tarjetas -->
                <div class="flex items-center gap-1 bg-black/50 p-1 rounded-xl border border-white/10 text-xs">
                  <button 
                    type="button"
                    (click)="vistaChange.emit('CROQUIS')"
                    class="px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer"
                    [ngClass]="vistaMesas() === 'CROQUIS' ? 'bg-polleria-gold text-slate-950 shadow' : 'text-slate-400 hover:text-white'"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
                    </svg>
                    <span>Croquis Salón</span>
                  </button>
                  <button 
                    type="button"
                    (click)="vistaChange.emit('TARJETAS')"
                    class="px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer"
                    [ngClass]="vistaMesas() === 'TARJETAS' ? 'bg-polleria-gold text-slate-950 shadow' : 'text-slate-400 hover:text-white'"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
                    </svg>
                    <span>Tarjetas</span>
                  </button>
                </div>

                <!-- Filter Zones -->
                <div class="flex items-center gap-1 text-xs bg-black/40 p-1 rounded-xl border border-white/5">
                  <button 
                    (click)="zoneChange.emit('TODAS')"
                    class="px-2.5 py-1.5 rounded-lg font-bold transition cursor-pointer"
                    [ngClass]="selectedZone() === 'TODAS' ? 'bg-polleria-gold text-slate-950 shadow' : 'text-slate-400 hover:text-white'"
                  >
                    Todas ({{ mesasCount() }})
                  </button>
                  @for (z of zonasSalon(); track z.id) {
                    <button 
                      (click)="zoneChange.emit(z.id)"
                      class="px-2.5 py-1.5 rounded-lg font-bold transition cursor-pointer"
                      [ngClass]="selectedZone() === z.id ? 'bg-polleria-gold text-slate-950 shadow' : 'text-slate-400 hover:text-white'"
                    >
                      {{ z.nombre }}
                    </button>
                  }
                </div>
              </div>
  `
})
export class MozoMesasFiltersComponent {
  readonly vistaMesas = input.required<'CROQUIS' | 'TARJETAS'>();
  readonly selectedZone = input.required<string>();
  readonly zonasSalon = input.required<ZonaSalonConfig[]>();
  readonly mesasCount = input.required<number>();

  readonly vistaChange = output<'CROQUIS' | 'TARJETAS'>();
  readonly zoneChange = output<string>();
}
