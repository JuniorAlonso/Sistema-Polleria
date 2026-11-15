import { ChangeDetectionStrategy, Component, OnInit, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ArqueoCaja } from '../../../../core/models/finance.model';
import { CierreCajaForm } from '../../models/admin-forms';

/** Draft of the close form: the counted cash starts empty (blind count, D3.12). */
export interface CierreCajaDraft {
  efectivoReal: number | null;
  observaciones: string;
}

/**
 * Modal de arqueo y cierre de caja. Presentacional: edita un borrador local y lo emite.
 * Arqueo ciego (D3.12): no muestra el efectivo esperado ni la diferencia antes de confirmar.
 */
@Component({
  selector: 'app-cash-close-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div class="w-full max-w-md bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100 animate-scale-up">
            <div class="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 class="font-display text-xl font-bold text-emerald-400">Arqueo y Cierre de Turno (RF22)</h3>
              <button (click)="closed.emit()" class="text-slate-400 hover:text-white cursor-pointer" aria-label="Cerrar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>

            <div class="space-y-3 text-xs">
              <p class="text-slate-400">
                Cuenta el efectivo de la gaveta e ingresa el monto. El sistema lo comparará con lo esperado al confirmar.
              </p>

              <div>
                <label for="cash-close-count" class="block font-bold text-slate-300 mb-1">Efectivo Real Contado en Gaveta (S/):</label>
                <input
                  id="cash-close-count"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  [ngModel]="efectivoReal()"
                  (ngModelChange)="efectivoReal.set($event)"
                  placeholder="0.00"
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono text-base focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
                @if (montoNegativo()) {
                  <p class="mt-1 text-[11px] font-bold text-amber-300">El efectivo contado no puede ser negativo.</p>
                }
              </div>

              <div>
                <label for="cash-close-notes" class="block font-bold text-slate-300 mb-1">Observaciones del Cierre:</label>
                <input
                  id="cash-close-notes"
                  type="text"
                  [ngModel]="observaciones()"
                  (ngModelChange)="observaciones.set($event)"
                  placeholder="Indica el motivo si hay alguna diferencia..."
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>

              @if (errorMessage()) {
                <p data-testid="cash-close-error" class="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-[11px] font-bold text-amber-300">
                  {{ errorMessage() }}
                </p>
              }
            </div>

            <div class="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button (click)="closed.emit()" class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold cursor-pointer">Cancelar</button>
              <button
                (click)="confirmar()"
                [disabled]="!montoValido() || procesando()"
                class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >{{ procesando() ? 'Cerrando...' : 'Cerrar y Cuadrar Caja' }}</button>
            </div>
          </div>
        </div>
  `
})
export class CashCloseModalComponent implements OnInit {
  readonly cajaActual = input.required<ArqueoCaja | null>();
  readonly initial = input.required<CierreCajaDraft>();
  /** Backend message of the last failed close (for example, a difference without a reason). */
  readonly errorMessage = input<string | null>(null);
  readonly procesando = input<boolean>(false);

  readonly closed = output<void>();
  readonly confirmed = output<CierreCajaForm>();

  protected readonly efectivoReal = signal<number | null>(null);
  protected readonly observaciones = signal('');

  protected readonly montoNegativo = computed(() => {
    const monto = this.efectivoReal();
    return typeof monto === 'number' && monto < 0;
  });

  protected readonly montoValido = computed(() => {
    const monto = this.efectivoReal();
    return typeof monto === 'number' && Number.isFinite(monto) && monto >= 0;
  });

  ngOnInit(): void {
    this.efectivoReal.set(this.initial().efectivoReal);
    this.observaciones.set(this.initial().observaciones);
  }

  protected confirmar(): void {
    const monto = this.efectivoReal();
    if (!this.montoValido() || monto === null) return;
    this.confirmed.emit({ efectivoReal: monto, observaciones: this.observaciones().trim() });
  }
}
