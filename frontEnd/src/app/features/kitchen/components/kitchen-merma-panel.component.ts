import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Merma } from '../../../core/models/inventory.model';

@Component({
  selector: 'app-kitchen-merma-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
          <main class="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">

            <div class="bg-[#14161a] p-5 rounded-2xl border border-white/10 shadow flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h2 class="text-xl font-bold text-white flex items-center gap-2">
                  <span>Registro de Mermas de Insumos Perecibles</span>
                </h2>
                <p class="text-xs text-slate-400">Declaración de productos no vendidos, mermas de cocción y descartes para cruce con finanzas e inventario.</p>
              </div>

              <button
                (click)="registrarMerma.emit()"
                class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition cursor-pointer shadow"
              >
                + Registrar Merma de Cierre
              </button>
            </div>

            <div class="bg-[#14161a] rounded-2xl border border-white/10 overflow-hidden shadow">
              <div class="p-4 border-b border-white/10 flex justify-between items-center">
                <h3 class="text-sm font-bold text-white">Mermas Declaradas de la Jornada</h3>
              </div>

              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs text-slate-300">
                  <thead class="bg-black/40 text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/10">
                    <tr>
                      <th class="p-3">Insumo</th>
                      <th class="p-3">Cantidad Merma</th>
                      <th class="p-3">Motivo</th>
                      <th class="p-3">Justificación</th>
                      <th class="p-3">Fecha y hora</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/5">
                    @for (m of mermas(); track m.id) {
                      <tr class="hover:bg-white/5">
                        <td class="p-3 font-bold text-white">{{ m.insumoNombre }}</td>
                        <td class="p-3 font-mono text-rose-300">{{ m.cantidad }}</td>
                        <td class="p-3 text-slate-300">{{ m.motivo }}</td>
                        <td class="p-3 text-slate-400">{{ m.justificacion || '—' }}</td>
                        <td class="p-3 text-slate-400">{{ m.fecha | date:'short' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>

          </main>
  `
})
export class KitchenMermaPanelComponent {
  readonly mermas = input.required<Merma[]>();
  readonly registrarMerma = output<void>();
}
