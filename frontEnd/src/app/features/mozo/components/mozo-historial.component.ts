import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { Order } from '../../../core/models/order.model';
import { getCodeNum, horaDe, resumenItems } from '../mozo.helpers';

@Component({
  selector: 'app-mozo-historial',
  standalone: true,
  imports: [CurrencyPENPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block space-y-6' },
  template: `
            
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 shadow">
                <span class="text-xs text-slate-400 font-medium">Mesas Atendidas Hoy</span>
                <p class="font-display text-3xl font-black text-white mt-1">{{ mesasAtendidasHoy() }}</p>
              </div>
              <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 shadow">
                <span class="text-xs text-slate-400 font-medium">Total Cobrado en Turno</span>
                <p class="font-display text-3xl font-black text-polleria-gold mt-1">{{ totalCobradoTurno() | currencyPEN }}</p>
              </div>
              <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 shadow">
                <span class="text-xs text-slate-400 font-medium">Comandas de Salón Activas</span>
                <p class="font-display text-3xl font-black text-emerald-400 mt-1">{{ comandasActivasSalon() }}</p>
              </div>
            </div>

            <!-- Cobros Realizados Table -->
            <div class="bg-[#14161a] rounded-2xl border border-white/10 overflow-hidden shadow">
              <div class="p-4 border-b border-white/10 flex justify-between items-center">
                <h3 class="text-sm font-bold text-white">Transacciones y Cierres de Mesa de Salón</h3>
                <span class="text-xs text-slate-400">Turno Almuerzo / Cena</span>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs text-slate-300">
                  <thead class="bg-black/40 text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/10">
                    <tr>
                      <th class="p-3">Mesa</th>
                      <th class="p-3">Comanda / Detalle</th>
                      <th class="p-3">Total</th>
                      <th class="p-3">Hora</th>
                      <th class="p-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/5">
                    @for (o of historialSalon(); track o.id) {
                      <tr class="hover:bg-white/5">
                        <td class="p-3 font-bold text-white">Mesa {{ o.cliente.mesaNumero ?? '—' }}</td>
                        <td class="p-3">#{{ getCodeNum(o.codigoSeguimiento) }} · {{ resumenItems(o) }}</td>
                        <td class="p-3 font-display font-bold text-polleria-gold">{{ o.total | currencyPEN }}</td>
                        <td class="p-3 text-slate-400">{{ horaDe(o.updatedAt) }}</td>
                        <td class="p-3"><span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">Cerrada</span></td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="5" class="p-6 text-center text-slate-500">Todavía no hay comandas cerradas en este turno.</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>

  `
})
export class MozoHistorialComponent {
  readonly historialSalon = input.required<Order[]>();
  readonly mesasAtendidasHoy = input.required<number>();
  readonly totalCobradoTurno = input.required<number>();
  readonly comandasActivasSalon = input.required<Order[]>();

  readonly resumenItems = resumenItems;
  readonly horaDe = horaDe;
  readonly getCodeNum = getCodeNum;
}
