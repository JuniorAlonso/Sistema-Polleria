import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { NgClass } from '@angular/common';
import { DatosFiscales, consumidorFinal, motivoDatosFiscalesInvalidos } from '../models/datos-fiscales';

type ModoFiscal = 'FINAL' | 'DNI' | 'RUC';

/**
 * Receipt tax data picker (D3.8): final consumer, boleta with DNI or factura with RUC. Reused by
 * Plan 2 for pickup and counter sales. It only edits the data; the parent decides whether to charge.
 */
@Component({
  selector: 'app-cajero-datos-fiscales',
  standalone: true,
  imports: [NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-3 p-4 rounded-2xl bg-black/40 border border-white/10">
      <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider">Comprobante</label>
      <div class="grid grid-cols-3 gap-2">
        @for (opcion of opciones; track opcion.modo) {
          <button
            type="button"
            [attr.data-testid]="'fiscal-' + opcion.modo"
            (click)="cambiarModo(opcion.modo)"
            class="px-2 py-2 rounded-xl border text-[11px] font-bold transition cursor-pointer"
            [ngClass]="modo() === opcion.modo ? 'bg-polleria-gold/20 border-polleria-gold text-polleria-gold' : 'bg-black/30 border-white/10 text-slate-400 hover:text-white'"
          >
            {{ opcion.etiqueta }}
          </button>
        }
      </div>

      @if (modo() !== 'FINAL') {
        <input
          type="text"
          inputmode="numeric"
          data-testid="fiscal-numero"
          [value]="datos().numDoc || ''"
          (input)="actualizar('numDoc', $any($event.target).value)"
          [placeholder]="modo() === 'RUC' ? 'RUC (11 dígitos)' : 'DNI (8 dígitos)'"
          class="w-full px-4 py-2.5 bg-black/60 border border-white/15 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-polleria-gold"
        />
        <input
          type="text"
          data-testid="fiscal-nombre"
          [value]="datos().nombre"
          (input)="actualizar('nombre', $any($event.target).value)"
          [placeholder]="modo() === 'RUC' ? 'Razón social' : 'Nombre del comprador'"
          class="w-full px-4 py-2.5 bg-black/60 border border-white/15 rounded-xl text-sm text-white focus:outline-none focus:border-polleria-gold"
        />
        @if (modo() === 'RUC') {
          <input
            type="text"
            data-testid="fiscal-direccion"
            [value]="datos().direccion || ''"
            (input)="actualizar('direccion', $any($event.target).value)"
            placeholder="Dirección fiscal (opcional)"
            class="w-full px-4 py-2.5 bg-black/60 border border-white/15 rounded-xl text-sm text-white focus:outline-none focus:border-polleria-gold"
          />
        }
      }

      @if (motivo(); as texto) {
        <p data-testid="fiscal-motivo" class="text-[11px] font-bold text-amber-300">{{ texto }}</p>
      }
    </div>
  `
})
export class CajeroDatosFiscalesComponent {
  readonly datos = model.required<DatosFiscales>();
  readonly total = input<number>(0);

  protected readonly opciones: { modo: ModoFiscal; etiqueta: string }[] = [
    { modo: 'FINAL', etiqueta: 'Consumidor final' },
    { modo: 'DNI', etiqueta: 'Boleta con DNI' },
    { modo: 'RUC', etiqueta: 'Factura (RUC)' }
  ];

  protected readonly modo = computed<ModoFiscal>(() => {
    const d = this.datos();
    if (d.tipo === 'FACTURA') return 'RUC';
    return d.tipoDoc === 'DNI' ? 'DNI' : 'FINAL';
  });

  protected readonly motivo = computed(() => motivoDatosFiscalesInvalidos(this.datos(), this.total()));

  protected cambiarModo(modo: ModoFiscal): void {
    if (modo === this.modo()) return;
    if (modo === 'FINAL') this.datos.set(consumidorFinal());
    if (modo === 'DNI') this.datos.set({ tipo: 'BOLETA', tipoDoc: 'DNI', numDoc: '', nombre: '' });
    if (modo === 'RUC') this.datos.set({ tipo: 'FACTURA', tipoDoc: 'RUC', numDoc: '', nombre: '', direccion: '' });
  }

  protected actualizar(campo: 'numDoc' | 'nombre' | 'direccion', valor: string): void {
    this.datos.update(d => ({ ...d, [campo]: valor }));
  }
}
