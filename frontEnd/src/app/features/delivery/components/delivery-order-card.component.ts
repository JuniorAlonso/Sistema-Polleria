import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { Order } from '../../../core/models/order.model';
import { getCodeNum } from './delivery.utils';

@Component({
  selector: 'app-delivery-order-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CurrencyPENPipe],
  template: `
                <div class="p-5 rounded-2xl bg-[#14161a] border border-white/10 shadow-xl space-y-4 hover:border-sky-500/40 transition">

                  <!-- Header Card -->
                  <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-3 border-b border-white/10">
                    <div class="flex items-center gap-3">
                      <span class="font-mono text-xl font-black text-white">
                        #{{ getCodeNum(order().codigoSeguimiento) }}
                      </span>
                      <span class="px-2.5 py-0.5 rounded-full text-xs font-bold" [ngClass]="{
                        'bg-rose-500/20 text-rose-300': order().estado === 'PAGADO' || order().estado === 'PENDIENTE_PAGO',
                        'bg-amber-500/20 text-amber-300': order().estado === 'EN_PREPARACION',
                        'bg-purple-500/20 text-purple-300': order().estado === 'LISTO_COCINA',
                        'bg-sky-500/20 text-sky-300': order().estado === 'EN_REPARTO',
                        'bg-amber-400/20 text-amber-300 border border-amber-400/40': order().estado === 'EN_PUERTA'
                      }">
                        {{ order().estado === 'LISTO_COCINA' ? 'LISTO PARA RECOGER' : order().estado === 'EN_PUERTA' ? 'EN LA PUERTA (TIMER 30M)' : order().estado }}
                      </span>
                    </div>

                    <div class="flex items-center gap-3">
                      <span class="font-display text-xl font-bold text-polleria-gold">
                        {{ order().total | currencyPEN }}
                      </span>
                    </div>
                  </div>

                  <!-- Client & Address Info -->
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div class="space-y-1">
                      <span class="text-slate-400 font-bold">Cliente:</span>
                      <p class="text-sm font-bold text-white">{{ order().cliente.nombre || 'Cliente San Pollo' }}</p>
                      <div class="flex items-center gap-2 pt-1">
                        @if (order().cliente.celular) {
                          <a
                            [href]="'tel:' + order().cliente.celular"
                            class="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 flex items-center gap-1 transition font-mono font-bold"
                          >
                            <svg class="w-3.5 h-3.5 inline mr-1 text-polleria-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>{{ order().cliente.celular }}
                          </a>
                          <button
                            (click)="onSendWhatsApp.emit(order())"
                            class="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white flex items-center gap-1 transition cursor-pointer font-bold"
                            title="Enviar WhatsApp directo al cliente"
                          >
                            <svg class="w-3.5 h-3.5 inline mr-1 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>WhatsApp
                          </button>
                        }
                      </div>
                    </div>

                    <div class="space-y-1">
                      <span class="text-slate-400 font-bold">Dirección de Entrega:</span>
                      <p class="text-slate-200 font-medium">{{ order().cliente.direccion || 'Ica, Perú' }}</p>
                      @if (order().cliente.referencia || order().notasGenerales) {
                        <p class="text-[11px] text-slate-400 italic">Ref: {{ order().cliente.referencia || order().notasGenerales }}</p>
                      }
                      @if (order().cliente.direccion) {
                        <a
                          [href]="'https://www.google.com/maps/search/?api=1&query=' + encodeUri(order().cliente.direccion + ', Ica, Peru')"
                          target="_blank"
                          class="inline-flex items-center gap-1 text-sky-400 hover:underline pt-1 font-bold"
                        >
                          <svg class="w-3.5 h-3.5 inline mr-1 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>Ver en Google Maps / Waze
                        </a>
                      }
                    </div>
                  </div>

                  <!-- Products Summary -->
                  <div class="p-3 rounded-xl bg-black/40 border border-white/5 text-xs space-y-1">
                    <span class="text-slate-400 font-bold block">Contenido del Pedido:</span>
                    @for (item of order().items; track item.product.id) {
                      <p class="text-slate-300"><strong class="text-white">{{ item.cantidad }}x</strong> {{ item.product.nombre }}</p>
                    }
                  </div>

                  <!-- Action Buttons Steps -->
                  <div class="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
                    <div class="text-xs text-slate-400">
                      <span>Método de pago: </span>
                      <span class="font-bold text-white font-mono">{{ order().requiereCobroEfectivo ? 'CONTRAENTREGA (cobrar efectivo)' : 'PAGADO' }}</span>
                    </div>

                    <div class="flex flex-wrap items-center gap-2">
                      @if (order().estado === 'LISTO_COCINA') {
                        <button
                          (click)="onClaimOrder.emit(order())"
                          [disabled]="!canClaim()"
                          class="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-lg flex items-center gap-1.5"
                        >
                          <span class="flex items-center justify-center gap-1.5"><svg class="w-4 h-4 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>Tomar Pedido</span>
                        </button>
                      } @else if (order().estado === 'EN_REPARTO') {
                        <button
                          (click)="onArrivedAtDoor.emit(order())"
                          class="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-lg flex items-center gap-1.5"
                        >
                          <span class="flex items-center justify-center gap-1.5">🔔 Llegué a la Puerta</span>
                        </button>
                      } @else if (order().estado === 'EN_PUERTA') {
                        <div class="flex items-center gap-2">
                          <span class="px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold">
                            ⏱ Esperando: {{ minutosEnPuerta() }}m / 30m
                          </span>
                          <button
                            (click)="onMarkDelivered.emit(order())"
                            class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-lg flex items-center gap-1.5"
                          >
                            <span class="flex items-center justify-center gap-1.5"><svg class="w-4 h-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>Cobrar y Entregar</span>
                          </button>
                          <button
                            (click)="onDeclareGhost.emit(order())"
                            class="px-3.5 py-2.5 rounded-xl bg-rose-950/70 hover:bg-rose-800 border border-rose-500/40 text-rose-300 text-xs font-bold uppercase tracking-wider transition cursor-pointer"
                            title="Declarar Pedido Fantasma si el cliente no sale tras 30 min"
                          >
                            <span>✕ No Sale</span>
                          </button>
                        </div>
                      }
                    </div>
                  </div>

                </div>
  `
})
export class DeliveryOrderCardComponent {
  readonly order = input.required<Order>();
  readonly canClaim = input.required<boolean>();
  readonly minutosEnPuerta = input<number>(0);

  readonly onClaimOrder = output<Order>();
  readonly onArrivedAtDoor = output<Order>();
  /** "Cobrar y Entregar": el contenedor abre el modal de cobro. */
  readonly onMarkDelivered = output<Order>();
  readonly onDeclareGhost = output<Order>();
  readonly onSendWhatsApp = output<Order>();

  readonly getCodeNum = getCodeNum;

  encodeUri(str: string): string {
    return encodeURIComponent(str);
  }
}
