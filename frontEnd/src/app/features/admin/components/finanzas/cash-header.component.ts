import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ArqueoCaja } from '../../../../core/models/finance.model';

/** Cabecera de Finanzas con las acciones de caja según el estado del turno. Presentacional. */
@Component({
  selector: 'app-cash-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
          <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-[#14161a] p-4 rounded-2xl border border-white/10 shadow-lg">
            <div>
              <h2 class="text-2xl font-bold text-white flex items-center gap-2">
                <span>Finanzas, Caja Central & Arqueo</span>
              </h2>
              <p class="text-xs text-slate-400">Arqueo con discrepancia, flujo de caja menor y conciliación diaria (finance-service :8087).</p>
            </div>

            <div class="flex items-center gap-2">
              @if (cajaActual()?.estado === 'ABIERTA') {
                <button 
                  (click)="movementRequested.emit()"
                  class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  + Movimiento Caja Menor
                </button>
                <button 
                  (click)="closeRequested.emit()"
                  class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow cursor-pointer"
                >
                  Arqueo y Cierre de Turno
                </button>
              } @else {
                <button 
                  (click)="openRequested.emit()"
                  class="px-4 py-2 bg-polleria-gold hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition shadow cursor-pointer"
                >
                  Abrir Turno de Caja
                </button>
              }
            </div>
          </div>
  `
})
export class CashHeaderComponent {
  readonly cajaActual = input.required<ArqueoCaja | null>();

  readonly movementRequested = output<void>();
  readonly closeRequested = output<void>();
  readonly openRequested = output<void>();
}
