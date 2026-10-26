import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AlertaPlatoListo } from '../mozo.types';
import { esMiComanda } from '../mozo.helpers';

@Component({
  selector: 'app-mozo-alertas-list',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block space-y-6' },
  template: `
            
            <div class="bg-[#14161a] p-4 rounded-2xl border border-white/10 shadow flex justify-between items-center">
              <div>
                <h2 class="text-lg font-bold text-white flex items-center gap-2">
                  <span>Avisos de Platos Listos en Cocina</span>
                </h2>
                <p class="text-xs text-slate-400">Notificaciones instantáneas de platos recién salidos del horno para servir a mesa.</p>
              </div>
            </div>

            <!-- Alerts List -->
            <div class="space-y-3">
              @for (a of alertas(); track a.id) {
                <div 
                  class="p-4 rounded-2xl border transition duration-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-lg bg-amber-500/10 border-amber-500/40 animate-slide-up motion-reduce:animate-none"
                >
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                      </svg>
                    </div>
                    <div>
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-display text-lg font-black text-white">{{ a.mesa }}</span>
                        @if (a.hora) {
                          <span class="text-xs text-slate-400">• {{ a.hora }}</span>
                        }
                        @if (esMiComanda(a, miUserId())) {
                          <span class="px-2 py-0.5 rounded-full bg-polleria-gold/20 text-polleria-gold border border-polleria-gold/40 text-[10px] font-black uppercase tracking-wider">Tu comanda</span>
                        }
                      </div>
                      <p class="text-sm font-bold text-amber-300">{{ a.plato }}</p>
                    </div>
                  </div>

                  <button 
                    (click)="servir.emit(a)"
                    class="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow flex items-center gap-1.5"
                  >
                    <svg class="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>Servir en mesa
                  </button>
                </div>
              } @empty {
                <div class="p-6 rounded-2xl bg-white/5 border border-white/10 text-center text-xs text-slate-400">
                  No hay platos listos pendientes de servir.
                </div>
              }
            </div>

  `
})
export class MozoAlertasListComponent {
  readonly alertas = input.required<AlertaPlatoListo[]>();
  readonly miUserId = input<number | null | undefined>(null);

  readonly servir = output<AlertaPlatoListo>();

  readonly esMiComanda = esMiComanda;
}
