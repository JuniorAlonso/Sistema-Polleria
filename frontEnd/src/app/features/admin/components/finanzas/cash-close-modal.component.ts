import { ChangeDetectionStrategy, Component, OnInit, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CurrencyPENPipe } from '../../../../shared/pipes/currency-pen.pipe';
import { ArqueoCaja } from '../../../../core/models/finance.model';
import { CierreCajaForm } from '../../models/admin-forms';

/** Modal de arqueo y cierre de caja. Presentacional: edita un borrador local y lo emite. */
@Component({
  selector: 'app-cash-close-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, CurrencyPENPipe],
  template: `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div class="w-full max-w-md bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100 animate-scale-up">
            <div class="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 class="font-display text-xl font-bold text-emerald-400">Arqueo y Cierre de Turno (RF22)</h3>
              <button (click)="closed.emit()" class="text-slate-400 hover:text-white cursor-pointer" aria-label="Cerrar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>

            <div class="space-y-3 text-xs">
              <div class="bg-black/30 p-3 rounded-xl border border-white/5 space-y-1">
                <div class="flex justify-between text-slate-400">
                  <span>Monto Inicial:</span>
                  <span class="font-mono text-white">{{ (cajaActual()?.montoInicial || 0) | currencyPEN }}</span>
                </div>
                <div class="flex justify-between text-slate-400">
                  <span>Ventas en Efectivo:</span>
                  <span class="font-mono text-polleria-gold">{{ (cajaActual()?.ventasEfectivo || 0) | currencyPEN }}</span>
                </div>
                <div class="flex justify-between pt-1 border-t border-white/10 font-bold text-white">
                  <span>Efectivo Teórico Esperado:</span>
                  <span class="font-mono text-emerald-400">
                    {{ ((cajaActual()?.montoInicial || 0) + (cajaActual()?.ventasEfectivo || 0)) | currencyPEN }}
                  </span>
                </div>
              </div>

              <div>
                <label class="block font-bold text-slate-300 mb-1">Efectivo Real Contado en Gaveta (S/):</label>
                <input 
                  type="number" 
                  [(ngModel)]="cierreEfectivoReal"
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono text-base focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>

              <div>
                <label class="block font-bold text-slate-300 mb-1">Observaciones del Cierre:</label>
                <input 
                  type="text" 
                  [(ngModel)]="cierreObservaciones"
                  placeholder="Detallar cualquier diferencia o novedad..."
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button (click)="closed.emit()" class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold cursor-pointer">Cancelar</button>
              <button (click)="confirmed.emit({ efectivoReal: cierreEfectivoReal, observaciones: cierreObservaciones })" class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase cursor-pointer">Cerrar y Cuadrar Caja</button>
            </div>
          </div>
        </div>
  `
})
export class CashCloseModalComponent implements OnInit {
  readonly cajaActual = input.required<ArqueoCaja | null>();
  readonly initial = input.required<CierreCajaForm>();

  readonly closed = output<void>();
  readonly confirmed = output<CierreCajaForm>();

  protected cierreEfectivoReal = 0;
  protected cierreObservaciones = '';

  ngOnInit(): void {
    this.cierreEfectivoReal = this.initial().efectivoReal;
    this.cierreObservaciones = this.initial().observaciones;
  }
}
