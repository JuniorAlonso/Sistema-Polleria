import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Insumo, Merma } from '../../../../core/models/inventory.model';

/** Registro de mermas de jornada. Presentacional. */
@Component({
  selector: 'app-waste-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
            <div class="space-y-4">
              <div class="flex justify-between items-center bg-[#1c1f24] p-4 rounded-xl border border-white/5">
                <div>
                  <h3 class="font-bold text-white flex items-center gap-2">
                    <span>Registro de Mermas de Jornada</span>
                  </h3>
                  <p class="text-xs text-slate-400">Auditoría de descarte y control de costos por merma operativa.</p>
                </div>
                <button 
                  (click)="registerRequested.emit()"
                  class="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition shadow cursor-pointer"
                >
                  + Registrar Merma
                </button>
              </div>

              <div class="bg-[#14161a] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
                <table class="w-full text-left text-xs">
                  <thead class="bg-black/40 border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider">
                    <tr>
                      <th class="p-4">Fecha</th>
                      <th class="p-4">Insumo</th>
                      <th class="p-4">Cantidad</th>
                      <th class="p-4">Motivo</th>
                      <th class="p-4">Justificación</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/5">
                    @for (m of mermas(); track m.id) {
                      <tr class="hover:bg-white/5 transition">
                        <td class="p-4 font-mono text-slate-400">{{ m.fecha }}</td>
                        <td class="p-4 font-bold text-white">{{ m.insumoNombre }}</td>
                        <td class="p-4 font-mono text-rose-300 font-bold">{{ m.cantidad }} {{ unidadDeInsumo(m.insumoId) }}</td>
                        <td class="p-4 text-slate-300">{{ m.motivo.replace('_', ' ') }}</td>
                        <td class="p-4 text-slate-400">{{ m.justificacion || '—' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
  `
})
export class WasteTableComponent {
  readonly mermas = input.required<Merma[]>();
  readonly insumos = input.required<Insumo[]>();

  readonly registerRequested = output<void>();

  /** Unidad de medida real del insumo (MermaResponse no la incluye). */
  protected unidadDeInsumo(insumoId: number): string {
    return this.insumos().find(i => i.id === insumoId)?.unidadMedida ?? '';
  }
}
