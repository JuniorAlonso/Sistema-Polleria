import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Order } from '../../../../core/models/order.model';
import { getCodeNum } from '../../shared/admin-format.util';

/** Columna "PREPARANDOSE" del tablero. Presentacional: solo input()/output(). */
@Component({
  selector: 'app-orders-preparing-column',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
              <div class="bg-[#383a42] rounded-2xl border border-white/10 flex flex-col overflow-hidden shadow-xl">
                
                <!-- Column Header -->
                <div class="p-4 border-b border-white/10 flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                    <h2 class="font-display text-lg tracking-wider uppercase text-white font-bold">
                      PREPARANDOSE
                    </h2>
                  </div>
                  <span class="w-6 h-6 rounded-full bg-black/40 text-white text-xs font-black flex items-center justify-center font-mono">
                    {{ orders().length }}
                  </span>
                </div>

                <!-- Orders Cards List -->
                <div class="flex-1 p-3 space-y-3 overflow-y-auto">
                  @for (order of orders(); track order.id) {
                    <div 
                      (click)="orderSelected.emit(order)"
                      class="p-4 rounded-xl bg-[#1c1f24] border-l-4 border-l-amber-400 border-white/5 space-y-3 shadow-md cursor-pointer group hover:border-slate-500 transition"
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
                            {{ estaOrdenPagada(order) ? '✓ PAGADO' : '💵 POR COBRAR' }}
                          </span>
                        </div>
                        <span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">
                          {{ order.estado === 'LISTO_COCINA' ? 'Listo en Horno' : 'Cocinando' }}
                        </span>
                      </div>

                      <!-- Items -->
                      <div class="text-xs text-slate-300 space-y-1">
                        @for (item of order.items; track item.product.id) {
                          <p class="line-clamp-1">
                            <strong class="text-white">{{ item.cantidad }}x</strong> {{ item.product.nombre }}
                          </p>
                        }
                      </div>

                      <!-- Bottom: Chef indicator & LISTO button -->
                      <div class="pt-2 border-t border-white/5 flex items-center justify-between" (click)="$event.stopPropagation()">
                        <div class="flex items-center gap-1.5 text-xs text-slate-400">
                          <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"/>
                          </svg>
                          <span>{{ order.cliente.nombre }}</span>
                        </div>

                        @if (order.estado === 'EN_PREPARACION') {
                          <button 
                            (click)="markReady.emit(order)"
                            class="px-4 py-1.5 rounded-lg bg-[#2a2e36] hover:bg-amber-600 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-xs"
                          >
                            <span>LISTO</span>
                          </button>
                        } @else {
                          <button 
                            (click)="advanceAfterReady.emit(order)"
                            [disabled]="cobroPendiente(order)"
                            [attr.title]="cobroPendiente(order) ? 'Cobro en efectivo pendiente: se registra en caja antes de entregar' : null"
                            class="disabled:opacity-40 disabled:cursor-not-allowed px-4 py-1.5 rounded-lg text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-xs flex items-center gap-1.5"
                            [ngClass]="order.tipo === 'DELIVERY' ? 'bg-amber-600/30 hover:bg-amber-500 text-amber-200 hover:text-slate-950 border border-amber-500/40' : 'bg-[#2a2e36] hover:bg-purple-600'"
                          >
                            @if (order.tipo === 'DELIVERY') {
                              <span>🛵</span>
                            }
                            <span>{{ order.tipo === 'DELIVERY' ? 'A REPARTO' : 'ENTREGAR' }}</span>
                          </button>
                        }
                      </div>

                    </div>
                  }
                </div>

              </div>
  `
})
export class OrdersPreparingColumnComponent {
  readonly orders = input.required<Order[]>();
  /** Ids (string) de las órdenes con pago aprobado. */
  readonly paidIds = input.required<ReadonlySet<string>>();

  readonly orderSelected = output<Order>();
  readonly markReady = output<Order>();
  readonly advanceAfterReady = output<Order>();

  protected readonly getCodeNum = getCodeNum;

  protected estaOrdenPagada(order: Order): boolean {
    return this.paidIds().has(String(order.id));
  }

  /** Pickup/salon ContraPago orders cannot be delivered before the cash is registered (backend 409). */
  protected cobroPendiente(order: Order): boolean {
    return order.tipo !== 'DELIVERY' && !!order.requiereCobroEfectivo && !this.estaOrdenPagada(order);
  }
}
