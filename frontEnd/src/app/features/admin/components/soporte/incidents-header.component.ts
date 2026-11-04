import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Cabecera de Soporte con el botón para documentar un incidente. Presentacional. */
@Component({
  selector: 'app-incidents-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
          <div class="flex justify-between items-center bg-[#14161a] p-4 rounded-2xl border border-white/10 shadow-lg">
            <div>
              <h2 class="text-2xl font-bold text-white flex items-center gap-2">
                <span>Centro de Soporte, Incidentes & Seguridad</span>
              </h2>
              <p class="text-xs text-slate-400">Bitácora de incidentes operativos (:8088) y control de IPs bloqueadas en auth-service (:8081).</p>
            </div>
            <button 
              (click)="documentRequested.emit()"
              class="px-4 py-2 bg-polleria-crimson hover:bg-polleria-crimsonHover text-white font-bold text-xs rounded-xl transition shadow cursor-pointer"
            >
              + Documentar Incidente
            </button>
          </div>
  `
})
export class IncidentsHeaderComponent {
  readonly documentRequested = output<void>();
}
