import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { Order } from '../../../core/models/order.model';
import { getCodeNum } from './delivery.utils';

@Component({
  selector: 'app-delivery-history',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPENPipe],
  template: `
          <main class="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">

            <div class="bg-[#14161a] rounded-2xl border border-white/10 overflow-hidden shadow">
              <div class="p-4 border-b border-white/10 flex justify-between items-center">
                <h3 class="text-sm font-bold text-white">Historial de Repartos Completados</h3>
                <span class="text-xs text-slate-400">Total: {{ orders().length }} pedidos</span>
              </div>

              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs text-slate-300">
                  <thead class="bg-black/40 text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/10">
                    <tr>
                      <th class="p-3">Pedido</th>
                      <th class="p-3">Cliente</th>
                      <th class="p-3">Dirección</th>
                      <th class="p-3">Método Pago</th>
                      <th class="p-3">Monto</th>
                      <th class="p-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/5">
                    @for (order of orders(); track order.id) {
                      <tr class="hover:bg-white/5">
                        <td class="p-3 font-mono font-bold text-white">#{{ getCodeNum(order.codigoSeguimiento) }}</td>
                        <td class="p-3 font-bold">{{ order.cliente.nombre }}</td>
                        <td class="p-3 text-slate-400">{{ order.cliente.direccion }}</td>
                        <td class="p-3 font-mono text-sky-400">{{ order.metodoPago || 'CONTRAENTREGA' }}</td>
                        <td class="p-3 font-display font-bold text-polleria-gold">{{ order.total | currencyPEN }}</td>
                        <td class="p-3">
                          <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                            <svg class="w-3.5 h-3.5 inline mr-1 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>Entregado
                          </span>
                        </td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="6" class="p-8 text-center text-slate-500">
                          Aún no se han completado entregas en este turno.
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>

          </main>
  `
})
export class DeliveryHistoryComponent {
  readonly orders = input.required<Order[]>();
  readonly getCodeNum = getCodeNum;
}
