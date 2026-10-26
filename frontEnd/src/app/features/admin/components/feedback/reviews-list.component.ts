import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Resenia } from '../../../../core/models/feedback.model';

/** Reseñas y calificaciones recientes de la experiencia. Presentacional. */
@Component({
  selector: 'app-reviews-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
          <div class="space-y-4 pt-4 border-t border-white/10">
            <h3 class="font-display text-lg text-white font-bold flex items-center gap-2">
              <span>Reseñas Recientes de Clientes</span>
            </h3>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              @for (item of resenias(); track item.id) {
                <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 space-y-2">
                  <div class="flex justify-between items-center">
                    <span class="text-xs font-mono text-slate-400">Orden #{{ item.ordenId }}</span>
                    <div class="text-polleria-gold text-sm font-bold">
                      {{ '★'.repeat(item.estrellas || 5) }}{{ '☆'.repeat(5 - (item.estrellas || 5)) }}
                    </div>
                  </div>
                  <p class="text-xs text-slate-300 italic">"{{ item.comentario }}"</p>
                  <p class="text-[11px] text-slate-500 font-mono text-right">{{ item.fecha }}</p>
                </div>
              }
            </div>
          </div>
  `
})
export class ReviewsListComponent {
  readonly resenias = input.required<Resenia[]>();
}
