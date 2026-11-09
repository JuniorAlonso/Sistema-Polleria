import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BackendLiquidacionResponse } from '../../../core/models/api-contracts.model';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';

@Component({
  selector: 'app-cajero-recarga-fondo-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPENPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="w-full max-w-md bg-[#14161a] border border-white/15 rounded-3xl p-6 shadow-2xl space-y-4">
        <div>
          <h3 class="font-display text-xl font-bold text-white">Recargar Fondo de Vueltos</h3>
          <p class="text-xs text-slate-400">
            Repartidor: <strong class="text-white">{{ liquidacion()?.repartidorNombre }}</strong> · Liq #{{ liquidacion()?.id }}
          </p>
        </div>

        <div class="space-y-3 text-xs">
          <!-- Fondo actual -->
          <div class="p-3 rounded-xl bg-white/5 flex justify-between items-center">
            <span class="text-slate-400 font-bold">Fondo Actual:</span>
            <span class="font-mono text-sm font-bold text-polleria-gold">
              {{ (liquidacion()?.fondoInicial || 0) | currencyPEN }}
            </span>
          </div>

          <!-- Monto adicional -->
          <div>
            <label class="block text-slate-300 font-bold mb-1">Monto a Entregar (S/):</label>
            <input
              type="number"
              step="5"
              min="0.50"
              [(ngModel)]="monto"
              class="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-white font-mono font-bold text-sm focus:outline-none focus:ring-1 focus:ring-polleria-gold"
            />

            <!-- Atajos rápidos -->
            <div class="flex items-center gap-1.5 mt-2">
              <span class="text-[10px] text-slate-400 font-bold">Atajos:</span>
              <button
                type="button"
                (click)="monto.set(20)"
                class="px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer"
                [ngClass]="monto() === 20 ? 'bg-sky-600 text-white border-sky-400' : 'bg-white/10 text-slate-200 border-white/10 hover:bg-white/15'"
              >
                + S/ 20
              </button>
              <button
                type="button"
                (click)="monto.set(30)"
                class="px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer"
                [ngClass]="monto() === 30 ? 'bg-sky-600 text-white border-sky-400' : 'bg-white/10 text-slate-200 border-white/10 hover:bg-white/15'"
              >
                + S/ 30
              </button>
              <button
                type="button"
                (click)="monto.set(50)"
                class="px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer"
                [ngClass]="monto() === 50 ? 'bg-sky-600 text-white border-sky-400' : 'bg-white/10 text-slate-200 border-white/10 hover:bg-white/15'"
              >
                + S/ 50
              </button>
            </div>
          </div>

          <!-- Nuevo fondo proyectado -->
          <div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex justify-between items-center text-xs">
            <span class="text-emerald-300 font-bold">Nuevo Fondo Total de Repartidor:</span>
            <span class="font-mono text-base font-black text-emerald-400">
              {{ nuevoFondoTotal() | currencyPEN }}
            </span>
          </div>

          <!-- Motivo -->
          <div>
            <label class="block text-slate-300 font-bold mb-1">Motivo / Detalle:</label>
            <input
              type="text"
              [(ngModel)]="motivo"
              placeholder="Ej: Se quedó sin monedas de 2 y 5 soles"
              class="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-white"
            />
          </div>
        </div>

        @if (montoInvalido()) {
          <p class="text-[11px] font-bold text-rose-300">
            El monto a recargar debe ser mayor a 0.
          </p>
        }

        <div class="flex justify-end gap-2 pt-3 border-t border-white/10">
          <button
            type="button"
            (click)="cancelar.emit()"
            class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs uppercase transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            (click)="confirmar.emit()"
            [disabled]="montoInvalido()"
            class="disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs uppercase transition cursor-pointer shadow-lg"
          >
            Confirmar Recarga
          </button>
        </div>
      </div>
    </div>
  `
})
export class CajeroRecargaFondoModalComponent {
  readonly liquidacion = input.required<BackendLiquidacionResponse | null>();
  readonly monto = model<number>(20);
  readonly motivo = model<string>('');

  readonly cancelar = output<void>();
  readonly confirmar = output<void>();

  readonly montoInvalido = computed(() => {
    const m = this.monto();
    return m === null || m === undefined || m <= 0;
  });

  readonly nuevoFondoTotal = computed(() => {
    const actual = this.liquidacion()?.fondoInicial || 0;
    const add = this.monto() || 0;
    return actual + add;
  });
}

