import { ChangeDetectionStrategy, Component, OnInit, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MesaSalon } from '../../../../core/models/table.model';
import { CoordenadasMesa } from '../../models/admin-forms';

/** Modal para editar las coordenadas de una mesa en el plano. Presentacional (borrador local). */
@Component({
  selector: 'app-mesa-coordinates-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div class="w-full max-w-sm bg-slate-900 border border-polleria-gold/40 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100 animate-scale-up">
            <div class="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 class="font-display text-xl font-bold text-white">Editar Posición en Plano</h3>
              <button (click)="closed.emit()" class="text-slate-400 hover:text-white cursor-pointer" aria-label="Cerrar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>

            <div class="space-y-3 text-xs">
              <p class="text-slate-400">Coordenadas espaciales de <strong>{{ mesa().nombre }}</strong> en el salón virtual.</p>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-300 mb-1">Posición X:</label>
                  <input 
                    type="number" 
                    [(ngModel)]="coordX"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-300 mb-1">Posición Y:</label>
                  <input 
                    type="number" 
                    [(ngModel)]="coordY"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono focus:outline-none focus:ring-1 focus:ring-polleria-gold"
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
                (click)="saved.emit({ x: coordX, y: coordY })" 
                [disabled]="isProcesandoMesa()"
                class="px-5 py-2 rounded-xl bg-polleria-gold hover:bg-amber-400 text-slate-950 text-xs font-bold uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                @if (isProcesandoMesa()) {
                  <svg class="animate-spin w-3.5 h-3.5 text-slate-950" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>Guardando...</span>
                } @else {
                  <span>Guardar Posición</span>
                }
              </button>
            </div>
          </div>
        </div>
  `
})
export class MesaCoordinatesModalComponent implements OnInit {
  readonly mesa = input.required<MesaSalon>();
  readonly initial = input.required<CoordenadasMesa>();
  readonly isProcesandoMesa = input.required<boolean>();

  readonly closed = output<void>();
  readonly saved = output<CoordenadasMesa>();

  protected coordX = 0;
  protected coordY = 0;

  ngOnInit(): void {
    this.coordX = this.initial().x;
    this.coordY = this.initial().y;
  }
}
