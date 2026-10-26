import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { Order } from '../../../core/models/order.model';
import { cantidadItems, getCodeNum } from './delivery.utils';

@Component({
  selector: 'app-available-orders-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPENPipe],
  template: `
              <section class="rounded-2xl bg-[#14161a] border border-sky-500/30 shadow-xl overflow-hidden">
                <div class="p-4 border-b border-white/10 flex items-center justify-between gap-3">
                  <div class="flex items-center gap-2.5">
                    <span class="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
                    <h2 class="text-sm font-extrabold text-white uppercase tracking-wide">Pedidos disponibles para entregar</h2>
                  </div>
                  <span class="px-2.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 text-xs font-bold">
                    {{ orders().length }}
                  </span>
                </div>

                @if (orders().length === 0) {
                  <p class="p-6 text-center text-xs text-slate-400">
                    No hay pedidos listos esperando repartidor en este momento.
                  </p>
                } @else {
                  <ul class="divide-y divide-white/5">
                    @for (order of orders(); track order.id) {
                      <li class="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div class="flex flex-col gap-1 text-xs min-w-0">
                          <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-mono text-base font-black text-white">#{{ getCodeNum(order.codigoSeguimiento) }}</span>
                            <span class="font-display font-bold text-polleria-gold">{{ order.total | currencyPEN }}</span>
                            <span class="px-2 py-0.5 rounded-full bg-white/5 text-slate-300 font-bold">
                              {{ cantidadItems(order) }} {{ cantidadItems(order) === 1 ? 'ítem' : 'ítems' }}
                            </span>
                          </div>
                          <span class="text-slate-300">
                            <span class="text-slate-500 font-bold">Dirección:</span>
                            {{ order.cliente.direccion || 'Ica' }}
                          </span>
                          @if (order.cliente.referencia) {
                            <span class="text-slate-400 italic">Ref: {{ order.cliente.referencia }}</span>
                          }
                        </div>

                        <button
                          type="button"
                          (click)="onClaimOrder.emit(order)"
                          [disabled]="!canClaim()"
                          class="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-lg shrink-0"
                        >
                          Tomar pedido
                        </button>
                      </li>
                    }
                  </ul>
                }
              </section>
  `
})
export class AvailableOrdersListComponent {
  readonly orders = input.required<Order[]>();
  readonly canClaim = input.required<boolean>();
  readonly onClaimOrder = output<Order>();

  readonly getCodeNum = getCodeNum;
  readonly cantidadItems = cantidadItems;
}
