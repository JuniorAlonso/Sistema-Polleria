import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyPENPipe } from '../../../../shared/pipes/currency-pen.pipe';
import { MovimientoCaja } from '../../../../core/models/finance.model';

/** Flujo de movimientos de caja menor (RF20). Presentacional. */
@Component({
  selector: 'app-cash-movements-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CurrencyPENPipe],
  template: `
          <div class="bg-[#14161a] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
            <div class="p-4 border-b border-white/5 font-bold text-sm text-white flex justify-between items-center">
              <span>Flujo de Movimientos de Caja Menor (RF20)</span>
              <span class="text-xs text-slate-400 font-mono">{{ movimientos().length }} transacciones</span>
            </div>
            <table class="w-full text-left text-xs">
              <thead class="bg-black/40 border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th class="p-4">ID</th>
                  <th class="p-4">Concepto</th>
                  <th class="p-4">Tipo</th>
                  <th class="p-4">Monto</th>
                  <th class="p-4">Fecha y Hora</th>
                  <th class="p-4">Registrado Por</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5">
                @for (m of movimientos(); track m.id) {
                  <tr class="hover:bg-white/5 transition">
                    <td class="p-4 font-mono text-slate-400">#{{ m.id }}</td>
                    <td class="p-4 font-bold text-white">{{ m.concepto }}</td>
                    <td class="p-4">
                      <span 
                        class="px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                        [ngClass]="{
                          'bg-emerald-500/20 text-emerald-400': m.tipo === 'INGRESO' || m.tipo === 'VENTA_EFECTIVO' || m.tipo === 'VENTA_DIGITAL',
                          'bg-rose-500/20 text-rose-400': m.tipo === 'EGRESO' || m.tipo === 'REEMBOLSO'
                        }"
                      >
                        {{ m.tipo }}
                      </span>
                    </td>
                    <td class="p-4 font-mono font-bold" [ngClass]="m.tipo === 'EGRESO' || m.tipo === 'REEMBOLSO' ? 'text-rose-400' : 'text-emerald-400'">
                      {{ m.tipo === 'EGRESO' || m.tipo === 'REEMBOLSO' ? '-' : '+' }}{{ m.monto | currencyPEN }}
                    </td>
                    <td class="p-4 text-slate-400 font-mono">{{ m.fechaHora }}</td>
                    <td class="p-4 text-slate-300">{{ m.usuario }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
  `
})
export class CashMovementsTableComponent {
  readonly movimientos = input.required<MovimientoCaja[]>();
}
