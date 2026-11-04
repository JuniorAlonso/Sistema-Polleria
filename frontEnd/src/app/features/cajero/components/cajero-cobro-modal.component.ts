import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { Order } from '../../../core/models/order.model';
import { MetodoCobro } from '../models/cajero.models';

@Component({
  selector: 'app-cajero-cobro-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPENPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
        <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="w-full max-w-2xl bg-[#14161a] border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <!-- Modal Header -->
            <div class="p-5 border-b border-white/10 flex items-center justify-between bg-black/30">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
                  </svg>
                </div>
                <div>
                  <h3 class="font-display text-xl text-white font-bold tracking-wide">
                    COBRAR COMANDA #{{ orden().codigoSeguimiento || orden().id }}
                  </h3>
                  <p class="text-xs text-slate-400">
                    Cliente: {{ orden().cliente.nombre }} • {{ orden().tipo }}
                  </p>
                </div>
              </div>
              <button
                type="button"
                (click)="cerrar.emit()"
                class="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <!-- Modal Body (Scrollable) -->
            <div class="p-5 overflow-y-auto space-y-5 flex-1">
              
              <!-- Detalle de Ítems del Pedido -->
              <div class="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-2">
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Detalle del Consumo
                </span>
                @for (item of orden().items; track item.product.id) {
                  <div class="flex justify-between items-center text-xs">
                    <span class="text-slate-200">
                      {{ item.cantidad }}x {{ item.product.nombre }}
                    </span>
                    <span class="font-mono text-slate-400 font-semibold">
                      {{ (item.product.precio * item.cantidad) | currencyPEN }}
                    </span>
                  </div>
                }
                <div class="border-t border-white/10 pt-2 flex justify-between items-center text-sm font-bold">
                  <span class="text-white">Total a Cobrar</span>
                  <span class="font-display text-2xl text-polleria-gold">
                    {{ (orden().total || 0) | currencyPEN }}
                  </span>
                </div>
              </div>

              <!-- Selector de Método de Pago -->
              <div>
                <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Método de Pago *
                </label>
                <div class="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    (click)="metodo.set('EFECTIVO')"
                    class="p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1.5"
                    [ngClass]="metodo() === 'EFECTIVO' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md' : 'bg-black/30 border-white/10 text-slate-400 hover:text-white'"
                  >
                    <span class="text-xl">💵</span>
                    <span class="text-xs font-bold">Efectivo</span>
                  </button>

                  <button
                    type="button"
                    (click)="metodo.set('TARJETA')"
                    class="p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1.5"
                    [ngClass]="metodo() === 'TARJETA' ? 'bg-sky-500/20 border-sky-500 text-sky-300 shadow-md' : 'bg-black/30 border-white/10 text-slate-400 hover:text-white'"
                  >
                    <span class="text-xl">💳</span>
                    <span class="text-xs font-bold">Tarjeta POS</span>
                  </button>

                  <button
                    type="button"
                    (click)="metodo.set('YAPE_PLIN')"
                    class="p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1.5"
                    [ngClass]="metodo() === 'YAPE_PLIN' ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-md' : 'bg-black/30 border-white/10 text-slate-400 hover:text-white'"
                  >
                    <span class="text-xl">📱</span>
                    <span class="text-xs font-bold">Yape / Plin</span>
                  </button>
                </div>
              </div>

              <!-- Campos dinámicos según Método de Pago -->
              @if (metodo() === 'EFECTIVO') {
                <div class="space-y-3 p-4 rounded-2xl bg-black/40 border border-white/10">
                  <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Efectivo Recibido *
                  </label>
                  <div class="relative">
                    <span class="absolute left-4 top-1/2 -translate-y-1/2 text-polleria-gold font-bold">S/</span>
                    <input
                      type="number"
                      [(ngModel)]="efectivoRecibido"
                      step="1"
                      min="0"
                      placeholder="0.00"
                      class="w-full pl-10 pr-4 py-3 bg-black/60 border border-white/15 rounded-xl text-xl font-bold text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <!-- Botones rápidos de monto -->
                  <div class="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      (click)="exacto.emit()"
                      class="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition cursor-pointer"
                    >
                      Exacto
                    </button>
                    <button
                      type="button"
                      (click)="sumar.emit(10)"
                      class="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 transition cursor-pointer"
                    >
                      +S/10
                    </button>
                    <button
                      type="button"
                      (click)="sumar.emit(20)"
                      class="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 transition cursor-pointer"
                    >
                      +S/20
                    </button>
                    <button
                      type="button"
                      (click)="sumar.emit(50)"
                      class="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 transition cursor-pointer"
                    >
                      +S/50
                    </button>
                    <button
                      type="button"
                      (click)="sumar.emit(100)"
                      class="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 transition cursor-pointer"
                    >
                      +S/100
                    </button>
                  </div>

                  <!-- Indicador de Vuelto en Vivo -->
                  <div class="p-3.5 rounded-xl flex items-center justify-between border"
                    [ngClass]="vuelto() >= 0 ? 'bg-emerald-950/30 border-emerald-500/40' : 'bg-rose-950/30 border-rose-500/40'"
                  >
                    <span class="text-xs font-bold uppercase tracking-wider"
                      [ngClass]="vuelto() >= 0 ? 'text-emerald-300' : 'text-rose-300'"
                    >
                      {{ vuelto() >= 0 ? 'Vuelto a Entregar:' : 'Monto insuficiente:' }}
                    </span>
                    <span class="font-display text-2xl font-bold"
                      [ngClass]="vuelto() >= 0 ? 'text-emerald-400' : 'text-rose-400'"
                    >
                      {{ (vuelto() >= 0 ? vuelto() : -vuelto()) | currencyPEN }}
                    </span>
                  </div>
                </div>
              } @else if (metodo() === 'TARJETA') {
                <div class="space-y-3 p-4 rounded-2xl bg-black/40 border border-white/10">
                  <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Nº de Operación / Voucher POS *
                  </label>
                  <input
                    type="text"
                    [(ngModel)]="referencia"
                    placeholder="Ej: POS-0049281"
                    class="w-full px-4 py-3 bg-black/60 border border-white/15 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-sky-500"
                  />
                  <p class="text-[11px] text-slate-400">
                    Ingresa el número de referencia impreso en el comprobante del terminal POS.
                  </p>
                </div>
              } @else {
                <div class="space-y-3 p-4 rounded-2xl bg-black/40 border border-white/10">
                  <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Código de Aprobación Yape / Plin *
                  </label>
                  <input
                    type="text"
                    [(ngModel)]="referencia"
                    placeholder="Ej: YAP-94821 o Celular"
                    class="w-full px-4 py-3 bg-black/60 border border-white/15 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-purple-500"
                  />
                  <p class="text-[11px] text-slate-400">
                    Verifica que el cliente haya transferido el monto exacto de {{ (orden().total || 0) | currencyPEN }}.
                  </p>
                </div>
              }

            </div>

            <!-- Modal Footer con Acción -->
            <div class="p-5 border-t border-white/10 bg-black/30 flex items-center justify-end gap-3">
              <button
                type="button"
                (click)="cerrar.emit()"
                class="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs uppercase tracking-wider transition cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                (click)="confirmar.emit()"
                [disabled]="!cobroValido() || procesando()"
                class="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-display text-lg font-black uppercase tracking-wider transition duration-150 shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                @if (procesando()) {
                  <span>PROCESANDO COBRO...</span>
                } @else {
                  <span>CONFIRMAR COBRO & EMITIR TICKET</span>
                }
              </button>
            </div>

          </div>
        </div>
  `
})
export class CajeroCobroModalComponent {
  readonly orden = input.required<Order>();
  readonly vuelto = input<number>(0);
  readonly cobroValido = input<boolean>(false);
  readonly procesando = input<boolean>(false);

  readonly metodo = model<MetodoCobro>('EFECTIVO');
  readonly efectivoRecibido = model<number>(0);
  readonly referencia = model<string>('');

  readonly cerrar = output<void>();
  readonly confirmar = output<void>();
  readonly exacto = output<void>();
  readonly sumar = output<number>();
}
