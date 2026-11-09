import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { Order } from '../../../core/models/order.model';
import { cantidadItems, getCodeNum } from './delivery.utils';

/** DISPONIBLE: ready in the kitchen, nobody took it. MIA: assigned to the logged-in courier. */
export type ModoTarjetaReparto = 'DISPONIBLE' | 'MIA';

const PASOS = ['Recoger en local', 'En camino', 'En la puerta', 'Entregado'] as const;

/**
 * One delivery order in the courier tray. The two modes look different on purpose: before taking
 * it the courier only needs where it goes and how it is paid; once it is theirs they get the
 * customer contact, the step they are on and the action for that step.
 */
@Component({
  selector: 'app-delivery-order-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CurrencyPENPipe],
  template: `
    <article
      class="p-5 rounded-2xl border shadow-xl space-y-4 transition"
      [ngClass]="modo() === 'MIA'
        ? 'bg-[#121a16] border-emerald-500/40'
        : 'bg-[#14161a] border-white/10 hover:border-sky-500/40'"
      [class.ring-2]="recienTomado()"
      [class.ring-emerald-400]="recienTomado()"
    >
      <!-- Header -->
      <div class="flex flex-wrap justify-between items-center gap-2 pb-3 border-b border-white/10">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-mono text-xl font-black text-white">#{{ codigo() }}</span>
          <span class="px-2.5 py-0.5 rounded-full text-xs font-bold" [ngClass]="claseEtiqueta()">{{ etiqueta() }}</span>
          @if (recienTomado()) {
            <span class="px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-400 text-slate-950 animate-pulse">¡Recién tomado!</span>
          }
        </div>
        <span class="font-display text-xl font-bold text-polleria-gold">{{ order().total | currencyPEN }}</span>
      </div>

      <!-- Steps (only once it is mine) -->
      @if (modo() === 'MIA') {
        <ol class="grid grid-cols-4 gap-1 text-[10px] sm:text-[11px] font-bold text-center">
          @for (paso of pasos; track paso; let i = $index) {
            <li class="flex flex-col items-center gap-1">
              <span class="w-full h-1.5 rounded-full"
                [ngClass]="i < pasoActual() ? 'bg-emerald-500' : i === pasoActual() ? 'bg-emerald-400 animate-pulse' : 'bg-white/10'"></span>
              @if (i === pasoActual()) {
                <span class="text-emerald-300" data-testid="paso-actual">{{ paso }}</span>
              } @else {
                <span [ngClass]="i < pasoActual() ? 'text-emerald-500/70' : 'text-slate-500'">{{ paso }}</span>
              }
            </li>
          }
        </ol>
        @if (order().estado === 'LISTO_COCINA' || order().estado === 'LISTO' || order().estado === 'LISTO_PARA_ENTREGAR') {
          <p class="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs font-bold">
            Recógelo en el local y toca «Salir a repartir» cuando salgas: avisamos al cliente.
          </p>
        }
      }

      <!-- Where it goes -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div class="space-y-1">
          <span class="text-slate-400 font-bold">Dirección de entrega:</span>
          <p class="text-slate-200 font-medium">{{ order().cliente.direccion || 'Ica' }}</p>
          @if (order().cliente.referencia || order().notasGenerales) {
            <p class="text-[11px] text-slate-400 italic">Ref: {{ order().cliente.referencia || order().notasGenerales }}</p>
          }
          @if (modo() === 'MIA' && order().cliente.direccion) {
            <a
              [href]="'https://www.google.com/maps/search/?api=1&query=' + encodeUri(order().cliente.direccion + ', Ica, Peru')"
              target="_blank" rel="noopener"
              class="inline-flex items-center gap-1 text-sky-400 hover:underline pt-1 font-bold"
            >Ver en Google Maps / Waze</a>
          }
        </div>

        @if (modo() === 'MIA') {
          <div class="space-y-1">
            <span class="text-slate-400 font-bold">Cliente:</span>
            <p class="text-sm font-bold text-white">{{ order().cliente.nombre || 'Cliente San Pollo' }}</p>
            @if (order().cliente.celular) {
              <div class="flex items-center gap-2 pt-1">
                <a [href]="'tel:' + order().cliente.celular"
                   class="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 transition font-mono font-bold">
                  {{ order().cliente.celular }}
                </a>
                <button type="button" (click)="onSendWhatsApp.emit(order())"
                  class="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white transition cursor-pointer font-bold">
                  WhatsApp
                </button>
              </div>
            }
          </div>
        } @else {
          <div class="space-y-1">
            <span class="text-slate-400 font-bold">Pedido:</span>
            <p class="text-slate-200 font-medium">{{ cantidadItems(order()) }} {{ cantidadItems(order()) === 1 ? 'ítem' : 'ítems' }}</p>
          </div>
        }
      </div>

      @if (modo() === 'MIA') {
        <div class="p-3 rounded-xl bg-black/40 border border-white/5 text-xs space-y-1">
          <span class="text-slate-400 font-bold block">Contenido del pedido ({{ cantidadItems(order()) }} {{ cantidadItems(order()) === 1 ? 'ítem' : 'ítems' }}):</span>
          @for (item of order().items; track item.product.id) {
            <p class="text-slate-300"><strong class="text-white">{{ item.cantidad }}x</strong> {{ item.product.nombre }}</p>
          }
        </div>
      }

      <!-- Payment + action for the current step -->
      <div class="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
        <div class="text-xs space-y-1">
          @if (order().requiereCobroEfectivo) {
            <span class="font-bold text-amber-300 block">Cobrar en efectivo al entregar</span>
            @if ((order().vueltoEstimado ?? 0) > 0) {
              <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-200 font-bold text-[11px] border border-amber-500/30">
                Paga con {{ order().montoPagaCon | currencyPEN }} · Llevar vuelto: {{ order().vueltoEstimado | currencyPEN }}
              </span>
            } @else if (order().montoPagaCon) {
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold text-[11px] border border-emerald-500/30">
                Pago exacto anunciado: {{ order().total | currencyPEN }}
              </span>
            } @else {
              <span class="text-slate-400 text-[11px] block">No indicó billete (llevar cambio variado)</span>
            }
          } @else {
            <span class="font-bold text-emerald-300">Ya pagado</span>
          }
        </div>

        <div class="flex flex-wrap items-center gap-2">
          @if (modo() === 'DISPONIBLE') {
            <button type="button" (click)="onClaimOrder.emit(order())" [disabled]="!canClaim() || procesando()"
              class="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-lg">
              {{ procesando() ? 'Tomando…' : 'Tomar pedido' }}
            </button>
          } @else if (order().estado === 'LISTO_COCINA' || order().estado === 'LISTO' || order().estado === 'LISTO_PARA_ENTREGAR') {
            <button type="button" (click)="onStartRoute.emit(order())" [disabled]="procesando()"
              class="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-lg">
              {{ procesando() ? 'Saliendo…' : 'Salir a repartir' }}
            </button>
          } @else if (order().estado === 'EN_REPARTO') {
            <button type="button" (click)="onArrivedAtDoor.emit(order())"
              class="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-lg">
              Llegué a la puerta
            </button>
          } @else if (order().estado === 'EN_PUERTA') {
            <span class="px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold">
              Esperando: {{ minutosEnPuerta() }}m / 30m
            </span>
            <button type="button" (click)="onMarkDelivered.emit(order())"
              class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-lg">
              Cobrar y Entregar
            </button>
            <button type="button" (click)="onDeclareGhost.emit(order())"
              title="Declarar Pedido Fantasma si el cliente no sale tras 30 min"
              class="px-3.5 py-2.5 rounded-xl bg-rose-950/70 hover:bg-rose-800 border border-rose-500/40 text-rose-300 text-xs font-bold uppercase tracking-wider transition cursor-pointer">
              No sale
            </button>
          }
        </div>
      </div>
    </article>
  `
})
export class DeliveryOrderCardComponent {
  readonly order = input.required<Order>();
  readonly modo = input<ModoTarjetaReparto>('MIA');
  readonly canClaim = input<boolean>(true);
  /** A request for this order is in flight: its button is disabled and says so. */
  readonly procesando = input<boolean>(false);
  /** Just taken by this courier: highlighted so they see where it went. */
  readonly recienTomado = input<boolean>(false);
  readonly minutosEnPuerta = input<number>(0);

  readonly onClaimOrder = output<Order>();
  readonly onStartRoute = output<Order>();
  readonly onArrivedAtDoor = output<Order>();
  /** "Cobrar y Entregar": the container opens the payment modal. */
  readonly onMarkDelivered = output<Order>();
  readonly onDeclareGhost = output<Order>();
  readonly onSendWhatsApp = output<Order>();

  readonly pasos = PASOS;
  readonly cantidadItems = cantidadItems;
  readonly codigo = computed(() => getCodeNum(this.order().codigoSeguimiento));

  readonly pasoActual = computed(() => {
    switch (this.order().estado) {
      case 'EN_REPARTO': return 1;
      case 'EN_PUERTA': return 2;
      case 'COMPLETADO':
      case 'ENTREGADO': return 3;
      default: return 0;
    }
  });

  readonly etiqueta = computed(() => {
    if (this.modo() === 'DISPONIBLE') return 'Disponible · listo en cocina';
    switch (this.order().estado) {
      case 'EN_REPARTO': return 'Asignado a ti · en camino';
      case 'EN_PUERTA': return 'Asignado a ti · en la puerta';
      default: return 'Asignado a ti';
    }
  });

  readonly claseEtiqueta = computed(() =>
    this.modo() === 'DISPONIBLE'
      ? 'bg-sky-500/20 text-sky-300'
      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40');

  encodeUri(str: string): string {
    return encodeURIComponent(str);
  }
}
