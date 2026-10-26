import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Incidente } from '../../../../core/models/incident.model';

/** Bitácora de incidentes. Presentacional. */
@Component({
  selector: 'app-incidents-log',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
          <div class="space-y-4">
            <h3 class="font-display text-lg text-white font-bold">Bitácora de Incidentes Operativos</h3>
            <div class="space-y-4">
              @for (inc of incidentes(); track inc.id) {
                <div class="p-5 rounded-2xl bg-[#14161a] border border-white/10 space-y-3 shadow-lg">
                  <div class="flex justify-between items-start">
                    <div class="flex items-center gap-3">
                      <span class="font-mono text-xs px-2 py-0.5 rounded bg-white/10 text-polleria-gold font-bold">
                        INC-{{ inc.id }}
                      </span>
                      <h3 class="font-bold text-base text-white">{{ inc.titulo }}</h3>
                    </div>
                    <span 
                      class="px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                      [ngClass]="inc.estado === 'RESUELTO' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'"
                    >
                      {{ inc.estado }}
                    </span>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-black/30 p-3 rounded-xl border border-white/5">
                    <div>
                      <span class="text-slate-500 font-bold block mb-0.5">CAUSA RAÍZ:</span>
                      <p class="text-slate-300">{{ inc.causaRaiz }}</p>
                    </div>
                    <div>
                      <span class="text-slate-500 font-bold block mb-0.5">SOLUCIÓN APLICADA:</span>
                      <p class="text-emerald-300 font-medium">{{ inc.solucionAplicada }}</p>
                    </div>
                  </div>

                  <div class="flex justify-between items-center text-[11px] text-slate-400 font-mono pt-1">
                    <span>Módulo: {{ inc.modulo }} • Severidad: {{ inc.severidad }}</span>
                    <span>Reportado por: {{ inc.reportadoPor }} • {{ inc.fechaHora }}</span>
                  </div>
                </div>
              }
            </div>
          </div>
  `
})
export class IncidentsLogComponent {
  readonly incidentes = input.required<Incidente[]>();
}
