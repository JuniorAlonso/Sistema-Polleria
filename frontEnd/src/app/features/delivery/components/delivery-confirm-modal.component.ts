import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { Order } from '../../../core/models/order.model';
import { getCodeNum } from './delivery.utils';

@Component({
  selector: 'app-delivery-confirm-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CurrencyPENPipe],
  template: `
          <div class="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div class="bg-[#14161a] w-full max-w-lg rounded-3xl border border-white/15 p-6 space-y-4 shadow-2xl">

              <div class="flex justify-between items-start pb-3 border-b border-white/10">
                <div>
                  <h3 class="font-display text-2xl font-bold text-white">Confirmar Entrega y Cobro</h3>
                  <span class="text-xs text-slate-400">Orden #{{ getCodeNum(order().codigoSeguimiento || '') }} • {{ order().cliente.nombre }}</span>
                </div>
                <button (click)="onClose.emit()" class="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer" aria-label="Cerrar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
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
                    <label class="font-bold text-slate-300 block">Calculadora de Vuelto:</label>
                    <div class="flex items-center gap-2">
                      <span class="text-slate-400">Cliente paga con S/.:</span>
                      <input
                        type="number"
                        [ngModel]="montoPagaCliente()"
                        (ngModelChange)="onMontoChange.emit($event)"
                        class="w-28 px-3 py-1.5 rounded-xl bg-black border border-white/20 text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                      />
                    </div>
                    <div class="pt-2 border-t border-white/10 flex justify-between items-center text-sm font-bold">
                      <span class="text-slate-400">Vuelto a entregar:</span>
                      <span class="font-mono text-emerald-400">
                        {{ vuelto() | currencyPEN }}
                      </span>
                    </div>
                  </div>
                }

                <button
                  (click)="onConfirm.emit()"
                  class="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-lg"
                >
                  <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>Confirmar Cobrado y Entregado
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
}
