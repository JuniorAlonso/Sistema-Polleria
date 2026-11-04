import { ChangeDetectionStrategy, Component, OnInit, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/** Modal de apertura de caja. Presentacional: edita el monto en un borrador local y lo emite. */
@Component({
  selector: 'app-cash-open-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div class="w-full max-w-md bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100 animate-scale-up">
            <div class="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 class="font-display text-xl font-bold text-emerald-400">Apertura de Turno de Caja</h3>
              <button (click)="closed.emit()" class="text-slate-400 hover:text-white cursor-pointer" aria-label="Cerrar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>

            <div class="space-y-3 text-xs">
              <p class="text-slate-400">Ingresa el fondo de sencillo en efectivo con el que se inicia la jornada en caja central.</p>
              <div>
                <label class="block font-bold text-slate-300 mb-1">Monto Inicial en Efectivo (S/):</label>
                <input 
                  type="number" 
                  [(ngModel)]="montoApertura"
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono text-base focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button (click)="closed.emit()" class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold cursor-pointer">Cancelar</button>
              <button (click)="confirmed.emit(montoApertura)" class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase cursor-pointer">Abrir Caja</button>
            </div>
          </div>
        </div>
  `
})
export class CashOpenModalComponent implements OnInit {
  readonly initialAmount = input.required<number>();

  readonly closed = output<void>();
  readonly confirmed = output<number>();

  protected montoApertura = 0;

  ngOnInit(): void {
    this.montoApertura = this.initialAmount();
  }
}
