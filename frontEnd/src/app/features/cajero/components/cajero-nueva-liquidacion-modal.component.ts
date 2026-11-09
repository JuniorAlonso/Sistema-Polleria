import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Repartidor } from '../../../core/services/repartidores.service';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';

@Component({
  selector: 'app-cajero-nueva-liquidacion-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPENPipe],
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
                  <select [(ngModel)]="repartidorId" (ngModelChange)="onRepartidorChange.emit($event)" class="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-white font-medium">
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
                <div class="flex justify-between items-center mb-1">
                  <label class="block text-slate-300 font-bold">Fondo Inicial de Sencillo (S/):</label>
                  @if (fondoSugerido() > 0) {
                    <button
                      type="button"
                      (click)="fondoInicial.set(fondoSugerido())"
                      class="text-[11px] font-bold text-amber-300 hover:text-amber-200 underline cursor-pointer"
                    >
                      Sugerido para ruta: {{ fondoSugerido() | currencyPEN }}
                    </button>
                  }
                </div>
                <input type="number" [(ngModel)]="fondoInicial" step="10" min="0" class="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-white font-mono font-bold" />

                <!-- Atajos rápidos de fondo -->
                <div class="flex flex-wrap items-center gap-1.5 mt-2">
                  <span class="text-[10px] text-slate-400 font-bold">Atajos:</span>
                  @if (fondoSugerido() > 0) {
                    <button
                      type="button"
                      (click)="fondoInicial.set(fondoSugerido())"
                      class="px-2 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer"
                      [ngClass]="fondoInicial() === fondoSugerido() ? 'bg-amber-600 text-white border-amber-400' : 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'"
                    >
                      {{ fondoSugerido() | currencyPEN }} (Ruta)
                    </button>
                  }
                  <button
                    type="button"
                    (click)="fondoInicial.set(30)"
                    class="px-2 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer"
                    [ngClass]="fondoInicial() === 30 ? 'bg-sky-600 text-white border-sky-400' : 'bg-white/10 text-slate-200 border-white/10 hover:bg-white/15'"
                  >
                    S/ 30
                  </button>
                  <button
                    type="button"
                    (click)="fondoInicial.set(50)"
                    class="px-2 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer"
                    [ngClass]="fondoInicial() === 50 ? 'bg-sky-600 text-white border-sky-400' : 'bg-white/10 text-slate-200 border-white/10 hover:bg-white/15'"
                  >
                    S/ 50
                  </button>
                  <button
                    type="button"
                    (click)="fondoInicial.set(100)"
                    class="px-2 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer"
                    [ngClass]="fondoInicial() === 100 ? 'bg-sky-600 text-white border-sky-400' : 'bg-white/10 text-slate-200 border-white/10 hover:bg-white/15'"
                  >
                    S/ 100
                  </button>
                </div>
              </div>

              <div>
                <label class="block text-slate-300 font-bold mb-1">Observaciones:</label>
                <input type="text" [(ngModel)]="observaciones" placeholder="Turno tarde / Zona San Joaquín" class="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-white" />
              </div>
            </div>

            @if (repartidorId() === null || fondoInicial() < 0) {
              <p data-testid="nueva-liq-bloqueo" class="text-[11px] font-bold text-amber-300">
                {{ repartidorId() === null ? 'Selecciona un repartidor de la lista para continuar.' : 'El fondo inicial no puede ser negativo.' }}
              </p>
            }

            <div class="flex justify-end gap-2 pt-3 border-t border-white/10">
              <button type="button" (click)="cancelar.emit()" class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs uppercase transition cursor-pointer">Cancelar</button>
              <button type="button" (click)="aperturar.emit()" [disabled]="repartidorId() === null || fondoInicial() < 0" class="disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase transition cursor-pointer">Aperturar</button>
            </div>
          </div>
        </div>
  `
})
export class CajeroNuevaLiquidacionModalComponent {
  readonly repartidores = input<Repartidor[]>([]);
  readonly repartidorId = model<number | null>(null);
  readonly fondoInicial = model<number>(0);
  readonly fondoSugerido = input<number>(0);
  readonly observaciones = model<string>('');

  readonly cancelar = output<void>();
  readonly aperturar = output<void>();
  readonly onRepartidorChange = output<number | null>();
}
