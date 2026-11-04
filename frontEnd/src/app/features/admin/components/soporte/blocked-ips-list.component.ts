import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IpBloqueada } from '../../../../core/models/incident.model';

/** Auditoría de seguridad: IPs bloqueadas (RNF02). Presentacional. */
@Component({
  selector: 'app-blocked-ips-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
          <div class="space-y-4 pt-4 border-t border-white/10">
            <div class="flex justify-between items-center">
              <div>
                <h3 class="font-display text-lg text-white font-bold flex items-center gap-2">
                  <span>Lista Negra de Seguridad & IPs Bloqueadas</span>
                </h3>
                <p class="text-xs text-slate-400">Protección contra ataques de fuerza bruta y accesos no autorizados.</p>
              </div>
            </div>

            <div class="bg-[#14161a] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
              <table class="w-full text-left text-xs">
                <thead class="bg-black/40 border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider">
                  <tr>
                    <th class="p-4">Dirección IP</th>
                    <th class="p-4">Motivo de Bloqueo</th>
                    <th class="p-4">Intentos Fallidos</th>
                    <th class="p-4">Fecha Bloqueo</th>
                    <th class="p-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  @for (ipItem of ipsBloqueadas(); track ipItem.ip) {
                    <tr class="hover:bg-white/5 transition">
                      <td class="p-4 font-mono font-bold text-rose-400">{{ ipItem.ip }}</td>
                      <td class="p-4 text-slate-300">{{ ipItem.motivo }}</td>
                      <td class="p-4 font-mono text-amber-400">{{ ipItem.intentosFallidos }}</td>
                      <td class="p-4 font-mono text-slate-400">{{ ipItem.fechaBloqueo }}</td>
                      <td class="p-4 text-center">
                        <button 
                          (click)="unblockRequested.emit(ipItem.ip)"
                          class="px-3 py-1 bg-white/10 hover:bg-emerald-600 hover:text-white rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          Desbloquear IP
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
  `
})
export class BlockedIpsListComponent {
  readonly ipsBloqueadas = input.required<IpBloqueada[]>();

  readonly unblockRequested = output<string>();
}
