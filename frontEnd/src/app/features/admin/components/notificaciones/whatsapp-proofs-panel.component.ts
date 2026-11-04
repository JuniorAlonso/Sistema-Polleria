import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyPENPipe } from '../../../../shared/pipes/currency-pen.pipe';
import { Order } from '../../../../core/models/order.model';
import { obtenerResumenPlatos } from '../../shared/admin-format.util';

/** Validación de comprobantes Yape recibidos por WhatsApp. Presentacional. */
@Component({
  selector: 'app-whatsapp-proofs-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CurrencyPENPipe],
  template: `
          <div class="bg-[#14161a] rounded-2xl border border-white/10 shadow-xl p-5 space-y-4">
            <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <h3 class="text-lg font-bold text-white flex items-center gap-2">
                  <span class="p-1.5 rounded-lg bg-polleria-gold/15 text-polleria-gold">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </span>
                  <span>Validación de Comprobantes Yape (WhatsApp)</span>
                  @if (comprobantesWhatsappPendientes().length > 0) {
                    <span class="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                      {{ comprobantesWhatsappPendientes().length }} por confirmar
                    </span>
                  } @else {
                    <span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Al día
                    </span>
                  }
                </h3>
                <p class="text-xs text-slate-400 mt-1">
                  Revisa y confirma la captura de pago enviada por el cliente desde WhatsApp para pasar el pedido a cocina o rechazarlo si el comprobante no es válido.
                </p>
              </div>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  (click)="refreshRequested.emit()"
                  class="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Refrescar</span>
                </button>
              </div>
            </div>

            @if (comprobantesWhatsappPendientes().length === 0) {
              <div class="p-6 rounded-xl bg-black/20 border border-white/5 flex flex-col items-center justify-center text-center space-y-2">
                <div class="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p class="text-sm font-semibold text-slate-300">No hay comprobantes pendientes de validación</p>
                <p class="text-xs text-slate-500 max-w-md">
                  Cuando un cliente envíe su captura de Yape por WhatsApp, aparecerá aquí automáticamente para que el administrador la verifique y apruebe el pedido.
                </p>
              </div>
            } @else {
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                @for (orden of comprobantesWhatsappPendientes(); track orden.id) {
                  <div class="bg-black/30 rounded-xl border border-white/10 hover:border-polleria-gold/40 transition-all p-4 flex flex-col justify-between space-y-3 shadow-lg">
                    <div class="space-y-2">
                      <div class="flex items-center justify-between gap-2">
                        <span class="font-mono font-bold text-sm text-polleria-gold">
                          #{{ orden.id }}
                        </span>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          [ngClass]="tieneCapturaPendiente(orden) ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-700/50 text-slate-300 border border-white/10'">
                          {{ tieneCapturaPendiente(orden) ? '📸 Captura por Validar' : '⏳ Esperando Captura' }}
                        </span>
                      </div>

                      <div class="text-xs space-y-1">
                        <div class="flex items-center justify-between text-slate-300">
                          <span class="text-slate-400">Cliente:</span>
                          <span class="font-semibold text-white truncate max-w-[150px]">{{ orden.cliente.nombre || 'Cliente' }}</span>
                        </div>
                        <div class="flex items-center justify-between text-slate-300">
                          <span class="text-slate-400">Celular:</span>
                          <a [href]="'https://wa.me/51' + orden.cliente.celular" target="_blank" class="font-mono text-emerald-400 hover:underline flex items-center gap-1">
                            <span>{{ orden.cliente.celular }}</span>
                            <span class="text-[10px]">↗</span>
                          </a>
                        </div>
                        <div class="flex items-center justify-between text-slate-300">
                          <span class="text-slate-400">Monto total:</span>
                          <span class="font-mono font-bold text-white text-sm">{{ orden.total | currencyPEN }}</span>
                        </div>
                      </div>

                      <div class="p-2 rounded-lg bg-black/40 border border-white/5 text-[11px] text-slate-400 line-clamp-2">
                        {{ obtenerResumenPlatos(orden) }}
                      </div>
                    </div>

                    <button
                      type="button"
                      (click)="verifyRequested.emit(orden)"
                      class="w-full py-2 px-3 rounded-xl bg-polleria-gold hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span>Revisar Captura Yape</span>
                    </button>
                  </div>
                }
              </div>
            }
          </div>
  `
})
export class WhatsappProofsPanelComponent {
  readonly comprobantesWhatsappPendientes = input.required<Order[]>();
  /** Ids (string) de las órdenes con una captura de comprobante por validar. */
  readonly capturasPendientesIds = input.required<ReadonlySet<string>>();

  readonly refreshRequested = output<void>();
  readonly verifyRequested = output<Order>();

  protected readonly obtenerResumenPlatos = obtenerResumenPlatos;

  protected tieneCapturaPendiente(orden: Order): boolean {
    return this.capturasPendientesIds().has(String(orden.id));
  }
}
