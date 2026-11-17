import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-cajero-cierre-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
        <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="w-full max-w-lg bg-[#14161a] border border-white/15 rounded-3xl p-6 shadow-2xl space-y-5">
            <div>
              <h3 class="font-display text-2xl text-white font-bold tracking-wide">
                CIERRE DE CAJA & CUADRE DE ARQUEO
              </h3>
              <p class="text-xs text-slate-400">
                Cuenta el efectivo físico en gaveta e ingresa los totales para conciliar.
              </p>
            </div>

            <div class="space-y-4">
              <!-- Blind count: the expected amount and the difference are only known after confirming -->
              <div>
                <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Efectivo Contado en Gaveta (S/) *
                </label>
                <input
                  data-testid="cierre-efectivo"
                  type="number"
                  [(ngModel)]="efectivo"
                  step="0.50"
                  min="0"
                  placeholder="Cuenta e ingresa el total"
                  class="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-xl text-lg font-bold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Ventas Tarjeta POS (S/)
                  </label>
                  <input
                    type="number"
                    [(ngModel)]="pos"
                    placeholder="0.00"
                    class="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Ventas Mercado Pago (S/)
                  </label>
                  <input
                    type="number"
                    [(ngModel)]="digitales"
                    placeholder="0.00"
                    class="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  @if (motivoObligatorio()) {
                    Motivo de la Diferencia *
                  } @else {
                    Observaciones de Cierre (Opcional)
                  }
                </label>
                <textarea
                  data-testid="cierre-observaciones"
                  [(ngModel)]="observaciones"
                  rows="2"
                  placeholder="Detalles sobre billetes o diferencias justificadas..."
                  class="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-xs text-white"
                ></textarea>
              </div>
            </div>

            @if (error()) {
              <p data-testid="cierre-error" class="text-[11px] font-bold text-rose-300">
                {{ error() }}
              </p>
            }

            @if (!procesando() && efectivoNegativo()) {
              <p data-testid="cierre-bloqueo" class="text-[11px] font-bold text-amber-300">
                El efectivo contado no puede ser negativo.
              </p>
            }

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                (click)="cancelar.emit()"
                class="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold uppercase transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                (click)="confirmar.emit()"
                [disabled]="!puedeConfirmar()"
                class="px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold uppercase disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
              >
                {{ procesando() ? 'Cerrando caja…' : 'Confirmar Cierre de Turno' }}
              </button>
            </div>
          </div>
        </div>
  `
})
export class CajeroCierreModalComponent {
  readonly procesando = input<boolean>(false);
  /** Backend message of the last failed close attempt. */
  readonly error = input<string | null>(null);
  /** Set after the backend rejected a difference without reason: observaciones becomes mandatory. */
  readonly motivoObligatorio = input<boolean>(false);

  /** Counted cash; null until the cashier types it (blind count). */
  readonly efectivo = model<number | null>(null);
  readonly pos = model<number>(0);
  readonly digitales = model<number>(0);
  readonly observaciones = model<string>('');

  readonly cancelar = output<void>();
  readonly confirmar = output<void>();

  protected readonly efectivoNegativo = computed(() => (this.efectivo() ?? 0) < 0);

  protected readonly puedeConfirmar = computed(() => {
    const efectivo = this.efectivo();
    if (this.procesando() || efectivo === null || efectivo === undefined || `${efectivo}` === '' || efectivo < 0) {
      return false;
    }
    return !this.motivoObligatorio() || !!this.observaciones()?.trim();
  });
}
