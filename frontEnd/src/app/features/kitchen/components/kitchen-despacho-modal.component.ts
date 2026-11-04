import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Insumo } from '../../../core/models/inventory.model';

export interface DespachoFormValue {
  insumoId: number;
  cantidad: number;
  observaciones?: string;
}

/** Modal para solicitar un despacho de insumo hacia cocina. Presentacional: sin servicios. */
@Component({
  selector: 'app-kitchen-despacho-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" role="dialog" aria-modal="true">
      <div class="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-2xl p-6 space-y-4 text-slate-100">
        <h2 class="text-lg font-bold">Solicitar lote de insumo</h2>

        <label class="block text-xs font-bold text-slate-400 uppercase" for="despacho-insumo">Insumo</label>
        <select id="despacho-insumo" [(ngModel)]="insumoId"
          class="w-full rounded-lg bg-slate-950 border border-white/10 text-sm p-2">
          <option [ngValue]="null">Selecciona un insumo</option>
          @for (i of insumos(); track i.id) {
            <option [ngValue]="i.id">{{ i.nombre }} ({{ i.stockActual }} {{ i.unidadMedida }})</option>
          }
        </select>

        <label class="block text-xs font-bold text-slate-400 uppercase" for="despacho-cantidad">Cantidad</label>
        <input id="despacho-cantidad" type="number" min="0" step="any" [(ngModel)]="cantidad"
          class="w-full rounded-lg bg-slate-950 border border-white/10 text-sm p-2" />

        <label class="block text-xs font-bold text-slate-400 uppercase" for="despacho-obs">Observaciones</label>
        <input id="despacho-obs" type="text" [(ngModel)]="observaciones"
          class="w-full rounded-lg bg-slate-950 border border-white/10 text-sm p-2" />

        @if (error(); as msg) {
          <div class="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs" role="alert">{{ msg }}</div>
        }

        <div class="flex justify-end gap-2">
          <button type="button" (click)="closed.emit()"
            class="px-4 py-2 rounded-xl bg-white/10 text-xs font-bold cursor-pointer">Cancelar</button>
          <button type="button" (click)="confirmar()" [disabled]="!valido() || enviando()"
            class="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-black cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
            {{ enviando() ? 'Enviando...' : 'Solicitar lote' }}
          </button>
        </div>
      </div>
    </div>
  `
})
export class KitchenDespachoModalComponent {
  readonly insumos = input.required<Insumo[]>();
  readonly enviando = input.required<boolean>();
  readonly error = input<string | null>(null);

  readonly closed = output<void>();
  readonly confirmed = output<DespachoFormValue>();

  insumoId: number | null = null;
  cantidad: number | null = null;
  observaciones = '';

  valido(): boolean {
    return this.insumoId !== null && Number(this.cantidad) > 0;
  }

  confirmar(): void {
    if (!this.valido()) return;
    this.confirmed.emit({
      insumoId: Number(this.insumoId),
      cantidad: Number(this.cantidad),
      observaciones: this.observaciones.trim() || undefined
    });
  }
}
