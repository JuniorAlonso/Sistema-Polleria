import { ChangeDetectionStrategy, Component, OnInit, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ZonaSalonConfig } from '../../../../core/services/salon.service';
import { CrearMesaForm } from '../../models/admin-forms';

/** Modal de alta de mesa. Presentacional: edita un borrador local y lo emite. */
@Component({
  selector: 'app-mesa-create-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div class="w-full max-w-md bg-slate-900 border border-polleria-gold/40 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100 animate-scale-up">
            <div class="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 class="font-display text-xl font-bold text-white flex items-center gap-2">
                <svg class="w-5 h-5 text-polleria-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
                <span>Crear Nueva Mesa</span>
              </h3>
              <button (click)="!isProcesandoMesa() && closed.emit()" [disabled]="isProcesandoMesa()" class="text-slate-400 hover:text-white cursor-pointer disabled:opacity-50" aria-label="Cerrar">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div class="space-y-3 text-xs">
              <div>
                <label class="block font-bold text-slate-300 mb-1">Número de Mesa:</label>
                <input 
                  type="number" 
                  [(ngModel)]="draft.numero"
                  [disabled]="isProcesandoMesa()"
                  min="1"
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono focus:outline-none focus:ring-1 focus:ring-polleria-gold disabled:opacity-50"
                  placeholder="Ej. 12"
                />
              </div>

              <div>
                <label class="block font-bold text-slate-300 mb-1">Capacidad (Comensales):</label>
                <input 
                  type="number" 
                  [(ngModel)]="draft.capacidad"
                  [disabled]="isProcesandoMesa()"
                  min="1"
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono focus:outline-none focus:ring-1 focus:ring-polleria-gold disabled:opacity-50"
                  placeholder="Ej. 4"
                />
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
                class="px-5 py-2.5 rounded-xl bg-polleria-crimson hover:bg-polleria-crimsonHover text-white text-xs font-bold uppercase transition flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                @if (isProcesandoMesa()) {
                  <svg class="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>Creando Mesa...</span>
                } @else {
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                  </svg>
                  <span>Registrar Mesa</span>
                }
              </button>
            </div>
          </div>
        </div>
  `
})
export class MesaCreateModalComponent implements OnInit {
  readonly initial = input.required<CrearMesaForm>();
  readonly zonasSalon = input.required<ZonaSalonConfig[]>();
  readonly isProcesandoMesa = input.required<boolean>();

  readonly closed = output<void>();
  readonly saved = output<CrearMesaForm>();

  protected draft!: CrearMesaForm;

  ngOnInit(): void {
    this.draft = { ...this.initial() };
  }
}
