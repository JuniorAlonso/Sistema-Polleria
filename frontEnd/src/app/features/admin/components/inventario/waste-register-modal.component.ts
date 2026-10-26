import { ChangeDetectionStrategy, Component, OnInit, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Insumo } from '../../../../core/models/inventory.model';
import { MermaForm } from '../../models/admin-forms';

/** Modal de registro de merma. Presentacional: edita un borrador local y lo emite. */
@Component({
  selector: 'app-waste-register-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div class="w-full max-w-md bg-slate-900 border border-rose-500/40 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100 animate-scale-up">
            <div class="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 class="font-display text-xl font-bold text-rose-400 flex items-center gap-2">
                <span>Registrar Merma de Jornada</span>
              </h3>
              <button (click)="closed.emit()" class="text-slate-400 hover:text-white cursor-pointer" aria-label="Cerrar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>

            <div class="space-y-3 text-xs">
              <div>
                <label class="block font-bold text-slate-300 mb-1">Insumo:</label>
                <select 
                  [(ngModel)]="draft.insumoId"
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-rose-400"
                >
                  @for (ins of insumos(); track ins.id) {
                    <option [value]="ins.id">{{ ins.nombre }}</option>
                  }
                </select>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-300 mb-1">Cantidad descartada:</label>
                  <input 
                    type="number" 
                    [(ngModel)]="draft.cantidad"
                    min="0.1"
                    step="0.5"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-rose-400"
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-300 mb-1">Motivo:</label>
                  <select 
                    [(ngModel)]="draft.motivo"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-rose-400"
                  >
                    <option value="VENCIMIENTO">Vencimiento de lote</option>
                    <option value="MAL_ESTADO">Mal estado / deterioro</option>
                    <option value="ERROR_COCINA">Error de cocina (cocción excesiva o descarte)</option>
                    <option value="CAIDA">Caída / accidente</option>
                    <option value="OTRO">Otro motivo</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="block font-bold text-slate-300 mb-1">Justificación:</label>
                <input 
                  type="text" 
                  [(ngModel)]="draft.justificacion"
                  placeholder="Detalle del descarte para la bitácora"
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-rose-400"
                />
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button 
                (click)="closed.emit()"
                class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                (click)="confirmed.emit(draft)"
                class="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold uppercase transition cursor-pointer shadow"
              >
                Registrar Merma
              </button>
            </div>
          </div>
        </div>
  `
})
export class WasteRegisterModalComponent implements OnInit {
  readonly initial = input.required<MermaForm>();
  readonly insumos = input.required<Insumo[]>();

  readonly closed = output<void>();
  readonly confirmed = output<MermaForm>();

  protected draft!: MermaForm;

  ngOnInit(): void {
    this.draft = { ...this.initial() };
  }
}
