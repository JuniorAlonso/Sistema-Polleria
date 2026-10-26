import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyPENPipe } from '../../../../shared/pipes/currency-pen.pipe';
import { Order } from '../../../../core/models/order.model';
import { OrderAdvance } from '../../models/admin-forms';
import { getCodeNum } from '../../shared/admin-format.util';

/** Columna "NUEVAS ORDENES" del tablero. Presentacional: solo input()/output(). */
@Component({
  selector: 'app-orders-new-column',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CurrencyPENPipe],
  template: `
              <div class="bg-[#121418] rounded-2xl border border-white/5 flex flex-col overflow-hidden shadow-xl">
                
                <!-- Column Header -->
                <div class="p-4 border-b border-white/5 flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                    <h2 class="font-display text-lg tracking-wider uppercase text-white font-bold">
                      NUEVAS ORDENES
                    </h2>
                  </div>
                  <span class="w-6 h-6 rounded-full bg-rose-600 text-white text-xs font-black flex items-center justify-center font-mono">
                    {{ orders().length }}
                  </span>
                </div>

                <!-- Orders Cards List -->
                <div class="flex-1 p-3 space-y-3 overflow-y-auto">
                  @for (order of orders(); track order.id) {
                    <div 
                      (click)="orderSelected.emit(order)"
                      class="p-4 rounded-xl bg-[#1c1f24] border border-white/5 hover:border-polleria-gold/50 transition space-y-3 shadow-md cursor-pointer group"
                    >
                      <!-- Card Header -->
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <span class="font-mono text-base font-black text-white group-hover:text-polleria-gold transition">
                            #{{ getCodeNum(order.codigoSeguimiento) }}
                          </span>
                          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                            {{ order.tipo }}
                          </span>
                          <span 
                            class="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono"
                            [ngClass]="estaOrdenPagada(order) ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'"
                          >
                            {{ estaOrdenPagada(order) ? '✓ PAGADO' : '💵 COBRAR EN ENTREGA' }}
                          </span>
                        </div>
                        <span class="text-xs font-bold text-slate-300">
                          {{ order.cliente.nombre }}
                        </span>
                      </div>

                      <!-- Items -->
                      <div class="text-xs text-slate-300 space-y-1">
                        @for (item of order.items; track item.product.id) {
                          <p class="line-clamp-1">
                            <strong class="text-white">{{ item.cantidad }}x</strong> {{ item.product.nombre }}
                          </p>
                        }
                        @if (order.cliente.referencia || order.notasGenerales) {
                          <p class="text-[11px] text-slate-400 italic line-clamp-1">
                            Nota: {{ order.cliente.referencia || order.notasGenerales }}
                          </p>
                        }
                      </div>

                      <!-- Price & Action Button (ACCEPT) -->
                      <div class="pt-2 border-t border-white/5 flex items-center justify-between">
                        <span class="font-display text-xl font-bold text-polleria-gold">
                          {{ order.total | currencyPEN }}
                        </span>

                        <div class="flex items-center gap-1.5" (click)="$event.stopPropagation()">
                          <button 
                            (click)="cancelled.emit(order)"
                            class="p-1.5 rounded-lg bg-white/5 hover:bg-rose-600/30 text-rose-400 transition"
                            title="Cancelar pedido"
                          >
                            ✕
                          </button>
                          <button 
                            (click)="advance.emit({ order, status: 'EN_PREPARACION' })"
                            class="px-4 py-1.5 rounded-lg bg-[#2a2e36] hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-xs"
                          >
                            ACEPTAR
                          </button>
                        </div>
                      </div>

                    </div>
                  }
                </div>

              </div>
  `
})
export class OrdersNewColumnComponent {
  readonly orders = input.required<Order[]>();
  /** Ids (string) de las órdenes con pago aprobado. */
  readonly paidIds = input.required<ReadonlySet<string>>();

  readonly orderSelected = output<Order>();
  readonly cancelled = output<Order>();
  readonly advance = output<OrderAdvance>();

  protected readonly getCodeNum = getCodeNum;

  protected estaOrdenPagada(order: Order): boolean {
    return this.paidIds().has(String(order.id));
  }
}
