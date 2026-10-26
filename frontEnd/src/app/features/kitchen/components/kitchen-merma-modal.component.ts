import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Insumo, MotivoMerma, RegistrarMermaRequest } from '../../../core/models/inventory.model';

export const MOTIVOS_MERMA: { value: MotivoMerma; label: string }[] = [
  { value: 'VENCIMIENTO', label: 'Vencimiento' },
  { value: 'MAL_ESTADO', label: 'Mal estado' },
  { value: 'ERROR_COCINA', label: 'Error de cocina' },
  { value: 'CAIDA', label: 'Caída' },
  { value: 'OTRO', label: 'Otro' }
];

/** Modal para declarar una merma. Presentacional: sin servicios. */
@Component({
  selector: 'app-kitchen-merma-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" role="dialog" aria-modal="true">
      <div class="w-full max-w-md bg-slate-900 border border-rose-500/40 rounded-2xl p-6 space-y-4 text-slate-100">
        <h2 class="text-lg font-bold">Registrar merma</h2>

        <label class="block text-xs font-bold text-slate-400 uppercase" for="merma-insumo">Insumo</label>
        <select id="merma-insumo" [(ngModel)]="insumoId"
          class="w-full rounded-lg bg-slate-950 border border-white/10 text-sm p-2">
          <option [ngValue]="null">Selecciona un insumo</option>
          @for (i of insumos(); track i.id) {
            <option [ngValue]="i.id">{{ i.nombre }} ({{ i.unidadMedida }})</option>
          }
        </select>

        <label class="block text-xs font-bold text-slate-400 uppercase" for="merma-cantidad">Cantidad</label>
        <input id="merma-cantidad" type="number" min="0" step="any" [(ngModel)]="cantidad"
          class="w-full rounded-lg bg-slate-950 border border-white/10 text-sm p-2" />

        <label class="block text-xs font-bold text-slate-400 uppercase" for="merma-motivo">Motivo</label>
        <select id="merma-motivo" [(ngModel)]="motivo"
          class="w-full rounded-lg bg-slate-950 border border-white/10 text-sm p-2">
          @for (m of motivos; track m.value) {
            <option [ngValue]="m.value">{{ m.label }}</option>
          }
        </select>

        <label class="block text-xs font-bold text-slate-400 uppercase" for="merma-just">Justificación</label>
        <input id="merma-just" type="text" [(ngModel)]="justificacion"
          class="w-full rounded-lg bg-slate-950 border border-white/10 text-sm p-2" />

        @if (error(); as msg) {
          <div class="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs" role="alert">{{ msg }}</div>
        }

        <div class="flex justify-end gap-2">
          <button type="button" (click)="closed.emit()"
            class="px-4 py-2 rounded-xl bg-white/10 text-xs font-bold cursor-pointer">Cancelar</button>
          <button type="button" (click)="confirmar()" [disabled]="!valido() || enviando()"
            class="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
            {{ enviando() ? 'Enviando...' : 'Registrar merma' }}
          </button>
        </div>
      </div>
    </div>
  `
})
export class KitchenMermaModalComponent {
  readonly insumos = input.required<Insumo[]>();
  readonly enviando = input.required<boolean>();
  readonly error = input<string | null>(null);

  readonly closed = output<void>();
  readonly confirmed = output<RegistrarMermaRequest>();

  readonly motivos = MOTIVOS_MERMA;

  insumoId: number | null = null;
  cantidad: number | null = null;
  motivo: MotivoMerma = 'OTRO';
  justificacion = '';

  valido(): boolean {
    return this.insumoId !== null && Number(this.cantidad) > 0;
  }

  confirmar(): void {
    if (!this.valido()) return;
    this.confirmed.emit({
      insumoId: Number(this.insumoId),
      cantidad: Number(this.cantidad),
      motivo: this.motivo,
      justificacion: this.justificacion.trim() || undefined
    });
  }
}
