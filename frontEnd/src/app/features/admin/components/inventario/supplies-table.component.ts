import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyPENPipe } from '../../../../shared/pipes/currency-pen.pipe';
import { Insumo } from '../../../../core/models/inventory.model';

/** Almacén central de insumos. Presentacional. */
@Component({
  selector: 'app-supplies-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CurrencyPENPipe],
  template: `
            <div class="space-y-4">
              <div class="flex justify-between items-center bg-[#1c1f24] p-4 rounded-xl border border-white/5">
                <div>
                  <h3 class="font-bold text-white flex items-center gap-2">
                    <span>Almacén Central de Insumos</span>
                  </h3>
                  <p class="text-xs text-slate-400">Control de stock de materias primas y despacho inmediato a cocina (inventory-service :8086).</p>
                </div>
                <button 
                  (click)="dispatchRequested.emit()"
                  class="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition shadow cursor-pointer"
                >
                  Despachar Lote a Cocina
                </button>
              </div>

              <div class="bg-[#14161a] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
                <table class="w-full text-left text-xs">
                  <thead class="bg-black/40 border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider">
                    <tr>
                      <th class="p-4">Insumo</th>
                      <th class="p-4">Categoría</th>
                      <th class="p-4">Stock Actual</th>
                      <th class="p-4">Stock Mínimo</th>
                      <th class="p-4">Costo Unit.</th>
                      <th class="p-4 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/5">
                    @for (ins of insumos(); track ins.id) {
                      <tr class="hover:bg-white/5 transition">
                        <td class="p-4 font-bold text-white">{{ ins.nombre }}</td>
                        <td class="p-4 text-slate-400">{{ ins.categoria }}</td>
                        <td class="p-4 font-mono font-bold" [ngClass]="ins.estado === 'CRITICO' ? 'text-rose-400' : 'text-slate-200'">
                          {{ ins.stockActual }} {{ ins.unidadMedida }}
                        </td>
                        <td class="p-4 text-slate-400 font-mono">{{ ins.stockMinimo }} {{ ins.unidadMedida }}</td>
                        <td class="p-4 font-mono text-slate-300">{{ ins.costoUnitario | currencyPEN }}</td>
                        <td class="p-4 text-center">
                          <span 
                            class="px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                            [ngClass]="{
                              'bg-emerald-500/20 text-emerald-400': ins.estado === 'OPTIMO',
                              'bg-amber-500/20 text-amber-300': ins.estado === 'BAJO',
                              'bg-rose-500/20 text-rose-400 animate-pulse': ins.estado === 'CRITICO'
                            }"
                          >
                            {{ ins.estado }}
                          </span>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
  `
})
export class SuppliesTableComponent {
  readonly insumos = input.required<Insumo[]>();

  readonly dispatchRequested = output<void>();
}
