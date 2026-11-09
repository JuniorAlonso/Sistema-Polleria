import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { Order } from '../../../core/models/order.model';
import { getCodeNum } from './delivery.utils';

@Component({
  selector: 'app-delivery-confirm-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, CurrencyPENPipe],
  template: `
    <div class="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div class="bg-[#14161a] w-full max-w-lg rounded-3xl border border-white/15 p-6 space-y-4 shadow-2xl">

        <div class="flex justify-between items-start pb-3 border-b border-white/10">
          <div>
            <h3 class="font-display text-2xl font-bold text-white">Confirmar Entrega y Cobro</h3>
            <span class="text-xs text-slate-400">Orden #{{ getCodeNum(order().codigoSeguimiento || '') }} • {{ order().cliente.nombre }}</span>
          </div>
          <button (click)="onClose.emit()" class="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer" aria-label="Cerrar">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- Detalle de Cobro -->
        <div class="space-y-3 text-xs">
          <div class="p-4 rounded-xl bg-white/5 flex justify-between items-center">
            <span class="text-slate-300 font-bold">Total a Cobrar:</span>
            <span class="font-display text-2xl font-black text-polleria-gold">
              {{ order().total | currencyPEN }}
            </span>
          </div>

          @if (order().requiereCobroEfectivo) {
            <div class="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
              <div class="flex items-center justify-between">
                <label class="font-bold text-slate-300 block">Calculadora de Vuelto:</label>
                @if ((order().vueltoEstimado ?? 0) > 0) {
                  <span class="text-[11px] font-bold text-amber-300">
                    Previsto: Paga con {{ order().montoPagaCon | currencyPEN }}
                  </span>
                }
              </div>

              <!-- Atajos de teclado / Touch targets rápidos -->
              <div class="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  (click)="onMontoChange.emit(order().total)"
                  class="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer"
                  [ngClass]="montoPagaCliente() === order().total ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-white/10 text-slate-200 hover:bg-white/15 border-white/10'"
                >
                  Exacto ({{ order().total | currencyPEN }})
                </button>

                @if (order().montoPagaCon && Number(order().montoPagaCon) > order().total) {
                  <button
                    type="button"
                    (click)="onMontoChange.emit(Number(order().montoPagaCon))"
                    class="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer"
                    [ngClass]="montoPagaCliente() === Number(order().montoPagaCon) ? 'bg-amber-600 text-white border-amber-400' : 'bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 border-amber-500/30'"
                  >
                    Anunciado: {{ Number(order().montoPagaCon) | currencyPEN }}
                  </button>
                }

                @for (d of billetesSugeridos(); track d) {
                  <button
                    type="button"
                    (click)="onMontoChange.emit(d)"
                    class="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border font-mono transition cursor-pointer"
                    [ngClass]="montoPagaCliente() === d ? 'bg-sky-600 text-white border-sky-400' : 'bg-white/10 text-slate-200 hover:bg-white/15 border-white/10'"
                  >
                    S/ {{ d }}
                  </button>
                }
              </div>

              <!-- Input directo para montos personalizados -->
              <div class="flex items-center gap-2 pt-1">
                <span class="text-slate-400">Cliente paga con S/.:</span>
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  [ngModel]="montoPagaCliente()"
                  (ngModelChange)="onMontoChange.emit($event)"
                  class="w-32 px-3 py-1.5 rounded-xl bg-black border border-white/20 text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                />
              </div>

              <!-- Alerta de monto insuficiente -->
              @if (montoInsuficiente()) {
                <div class="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold text-xs flex items-center gap-2">
                  <svg class="w-4 h-4 shrink-0 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                  <span>Monto insuficiente: faltan {{ faltante() | currencyPEN }}</span>
                </div>
              } @else {
                <div class="pt-2 border-t border-white/10 flex justify-between items-center text-sm font-bold">
                  <span class="text-slate-400">Vuelto a entregar:</span>
                  <span class="font-mono text-emerald-400 font-black text-base">
                    {{ vuelto() | currencyPEN }}
                  </span>
                </div>
              }
            </div>
          }

          <button
            (click)="onConfirm.emit()"
            [disabled]="esBotonDeshabilitado()"
            class="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-lg flex items-center justify-center gap-1.5"
          >
            <svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            <span>Confirmar Cobrado y Entregado</span>
          </button>
        </div>

      </div>
    </div>
  `
})
export class DeliveryConfirmModalComponent {
  readonly order = input.required<Order>();
  readonly montoPagaCliente = input.required<number>();
  readonly vuelto = input.required<number>();

  readonly onClose = output<void>();
  readonly onMontoChange = output<number>();
  readonly onConfirm = output<void>();

  readonly getCodeNum = getCodeNum;
  readonly Number = Number;

  readonly billetesSugeridos = computed(() => {
    const total = this.order().total;
    const opciones = [20, 50, 100, 200];
    return opciones.filter(d => d > total);
  });

  readonly montoInsuficiente = computed(() => {
    if (!this.order().requiereCobroEfectivo) return false;
    const pagado = this.montoPagaCliente();
    return pagado === null || pagado === undefined || pagado < this.order().total;
  });

  readonly faltante = computed(() => {
    const pagado = this.montoPagaCliente() || 0;
    const f = this.order().total - pagado;
    return f > 0 ? f : 0;
  });

  readonly esBotonDeshabilitado = computed(() => {
    if (!this.order().requiereCobroEfectivo) return false;
    return this.montoInsuficiente();
  });
}
