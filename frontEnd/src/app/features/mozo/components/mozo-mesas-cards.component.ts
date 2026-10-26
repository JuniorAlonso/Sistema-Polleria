import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { MesaSalon } from '../mozo.types';
import { esMesaParaCobrar, tiempoTranscurridoDesde } from '../mozo.helpers';

@Component({
  selector: 'app-mozo-mesas-cards',
  standalone: true,
  imports: [CommonModule, CurrencyPENPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' },
  template: `
                @for (m of mesas(); track m.id) {
                  <div 
                    (click)="seleccionar.emit(m)"
                    class="p-5 rounded-2xl border transition duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between group shadow-lg"
                    [ngClass]="{
                      'bg-[#102419] border-emerald-500/40 hover:border-emerald-400': m.estado === 'LIBRE',
                      'bg-[#2d220f] border-amber-500/40 hover:border-amber-400': esMesaParaCobrar(m),
                      'bg-[#2d1217] border-rose-500/40 hover:border-rose-400': !esMesaParaCobrar(m) && m.estado === 'OCUPADA',
                      'bg-[#131f33] border-sky-500/40 hover:border-sky-400': m.estado === 'RESERVADA',
                      'ring-4 ring-amber-400/70 animate-pulse motion-reduce:animate-none': m.platosListos
                    }"
                  >
                    <!-- Platos Listos Badge -->
                    @if (m.platosListos) {
                      <div class="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider animate-pulse shadow">
                        <svg class="w-3.5 h-3.5 text-amber-400 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>Plato Listo
                      </div>
                    }

                    <div>
                      <div class="flex items-center justify-between">
                        <span class="font-display text-2xl font-black text-white group-hover:text-polleria-gold transition">
                          {{ m.nombre }}
                        </span>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          [ngClass]="{
                            'bg-emerald-500/20 text-emerald-300': m.estado === 'LIBRE',
                            'bg-amber-500/20 text-amber-300': esMesaParaCobrar(m),
                            'bg-rose-500/20 text-rose-300': !esMesaParaCobrar(m) && m.estado === 'OCUPADA',
                            'bg-sky-500/20 text-sky-300': m.estado === 'RESERVADA'
                          }"
                        >
                          {{ esMesaParaCobrar(m) ? 'POR COBRAR' : m.estado }}
                        </span>
                      </div>

                      <p class="text-xs text-slate-400 mt-1">Capacidad: {{ m.capacidad }} personas • {{ m.zona }}</p>

                      @if (m.estado === 'OCUPADA' || m.estado === 'POR_COBRAR' || m.servidoEn) {
                        <div class="mt-4 pt-3 border-t border-white/10 space-y-1.5 text-xs">
                          <div class="flex justify-between text-slate-300">
                            <span>Comensales:</span>
                            <span class="font-bold text-white">{{ m.comensales }}</span>
                          </div>

                          @if (m.servidoEn) {
                            <div class="flex justify-between items-center text-amber-300 font-semibold bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20">
                              <span class="flex items-center gap-1.5 text-[11px]">
                                <svg class="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                                Comida servida:
                              </span>
                              <span class="font-mono text-[11px] text-amber-300 font-bold">Hace {{ tiempoTranscurridoDesde(m.servidoEn) }}</span>
                            </div>
                          } @else {
                            <div class="flex justify-between text-slate-300">
                              <span>Tiempo esperando:</span>
                              <span class="font-mono text-amber-400">{{ m.tiempoMinutos }} min</span>
                            </div>
                          }

                          <div class="flex justify-between text-slate-300">
                            <span>Mozo:</span>
                            <span class="font-bold text-slate-200">{{ m.mozo || 'Yovana M.' }}</span>
                          </div>
                        </div>
                      } @else {
                        <div class="mt-4 pt-3 border-t border-white/10 text-xs text-slate-500 flex flex-col items-center justify-center h-16 gap-1">
                          <span class="text-emerald-400 font-semibold">Disponible para asignar</span>
                          <span class="text-[10px] text-slate-400">Toca para iniciar comanda</span>
                        </div>
                      }
                    </div>

                    <!-- Footer / Consumo -->
                    <div class="mt-4 pt-3 border-t border-white/10 flex justify-between items-center">
                      <span class="text-xs text-slate-400">Total acumulado:</span>
                      <span class="font-display text-lg font-bold text-polleria-gold">
                        {{ m.totalConsumo | currencyPEN }}
                      </span>
                    </div>

                  </div>
                }
  `
})
export class MozoMesasCardsComponent {
  readonly mesas = input.required<MesaSalon[]>();
  readonly ahora = input.required<number>();

  readonly seleccionar = output<MesaSalon>();

  readonly esMesaParaCobrar = esMesaParaCobrar;

  tiempoTranscurridoDesde(fechaIso?: string | null): string {
    return tiempoTranscurridoDesde(fechaIso, this.ahora());
  }
}
