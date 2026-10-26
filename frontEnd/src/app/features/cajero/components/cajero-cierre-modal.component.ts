import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';

@Component({
  selector: 'app-cajero-cierre-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPENPipe],
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
              <!-- Comparativa de saldo esperado -->
              <div class="p-3.5 rounded-2xl bg-black/40 border border-white/10 flex justify-between items-center text-xs">
                <span class="text-slate-400">Saldo Teórico Esperado en Gaveta:</span>
                <span class="font-display text-xl text-polleria-gold font-bold">
                  {{ saldoTeorico() | currencyPEN }}
                </span>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Efectivo Contado en Gaveta (S/) *
                </label>
                <input
                  type="number"
                  [(ngModel)]="efectivo"
                  step="0.50"
                  min="0"
                  placeholder="0.00"
                  class="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-xl text-lg font-bold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <!-- Diferencia en vivo -->
              <div class="p-3 rounded-xl flex items-center justify-between border"
                [ngClass]="{
                  'bg-emerald-950/20 border-emerald-500/30 text-emerald-300': diferencia() === 0,
                  'bg-sky-950/20 border-sky-500/30 text-sky-300': diferencia() > 0,
                  'bg-rose-950/20 border-rose-500/30 text-rose-300': diferencia() < 0
                }"
              >
                <span class="text-xs font-bold uppercase tracking-wider">
                  @if (diferencia() === 0) {
                    Cuadre Exacto:
                  } @else if (diferencia() > 0) {
                    Sobrante en Caja:
                  } @else {
                    Faltante en Caja:
                  }
                </span>
                <span class="font-mono text-base font-bold">
                  {{ diferencia() | currencyPEN }}
                </span>
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
                    Ventas Yape / Plin (S/)
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
                  Observaciones de Cierre (Opcional)
                </label>
                <textarea
                  [(ngModel)]="observaciones"
                  rows="2"
                  placeholder="Detalles sobre billetes o diferencias justificadas..."
                  class="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-xs text-white"
                ></textarea>
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
                (click)="confirmar.emit()"
                [disabled]="efectivo() < 0 || procesando()"
                class="px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold uppercase disabled:opacity-50"
              >
                Confirmar Cierre de Turno
              </button>
            </div>
          </div>
        </div>
  `
})
export class CajeroCierreModalComponent {
  readonly saldoTeorico = input<number>(0);
  readonly diferencia = input<number>(0);
  readonly procesando = input<boolean>(false);

  readonly efectivo = model<number>(0);
  readonly pos = model<number>(0);
  readonly digitales = model<number>(0);
  readonly observaciones = model<string>('');

  readonly cancelar = output<void>();
  readonly confirmar = output<void>();
}
