import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DespachoLoteInsumo } from '../data/kitchen-supplies.mock';

@Component({
  selector: 'app-kitchen-supply-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
          <main class="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">

            <div class="bg-[#14161a] p-5 rounded-2xl border border-white/10 shadow flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h2 class="text-xl font-bold text-white flex items-center gap-2">
                  <span>Solicitud y Control de Lotes de Insumos hacia Cocina</span>
                </h2>
                <p class="text-xs text-slate-400">Registro de transferencia de materia prima perecible desde Almacén Central hacia la zona de producción.</p>
              </div>

              <button
                (click)="solicitarLote.emit()"
                class="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition cursor-pointer shadow"
              >
                + Solicitar Lote de Insumo
              </button>
            </div>

            <div class="bg-[#14161a] rounded-2xl border border-white/10 overflow-hidden shadow">
              <div class="p-4 border-b border-white/10 flex justify-between items-center">
                <h3 class="text-sm font-bold text-white">Lotes de Producción del Día</h3>
                <span class="text-xs text-slate-400">Turno Actual</span>
              </div>

              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs text-slate-300">
                  <thead class="bg-black/40 text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/10">
                    <tr>
                      <th class="p-3">Código Lote</th>
                      <th class="p-3">Insumo</th>
                      <th class="p-3">Cantidad</th>
                      <th class="p-3">Solicitante</th>
                      <th class="p-3">Hora Despacho</th>
                      <th class="p-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/5">
                    @for (d of despachos(); track d.id) {
                      <tr class="hover:bg-white/5">
                        <td class="p-3 font-mono font-bold text-amber-400">{{ d.codigoLote }}</td>
                        <td class="p-3 font-bold text-white">{{ d.insumo }}</td>
                        <td class="p-3 font-mono">{{ d.cantidad }}</td>
                        <td class="p-3 text-slate-400">{{ d.solicitadoPor }}</td>
                        <td class="p-3 text-slate-400">{{ d.hora }}</td>
                        <td class="p-3">
                          <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                            {{ d.estado }}
                          </span>
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
export class KitchenSupplyPanelComponent {
  readonly despachos = input.required<DespachoLoteInsumo[]>();
  readonly solicitarLote = output<void>();
}
