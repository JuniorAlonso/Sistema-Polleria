import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { BackendLiquidacionResponse } from '../../../core/models/api-contracts.model';

@Component({
  selector: 'app-cajero-cierre-liquidacion-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPENPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
        <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="w-full max-w-md bg-[#14161a] border border-white/15 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 class="font-display text-xl font-bold text-white">Rendir Efectivo de Repartidor</h3>
            <div class="p-3 rounded-xl bg-black/40 border border-white/10 text-xs space-y-1">
              <p class="text-slate-300">Repartidor: <strong class="text-white">{{ liquidacion()?.repartidorNombre }}</strong></p>
              <p class="text-slate-300">Fondo Inicial: <strong class="text-polleria-gold">{{ (liquidacion()?.fondoInicial || 0) | currencyPEN }}</strong></p>
              <p class="text-slate-300">Cobrado en Ruta: <strong class="text-emerald-400">{{ (liquidacion()?.totalCobradoEfectivo || 0) | currencyPEN }}</strong></p>
              <p class="text-slate-200 font-bold border-t border-white/10 pt-1">Total Esperado: {{ ((liquidacion()?.fondoInicial || 0) + (liquidacion()?.totalCobradoEfectivo || 0)) | currencyPEN }}</p>
            </div>
            <div class="space-y-1 text-xs">
              <label class="block text-slate-300 font-bold mb-1">Efectivo Físico Entregado por Repartidor (S/):</label>
              <input type="number" [(ngModel)]="totalRendido" min="0" step="1" class="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-white font-mono text-lg font-bold focus:outline-none focus:border-emerald-500" />
            </div>

            <!-- Diferencia en vivo de la liquidación -->
            @let dif = diferencia;
            <div class="p-3 rounded-xl flex items-center justify-between border"
              [ngClass]="{
                'bg-emerald-950/20 border-emerald-500/30 text-emerald-300': dif === 0,
                'bg-sky-950/20 border-sky-500/30 text-sky-300': dif > 0,
                'bg-rose-950/20 border-rose-500/30 text-rose-300': dif < 0
              }"
            >
              <span class="text-xs font-bold uppercase tracking-wider">
                @if (dif === 0) {
                  Cuadre Exacto:
                } @else if (dif > 0) {
                  Sobrante de Repartidor:
                } @else {
                  Faltante de Repartidor:
                }
              </span>
              <span class="font-mono text-base font-bold">
                {{ dif | currencyPEN }}
              </span>
            </div>

            @if (totalRendido() < 0) {
              <p data-testid="cierre-liq-bloqueo" class="text-[11px] font-bold text-amber-300">
                El efectivo rendido no puede ser negativo.
              </p>
            }

            <div class="flex justify-end gap-2 pt-3 border-t border-white/10">
              <button type="button" (click)="cancelar.emit()" class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs uppercase transition cursor-pointer">Cancelar</button>
              <button type="button" (click)="confirmar.emit()" [disabled]="totalRendido() < 0" class="disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase transition cursor-pointer">Cerrar y Cuadrar</button>
            </div>
          </div>
        </div>
  `
})
export class CajeroCierreLiquidacionModalComponent {
  readonly liquidacion = input<BackendLiquidacionResponse | null>(null);

  readonly totalRendido = model<number>(0);

  readonly cancelar = output<void>();
  readonly confirmar = output<void>();

  protected get totalEsperado(): number {
    return (this.liquidacion()?.fondoInicial || 0) + (this.liquidacion()?.totalCobradoEfectivo || 0);
  }

  protected get diferencia(): number {
    return Math.round(((Number(this.totalRendido()) || 0) - this.totalEsperado) * 100) / 100;
  }
}
