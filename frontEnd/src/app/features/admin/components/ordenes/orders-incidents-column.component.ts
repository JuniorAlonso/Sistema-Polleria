import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyPENPipe } from '../../../../shared/pipes/currency-pen.pipe';
import { Order } from '../../../../core/models/order.model';
import { getCodeNum } from '../../shared/admin-format.util';

/** Carril "INCIDENCIAS": pedidos fantasma y cancelados (solo lectura). Presentacional. */
@Component({
  selector: 'app-orders-incidents-column',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CurrencyPENPipe],
  template: `
    <div class="bg-[#121418] rounded-2xl border border-white/5 flex flex-col overflow-hidden shadow-xl">
      <div class="p-4 border-b border-white/5 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
          <h2 class="font-display text-lg tracking-wider uppercase text-white font-bold">INCIDENCIAS</h2>
        </div>
        <span class="w-6 h-6 rounded-full bg-slate-700 text-white text-xs font-black flex items-center justify-center font-mono">
          {{ orders().length }}
        </span>
      </div>

      <div class="flex-1 p-3 space-y-3 overflow-y-auto">
        @for (order of orders(); track order.id) {
          <div
            (click)="orderSelected.emit(order)"
            class="p-4 rounded-xl bg-[#1c1f24] border border-white/5 hover:border-slate-400 transition space-y-2 shadow-md cursor-pointer"
          >
            <div class="flex items-center justify-between">
              <span class="font-mono text-base font-black text-white">#{{ getCodeNum(order.codigoSeguimiento) }}</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold"
                [ngClass]="order.estado === 'PEDIDO_FANTASMA' ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-700 text-slate-300'">
                {{ order.estado === 'PEDIDO_FANTASMA' ? 'PEDIDO FANTASMA' : 'CANCELADO' }}
              </span>
            </div>
            <p class="text-xs text-slate-300 font-medium">{{ order.cliente.nombre }} · {{ order.cliente.celular }}</p>
            @if (order.estado === 'PEDIDO_FANTASMA') {
              <p class="text-[11px] text-rose-300" data-testid="ghost-reason">
                {{ order.motivoFantasma || 'Sin motivo registrado' }}
              </p>
              <p class="text-[10px] text-slate-500">Teléfono, correo e IP quedan bloqueados para pago contra entrega.</p>
            }
            <div class="flex justify-between items-center pt-1 border-t border-white/5">
              <span class="font-display text-sm text-polleria-gold">{{ order.total | currencyPEN }}</span>
              <span class="text-[10px] text-slate-400 font-mono">{{ order.tipo }}</span>
            </div>
          </div>
        } @empty {
          <p class="text-center text-xs text-slate-500 py-6">Sin incidencias.</p>
        }
      </div>
    </div>
  `
})
export class OrdersIncidentsColumnComponent {
  readonly orders = input.required<Order[]>();
  readonly orderSelected = output<Order>();

  protected readonly getCodeNum = getCodeNum;
}
