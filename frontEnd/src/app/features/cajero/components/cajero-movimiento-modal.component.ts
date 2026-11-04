import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TipoMovimiento } from '../../../core/models/finance.model';

@Component({
  selector: 'app-cajero-movimiento-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
        <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="w-full max-w-md bg-[#14161a] border border-white/15 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 class="font-display text-xl text-white font-bold tracking-wide">
              REGISTRAR MOVIMIENTO DE CAJA
            </h3>

            <div class="space-y-3">
              <div>
                <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Tipo de Movimiento
                </label>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    (click)="tipo.set('INGRESO')"
                    class="py-2.5 rounded-xl border text-xs font-bold uppercase tracking-wider transition cursor-pointer"
                    [ngClass]="tipo() === 'INGRESO' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-black/30 border-white/10 text-slate-400'"
                  >
                    + Ingreso
                  </button>
                  <button
                    type="button"
                    (click)="tipo.set('EGRESO')"
                    class="py-2.5 rounded-xl border text-xs font-bold uppercase tracking-wider transition cursor-pointer"
                    [ngClass]="tipo() === 'EGRESO' ? 'bg-rose-500/20 border-rose-500 text-rose-300' : 'bg-black/30 border-white/10 text-slate-400'"
                  >
                    - Egreso / Retiro
                  </button>
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Monto (S/) *
                </label>
                <input
                  type="number"
                  [(ngModel)]="monto"
                  step="0.50"
                  min="0.10"
                  placeholder="0.00"
                  class="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-xl text-lg font-bold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Concepto / Motivo *
                </label>
                <input
                  type="text"
                  [(ngModel)]="motivo"
                  placeholder="Ej: Cambio para vuelto, compra de bolsas..."
                  class="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                (click)="cancelar.emit()"
                class="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold uppercase"
              >
                Cancelar
              </button>
              <button
                type="button"
                (click)="guardar.emit()"
                [disabled]="monto() <= 0 || !motivo() || procesando()"
                class="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold uppercase disabled:opacity-50"
              >
                Guardar Movimiento
              </button>
            </div>
          </div>
        </div>
  `
})
export class CajeroMovimientoModalComponent {
  readonly procesando = input<boolean>(false);

  readonly tipo = model<TipoMovimiento>('EGRESO');
  readonly monto = model<number>(0);
  readonly motivo = model<string>('');

  readonly cancelar = output<void>();
  readonly guardar = output<void>();
}
