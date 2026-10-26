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
              <input type="number" [(ngModel)]="totalRendido" step="5" class="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-white font-mono text-lg font-bold" />
            </div>
            <div class="flex justify-end gap-2 pt-3 border-t border-white/10">
              <button type="button" (click)="cancelar.emit()" class="px-4 py-2 rounded-xl bg-white/5 text-slate-300 font-bold text-xs uppercase">Cancelar</button>
              <button type="button" (click)="confirmar.emit()" class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase">Cerrar y Cuadrar</button>
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
}
