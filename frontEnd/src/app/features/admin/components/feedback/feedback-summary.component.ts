import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Cabecera de Feedback: promedio de estrellas, reseñas y reclamos pendientes. Presentacional. */
@Component({
  selector: 'app-feedback-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
            <div class="flex items-center gap-3">
              <div class="flex items-center gap-2 bg-black/40 px-4 py-2 rounded-xl border border-white/10">
                <span class="text-polleria-gold text-lg">★</span>
                <span class="font-bold text-white">{{ promedioEstrellas() }} / 5.0</span>
                <span class="text-xs text-slate-400 font-mono">({{ reseniasCount() }} reseñas)</span>
              </div>
              <span class="px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold">
                {{ pendientesCount() }} Reclamos Pendientes
              </span>
            </div>
  `
})
export class FeedbackSummaryComponent {
  readonly promedioEstrellas = input.required<string>();
  readonly reseniasCount = input.required<number>();
  readonly pendientesCount = input.required<number>();
}
