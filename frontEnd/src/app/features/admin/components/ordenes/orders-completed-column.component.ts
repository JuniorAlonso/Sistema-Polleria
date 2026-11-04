import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyPENPipe } from '../../../../shared/pipes/currency-pen.pipe';
import { Order } from '../../../../core/models/order.model';
import { getCodeNum } from '../../shared/admin-format.util';

/** Columna "COMPLETADO" del tablero. Presentacional: solo input()/output(). */
@Component({
  selector: 'app-orders-completed-column',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CurrencyPENPipe],
  template: `
              <div class="bg-[#f59e0b] text-slate-950 rounded-2xl border border-amber-600 flex flex-col overflow-hidden shadow-2xl">
                
                <!-- Column Header -->
                <div class="p-4 border-b border-amber-600/30 flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <svg class="w-5 h-5 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <h2 class="font-display text-lg tracking-wider uppercase text-slate-950 font-black">
                      COMPLETADO
                    </h2>
                  </div>
                  <span class="w-6 h-6 rounded-full bg-slate-950 text-white text-xs font-black flex items-center justify-center font-mono">
                    {{ orders().length }}
                  </span>
                </div>

                <!-- Orders Cards List -->
                <div class="flex-1 p-3 space-y-3 overflow-y-auto">
                  @for (order of orders(); track order.id) {
                    <div 
                      (click)="orderSelected.emit(order)"
                      class="p-4 rounded-xl bg-[#26282e] text-white border border-white/10 space-y-2 shadow-md cursor-pointer hover:border-polleria-gold transition"
                    >
                      <div class="flex items-center justify-between">
                        <span class="font-mono text-base font-black text-white">
                          #{{ getCodeNum(order.codigoSeguimiento) }}
                        </span>
                        <span class="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                          <svg class="w-3 h-3 text-emerald-400 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>Entregado
                        </span>
                      </div>
                      <p class="text-xs text-slate-300 font-medium">{{ order.cliente.nombre }}</p>
                      <div class="flex justify-between items-center pt-1 border-t border-white/5">
                        <span class="font-display text-sm text-polleria-gold">{{ order.total | currencyPEN }}</span>
                        <span class="text-[10px] text-slate-400 font-mono">{{ order.tipo }}</span>
                      </div>
                    </div>
                  }
                </div>

              </div>
  `
})
export class OrdersCompletedColumnComponent {
  readonly orders = input.required<Order[]>();

  readonly orderSelected = output<Order>();

  protected readonly getCodeNum = getCodeNum;
}
