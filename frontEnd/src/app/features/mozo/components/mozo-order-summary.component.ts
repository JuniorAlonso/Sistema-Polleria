import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { ComandaItem } from '../mozo.types';

@Component({
  selector: 'app-mozo-order-summary',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPENPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'bg-[#14161a] p-5 rounded-2xl border border-white/10 shadow flex flex-col justify-between h-[calc(100vh-175px)] sticky top-20' },
  template: `
                <div>
                  <div class="flex justify-between items-center pb-4 border-b border-white/10">
                    <div>
                      <h3 class="text-base font-extrabold text-white">Comanda Mesa #{{ mesaTitulo() }}</h3>
                      <p class="text-xs text-slate-400">Mozo: {{ userName() || 'Yovana M.' }}</p>
                    </div>
                    <span class="px-2.5 py-1 rounded-full bg-polleria-crimson text-white text-xs font-bold">
                      {{ items().length }} items
                    </span>
                  </div>

                  <!-- Comanda activa de la mesa: los platos se suman a la misma orden -->
                  @if (ordenActivaId(); as ordenId) {
                    <div class="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 text-[11px] text-amber-200 leading-snug">
                      Esta mesa ya tiene la comanda #{{ ordenId }}{{ estadoComandaLabel() ? ' (' + estadoComandaLabel() + ')' : '' }}. Los platos que agregues se suman a esa comanda.
                    </div>
                  }

                  <!-- Comanda Items List -->
                  <div class="py-4 space-y-3 overflow-y-auto max-h-[360px] custom-scrollbar">
                    @if (items().length === 0) {
                      <div class="text-center py-12 text-slate-500 text-xs">
                        No hay platos agregados a esta comanda.<br/>Selecciona productos de la carta.
                      </div>
                    }

                    @for (item of items(); track $index) {
                      <div class="p-3 rounded-xl bg-white/5 border border-white/5 space-y-2">
                        <div class="flex justify-between items-start">
                          <div>
                            <span class="text-xs font-bold text-white">{{ item.cantidad }}x {{ item.producto.nombre }}</span>
                            <span class="block text-[11px] font-mono text-polleria-gold">{{ item.producto.precio * item.cantidad | currencyPEN }}</span>
                          </div>
                          <button (click)="eliminar.emit($index)" class="text-rose-400 hover:text-rose-300 cursor-pointer" aria-label="Eliminar"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
                        </div>
                        <input 
                          type="text" 
                          [ngModel]="item.notas"
                          (ngModelChange)="notasChange.emit({ index: $index, notas: $event })" 
                          placeholder="Notas de cocina (ej: papas bien doradas, sin ají...)"
                          class="w-full px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-[11px] text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                        />
                      </div>
                    }
                  </div>
                </div>

                <!-- Footer Summary & Submit -->
                <div class="pt-4 border-t border-white/10 space-y-3">
                  <div class="flex justify-between items-center">
                    <span class="text-xs text-slate-400 font-bold">Total Comanda:</span>
                    <span class="font-display text-2xl font-black text-polleria-gold">
                      {{ total() | currencyPEN }}
                    </span>
                  </div>

                  <button 
                    [disabled]="items().length === 0"
                    (click)="enviar.emit()"
                    class="w-full py-3 rounded-xl bg-polleria-crimson hover:bg-polleria-crimsonHover disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-lg"
                  >
                    <svg class="w-4 h-4 inline mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                    @if (ordenActivaId(); as ordenId) {
                      <span>Agregar a la comanda #{{ ordenId }}</span>
                    } @else {
                      <span>Enviar a Cocina & Horno</span>
                    }
                  </button>
                </div>

  `
})
export class MozoOrderSummaryComponent {
  readonly mesaTitulo = input.required<number | string | undefined>();
  readonly userName = input<string | null | undefined>();
  readonly ordenActivaId = input<string | undefined>();
  readonly estadoComandaLabel = input<string>('');
  readonly items = input.required<ComandaItem[]>();
  readonly total = input.required<number>();

  readonly eliminar = output<number>();
  readonly notasChange = output<{ index: number; notas: string }>();
  readonly enviar = output<void>();
}
