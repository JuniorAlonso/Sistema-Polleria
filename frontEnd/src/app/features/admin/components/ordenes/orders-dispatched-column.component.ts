import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyPENPipe } from '../../../../shared/pipes/currency-pen.pipe';
import { Order } from '../../../../core/models/order.model';
import { OrderAdvance } from '../../models/admin-forms';
import { getCodeNum } from '../../shared/admin-format.util';

/** Columna "EN CAMINO" del tablero. Presentacional: solo input()/output(). */
@Component({
  selector: 'app-orders-dispatched-column',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CurrencyPENPipe],
  template: `
              <div class="bg-[#eceef1] text-slate-900 rounded-2xl border border-slate-300 flex flex-col overflow-hidden shadow-xl">
                
                <!-- Column Header -->
                <div class="p-4 border-b border-slate-300 flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <svg class="w-5 h-5 text-slate-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h2m-6 0a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/>
                    </svg>
                    <h2 class="font-display text-lg tracking-wider uppercase text-slate-950 font-bold">
                      EN CAMINO
                    </h2>
                  </div>
                  <span class="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-black flex items-center justify-center font-mono">
                    {{ orders().length }}
                  </span>
                </div>

                <!-- Orders Cards List -->
                <div class="flex-1 p-3 space-y-3 overflow-y-auto">
                  @for (order of orders(); track order.id) {
                    <div 
                      (click)="orderSelected.emit(order)"
                      class="p-4 rounded-xl bg-[#1c1f24] text-white border border-white/5 space-y-3 shadow-md cursor-pointer hover:border-slate-400 transition"
                    >
                      <!-- Card Header -->
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <span class="font-mono text-base font-black text-white">#{{ getCodeNum(order.codigoSeguimiento) }}</span>
                          <span class="font-bold text-xs text-slate-300">
                            {{ order.cliente.nombre }}
                          </span>
                        </div>
                        <span class="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-mono font-bold">
                          En ruta
                        </span>
                      </div>

                      <!-- Items -->
                      <div class="text-xs text-slate-400 space-y-1">
                        @for (item of order.items; track item.product.id) {
                          <p class="line-clamp-1">{{ item.cantidad }}x {{ item.product.nombre }}</p>
                        }
                        <p class="text-[11px] text-slate-300 truncate">Dir: {{ order.cliente.direccion }}</p>
                        @if (order.repartidorId) {
                          <div class="flex items-center gap-1.5 text-[10px] text-amber-300 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 w-fit">
                            <span>🛵</span>
                            <span>{{ nombreMotorizado(order) }}</span>
                          </div>
                        }
                        @if (estaOrdenPagada(order)) {
                          <div class="flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30 w-fit font-mono">
                            <span>✓</span>
                            <span>PAGADO (No cobrar)</span>
                          </div>
                        } @else {
                          <div class="flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30 w-fit font-mono">
                            <span>💵</span>
                            <span>COBRAR: {{ order.total | currencyPEN }}</span>
                          </div>
                        }
                      </div>

                      <!-- Bottom -->
                      <div class="pt-2 border-t border-white/5 flex items-center justify-between" (click)="$event.stopPropagation()">
                        <span class="font-display text-xl font-bold text-rose-500">
                          {{ order.total | currencyPEN }}
                        </span>

                        <button 
                          (click)="advance.emit({ order, status: 'COMPLETADO' })"
                          [disabled]="cobroPendiente(order)"
                          [attr.title]="cobroPendiente(order) ? 'Cobro en efectivo pendiente: lo registra el repartidor antes de entregar' : 'Marcar como entregado'"
                          class="px-3.5 py-1.5 rounded bg-rose-600 hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          ENTREGADO
                        </button>
                      </div>

                    </div>
                  }
                </div>

              </div>
  `
})
export class OrdersDispatchedColumnComponent {
  readonly orders = input.required<Order[]>();
  /** Ids (string) de las órdenes con pago aprobado. */
  readonly paidIds = input.required<ReadonlySet<string>>();
  /** Nombre real del motorizado por id (roster de auth-service). */
  readonly motorizadoNames = input.required<Record<number, string>>();

  readonly orderSelected = output<Order>();
  readonly advance = output<OrderAdvance>();

  protected readonly getCodeNum = getCodeNum;

  protected estaOrdenPagada(order: Order): boolean {
    return this.paidIds().has(String(order.id));
  }

  /** A ContraPago order cannot be closed until the courier registers the cash collection. */
  protected cobroPendiente(order: Order): boolean {
    return !!order.requiereCobroEfectivo && !this.estaOrdenPagada(order);
  }

  /** Sin roster se muestra el id: nunca un nombre inventado. */
  protected nombreMotorizado(order: Order): string {
    const id = order.repartidorId;
    if (id == null) return 'Por asignar';
    return this.motorizadoNames()[id] ?? `Motorizado #${id}`;
  }
}
