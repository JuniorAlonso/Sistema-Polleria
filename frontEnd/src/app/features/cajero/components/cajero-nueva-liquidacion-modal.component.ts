import { ChangeDetectionStrategy, Component, model, output } from '@angular/core';
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
                <label class="block text-slate-300 font-bold mb-1">Nombre del Repartidor:</label>
                <input type="text" [(ngModel)]="repartidorNombre" class="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-white font-medium" />
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
              <button type="button" (click)="aperturar.emit()" class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase">Aperturar</button>
            </div>
          </div>
        </div>
  `
})
export class CajeroNuevaLiquidacionModalComponent {
  readonly repartidorNombre = model<string>('');
  readonly fondoInicial = model<number>(0);
  readonly observaciones = model<string>('');

  readonly cancelar = output<void>();
  readonly aperturar = output<void>();
}
