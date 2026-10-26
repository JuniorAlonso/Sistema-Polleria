import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyPENPipe } from '../../../../shared/pipes/currency-pen.pipe';
import { MesaSalon } from '../../../../core/models/table.model';

/** Vista catálogo (tarjetas) de mesas. Presentacional: toda acción sale como evento. */
@Component({
  selector: 'app-mesas-cards',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CurrencyPENPipe],
  template: `
            <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              @for (t of mesas(); track t.id) {
                <div 
                  (click)="mesaSelected.emit(t)"
                  class="p-5 rounded-2xl border transition duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between"
                  [ngClass]="{
                    'bg-[#121418] border-white/10 hover:border-polleria-gold/50': selectedMesa()?.id !== t.id,
                    'bg-[#161920] border-polleria-gold ring-2 ring-polleria-gold/40 shadow-xl': selectedMesa()?.id === t.id
                  }"
                >
                  <div>
                    <div class="flex justify-between items-start mb-2">
                      <div class="flex items-center gap-2">
                        <span class="font-display text-xl font-bold text-white">Mesa #{{ t.numero }}</span>
                        @if (t.activo === false) {
                          <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">Inactiva</span>
                        }
                      </div>
                      <span 
                        class="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        [ngClass]="{
                          'bg-emerald-500/20 text-emerald-400': t.estado === 'LIBRE',
                          'bg-rose-500/20 text-rose-400': t.estado === 'OCUPADA',
                          'bg-amber-500/20 text-amber-300': t.estado === 'POR_COBRAR',
                          'bg-sky-500/20 text-sky-300': t.estado === 'EN_LIMPIEZA',
                          'bg-purple-500/20 text-purple-300': t.estado === 'RESERVADA'
                        }"
                      >
                        {{ t.estado }}
                      </span>
                    </div>
                    
                    <div class="text-xs space-y-1 text-slate-400">
                      <p><span class="text-slate-500">Zona:</span> <strong class="text-slate-200">{{ (t.zona || 'SALON_PRINCIPAL').replace('_', ' ') }}</strong></p>
                      <p><span class="text-slate-500">Capacidad:</span> <strong class="text-slate-200">{{ t.capacidad }} comensales</strong></p>
                      <p class="font-mono text-[11px] text-slate-500">Plano: (X: {{ t.posicionX || 0 }}, Y: {{ t.posicionY || 0 }})</p>
                    </div>

                    @if (t.ordenActiva) {
                      <div class="mt-3 p-2.5 rounded-xl bg-black/40 border border-white/5 text-xs space-y-1">
                        <div class="flex justify-between items-center text-slate-300">
                          <span>Comanda activa:</span>
                          <span class="font-mono font-bold text-polleria-gold">#{{ t.ordenActiva.codigoSeguimiento || t.ordenActiva.ordenId }}</span>
                        </div>
                        <div class="flex justify-between items-center text-slate-400">
                          <span>Total consumo:</span>
                          <span class="font-bold text-white">{{ t.ordenActiva.total | currencyPEN }}</span>
                        </div>
                        @if (t.ordenActiva.estadoOrden === 'LISTO' && !t.ordenActiva.servidoEn) {
                          <div class="flex justify-end">
                            <span class="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black uppercase tracking-wider animate-pulse motion-reduce:animate-none">Listo para servir</span>
                          </div>
                        } @else if (t.ordenActiva.servidoEn) {
                          <div class="flex justify-end">
                            <span class="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[9px] font-black uppercase tracking-wider">Servida</span>
                          </div>
                        }
                      </div>
                    }
                  </div>

                  <!-- Admin Management Actions -->
                  <div class="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-1.5" (click)="$event.stopPropagation()">
                    <button 
                      (click)="editRequested.emit(t)"
                      class="flex-1 py-1.5 px-2 bg-white/5 hover:bg-white/15 text-slate-200 hover:text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                      title="Editar propiedades de la mesa"
                    >
                      <svg class="w-3.5 h-3.5 text-polleria-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                      </svg>
                      <span>Editar</span>
                    </button>

                    <button 
                      (click)="coordinatesRequested.emit(t)"
                      class="p-1.5 bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white rounded-lg text-xs transition cursor-pointer"
                      title="Mover posición en el plano"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
                      </svg>
                    </button>

                    <button 
                      (click)="deactivateRequested.emit(t)"
                      class="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-lg text-xs transition cursor-pointer"
                      title="Dar de baja / Desactivar mesa"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  </div>

                </div>
              }
            </div>
  `
})
export class MesasCardsComponent {
  readonly mesas = input.required<MesaSalon[]>();
  readonly selectedMesa = input.required<MesaSalon | null>();

  readonly mesaSelected = output<MesaSalon>();
  readonly editRequested = output<MesaSalon>();
  readonly coordinatesRequested = output<MesaSalon>();
  readonly deactivateRequested = output<MesaSalon>();
}
