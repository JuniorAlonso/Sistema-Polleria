import { ChangeDetectionStrategy, Component, OnInit, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MovimientoForm } from '../../models/admin-forms';

/** Modal de movimiento de caja menor. Presentacional: edita un borrador local y lo emite. */
@Component({
  selector: 'app-cash-movement-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div class="w-full max-w-md bg-slate-900 border border-white/20 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100 animate-scale-up">
            <div class="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 class="font-display text-xl font-bold text-white">Registrar Movimiento de Caja Menor</h3>
              <button (click)="closed.emit()" class="text-slate-400 hover:text-white cursor-pointer" aria-label="Cerrar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>

            <div class="space-y-3 text-xs">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-300 mb-1">Tipo de Movimiento:</label>
                  <select 
                    [(ngModel)]="draft.tipo"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                  >
                    <option value="EGRESO">Egreso (Gasto Menor)</option>
                    <option value="INGRESO">Ingreso Extra</option>
                  </select>
                </div>
                <div>
                  <label class="block font-bold text-slate-300 mb-1">Monto (S/):</label>
                  <input 
                    type="number" 
                    [(ngModel)]="draft.monto"
                    min="1"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                  />
                </div>
              </div>

              <div>
                <label class="block font-bold text-slate-300 mb-1">Concepto / Justificación:</label>
                <input 
                  type="text" 
                  [(ngModel)]="draft.concepto"
                  placeholder="Ej. Compra de limones en mercado, compra de bolsas..."
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                />
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button (click)="closed.emit()" class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold cursor-pointer">Cancelar</button>
              <button (click)="confirmed.emit(draft)" class="px-5 py-2 rounded-xl bg-polleria-gold hover:bg-amber-400 text-slate-950 text-xs font-bold uppercase cursor-pointer">Registrar</button>
            </div>
          </div>
        </div>
  `
})
export class CashMovementModalComponent implements OnInit {
  readonly initial = input.required<MovimientoForm>();

  readonly closed = output<void>();
  readonly confirmed = output<MovimientoForm>();

  protected draft!: MovimientoForm;

  ngOnInit(): void {
    this.draft = { ...this.initial() };
  }
}
