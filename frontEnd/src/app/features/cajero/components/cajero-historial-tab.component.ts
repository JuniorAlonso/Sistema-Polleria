import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { CobroDelDia } from '../models/cajero.models';
import { claseMetodoCobro, formatearMetodoCobro } from '../models/cobro-metodo.helpers';

@Component({
  selector: 'app-cajero-historial-tab',
  standalone: true,
  imports: [CommonModule, CurrencyPENPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
            <div class="p-5 rounded-2xl bg-[#14161a] border border-white/10 space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="font-bold text-sm text-white uppercase tracking-wider">
                    Cobros Registrados en este Turno
                  </h3>
                  <p class="text-xs text-slate-400">
                    Comprobantes emitidos y pagos confirmados por el cajero
                  </p>
                </div>
                <div class="text-right">
                  <span class="text-[10px] text-slate-400 uppercase font-bold block">Total Recaudado</span>
                  <span class="font-display text-xl text-emerald-400 font-bold">
                    {{ totalCobrado() | currencyPEN }}
                  </span>
                </div>
              </div>

              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs">
                  <thead>
                    <tr class="border-b border-white/10 text-slate-400 uppercase text-[10px] tracking-wider font-extrabold">
                      <th class="py-2.5 px-3">Hora</th>
                      <th class="py-2.5 px-3">Orden</th>
                      <th class="py-2.5 px-3">Cliente</th>
                      <th class="py-2.5 px-3">Tipo</th>
                      <th class="py-2.5 px-3">Método</th>
                      <th class="py-2.5 px-3">Monto</th>
                      <th class="py-2.5 px-3">Referencia</th>
                      <th class="py-2.5 px-3 text-right">Comprobante</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/5 font-medium">
                    @for (cobro of cobros(); track cobro.id) {
                      <tr class="hover:bg-white/5 transition">
                        <td class="py-2.5 px-3 font-mono text-slate-400">
                          {{ cobro.fechaHora | date:'shortTime' }}
                        </td>
                        <td class="py-2.5 px-3 font-mono font-bold text-white">
                          #{{ cobro.codigoOrden }}
                        </td>
                        <td class="py-2.5 px-3 text-slate-200">
                          {{ cobro.clienteNombre }}
                        </td>
                        <td class="py-2.5 px-3 text-[11px] text-slate-400">
                          {{ cobro.tipoOrden }}
                        </td>
                        <td class="py-2.5 px-3">
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                            [ngClass]="claseMetodoCobro(cobro.metodo)"
                          >
                            {{ formatearMetodoCobro(cobro.metodo) }}
                          </span>
                        </td>
                        <td class="py-2.5 px-3 font-mono font-bold text-polleria-gold">
                          {{ cobro.monto | currencyPEN }}
                        </td>
                        <td class="py-2.5 px-3 font-mono text-[11px] text-slate-400 truncate max-w-[120px]">
                          {{ cobro.referencia || 'N/A' }}
                        </td>
                        <td class="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            (click)="reimprimir.emit(cobro)"
                            class="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white text-[11px] font-bold transition cursor-pointer"
                          >
                            Ticket
                          </button>
                        </td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="8" class="py-8 text-center text-slate-500">
                          Aún no se han registrado cobros en esta sesión.
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
  `
})
export class CajeroHistorialTabComponent {
  readonly cobros = input.required<CobroDelDia[]>();
  readonly totalCobrado = input<number>(0);

  readonly reimprimir = output<CobroDelDia>();

  readonly formatearMetodoCobro = formatearMetodoCobro;
  readonly claseMetodoCobro = claseMetodoCobro;
}
