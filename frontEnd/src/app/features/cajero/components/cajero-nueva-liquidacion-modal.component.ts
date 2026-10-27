import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { Repartidor } from '../../../core/services/repartidores.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-cajero-nueva-liquidacion-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
        <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="w-full max-w-md bg-[#14161a] border border-white/15 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 class="font-display text-xl font-bold text-white">Entregar Fondo de Vueltos a Repartidor</h3>
            <div class="space-y-3 text-xs">
              <div>
                <label class="block text-slate-300 font-bold mb-1">Repartidor:</label>
                @if (repartidores().length) {
                  <select [(ngModel)]="repartidorId" class="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-white font-medium">
                    <option [ngValue]="null" disabled>Selecciona un repartidor</option>
                    @for (r of repartidores(); track r.id) {
                      <option [ngValue]="r.id">{{ r.nombre }}</option>
                    }
                  </select>
                } @else {
                  <p class="text-amber-300">No se pudo cargar el roster de repartidores.</p>
                }
              </div>
              <div>
                <label class="block text-slate-300 font-bold mb-1">Fondo Inicial de Sencillo (S/):</label>
                <input type="number" [(ngModel)]="fondoInicial" step="10" min="0" class="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-white font-mono font-bold" />
              </div>
              <div>
                <label class="block text-slate-300 font-bold mb-1">Observaciones:</label>
                <input type="text" [(ngModel)]="observaciones" placeholder="Turno tarde / Zona San Joaquín" class="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-white" />
              </div>
            </div>
            <div class="flex justify-end gap-2 pt-3 border-t border-white/10">
              <button type="button" (click)="cancelar.emit()" class="px-4 py-2 rounded-xl bg-white/5 text-slate-300 font-bold text-xs uppercase">Cancelar</button>
              <button type="button" (click)="aperturar.emit()" [disabled]="repartidorId() === null" class="disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase">Aperturar</button>
            </div>
          </div>
        </div>
  `
})
export class CajeroNuevaLiquidacionModalComponent {
  readonly repartidores = input<Repartidor[]>([]);
  readonly repartidorId = model<number | null>(null);
  readonly fondoInicial = model<number>(0);
  readonly observaciones = model<string>('');

  readonly cancelar = output<void>();
  readonly aperturar = output<void>();
}
