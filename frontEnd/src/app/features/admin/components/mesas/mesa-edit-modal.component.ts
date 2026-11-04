import { ChangeDetectionStrategy, Component, OnInit, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ZonaSalonConfig } from '../../../../core/services/salon.service';
import { EditarMesaForm } from '../../models/admin-forms';

/** Modal de edición de mesa. Presentacional: edita un borrador local y lo emite. */
@Component({
  selector: 'app-mesa-edit-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div class="w-full max-w-md bg-slate-900 border border-polleria-gold/40 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100 animate-scale-up">
            <div class="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 class="font-display text-xl font-bold text-white flex items-center gap-2">
                <svg class="w-5 h-5 text-polleria-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
                <span>Editar Mesa #{{ draft.numero }}</span>
              </h3>
              <button (click)="!isProcesandoMesa() && closed.emit()" [disabled]="isProcesandoMesa()" class="text-slate-400 hover:text-white cursor-pointer disabled:opacity-50" aria-label="Cerrar">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div class="space-y-3 text-xs">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-300 mb-1">Número:</label>
                  <input 
                    type="number" 
                    [(ngModel)]="draft.numero"
                    [disabled]="isProcesandoMesa()"
                    min="1"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono focus:outline-none focus:ring-1 focus:ring-polleria-gold disabled:opacity-50"
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-300 mb-1">Capacidad:</label>
                  <input 
                    type="number" 
                    [(ngModel)]="draft.capacidad"
                    [disabled]="isProcesandoMesa()"
                    min="1"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono focus:outline-none focus:ring-1 focus:ring-polleria-gold disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label class="block font-bold text-slate-300 mb-1">Zona del Salón:</label>
                <select 
                  [(ngModel)]="draft.zona"
                  [disabled]="isProcesandoMesa()"
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold cursor-pointer disabled:opacity-50"
                >
                  @for (z of zonasSalon(); track z.id) {
                    <option [value]="z.id">{{ z.nombre }}</option>
                  }
                </select>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-300 mb-1">Coordenada X:</label>
                  <input 
                    type="number" 
                    [(ngModel)]="draft.posicionX"
                    [disabled]="isProcesandoMesa()"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono focus:outline-none focus:ring-1 focus:ring-polleria-gold disabled:opacity-50"
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-300 mb-1">Coordenada Y:</label>
                  <input 
                    type="number" 
                    [(ngModel)]="draft.posicionY"
                    [disabled]="isProcesandoMesa()"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono focus:outline-none focus:ring-1 focus:ring-polleria-gold disabled:opacity-50"
                  />
                </div>
              </div>

              <div class="pt-2">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" [(ngModel)]="draft.activo" [disabled]="isProcesandoMesa()" class="rounded bg-black/50 border-white/20 text-polleria-gold focus:ring-0 w-4 h-4 disabled:opacity-50" />
                  <span class="font-bold text-slate-200">Mesa Activa (Disponible para atención)</span>
                </label>
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button 
                (click)="closed.emit()" 
                [disabled]="isProcesandoMesa()"
                class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button 
                (click)="saved.emit(draft)" 
                [disabled]="isProcesandoMesa()"
                class="px-5 py-2.5 rounded-xl bg-polleria-gold hover:bg-amber-400 text-slate-950 text-xs font-bold uppercase transition flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                @if (isProcesandoMesa()) {
                  <svg class="animate-spin w-4 h-4 text-slate-950" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>Guardando...</span>
                } @else {
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span>Guardar Cambios</span>
                }
              </button>
            </div>
          </div>
        </div>
  `
})
export class MesaEditModalComponent implements OnInit {
  readonly initial = input.required<EditarMesaForm>();
  readonly zonasSalon = input.required<ZonaSalonConfig[]>();
  readonly isProcesandoMesa = input.required<boolean>();

  readonly closed = output<void>();
  readonly saved = output<EditarMesaForm>();

  protected draft!: EditarMesaForm;

  ngOnInit(): void {
    this.draft = { ...this.initial() };
  }
}
