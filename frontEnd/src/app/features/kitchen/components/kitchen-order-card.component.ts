import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Order, OrderStatus } from '../../../core/models/order.model';
import { OrderStatusBadgeComponent } from '../../../shared/components/order-status-badge/order-status-badge.component';
import { codigoNumerico } from '../kitchen.types';

@Component({
  selector: 'app-kitchen-order-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, OrderStatusBadgeComponent],
  template: `
                <div
                  class="rounded-3xl border flex flex-col justify-between transition-all duration-300 shadow-xl overflow-hidden animate-slide-up motion-reduce:animate-none"
                  [ngClass]="{
                    'border-rose-500/40 ring-1 ring-rose-500/20': order().estado === 'PAGADO',
                    'border-slate-500/40 opacity-80': esperando(),
                    'border-amber-500/50 ring-1 ring-amber-500/30': order().estado === 'EN_PREPARACION',
                    'border-purple-500/50 ring-1 ring-purple-500/30': order().estado === 'LISTO_COCINA'
                  }"
                  style="background-color: #14161a;"
                >
                  <div class="p-4 border-b border-white/10 flex justify-between items-start bg-black/40">
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="font-mono text-base font-black text-white">
                          #{{ codeNum() }}
                        </span>
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-slate-300">
                          {{ order().tipo }}
                        </span>
                        @if (esNueva()) {
                          <span class="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 animate-pulse motion-reduce:animate-none">
                            Nueva
                          </span>
                        }
                      </div>
                      <h3 class="font-bold text-sm text-slate-200 mt-1">
                        {{ order().cliente.nombre || 'Cliente San Pollo' }}
                      </h3>
                      @if (order().tipo === 'SALON') {
                        <p class="text-[11px] font-bold text-amber-300 mt-1">
                          Mesa {{ order().cliente.mesaNumero ?? '—' }}
                        </p>
                      }
                      @if (order().cliente.direccion) {
                        <p class="text-[11px] text-slate-400 line-clamp-1"><svg class="w-3 h-3 inline mr-1 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>{{ order().cliente.direccion }}</p>
                      }
                    </div>

                    <div class="flex flex-col items-end gap-1">
                      <app-order-status-badge [status]="order().estado" />
                      <span
                        class="px-2 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap"
                        [ngClass]="claseEspera()"
                        [title]="'Pedido recibido hace ' + minutosEspera() + ' minutos'"
                      >
                        hace {{ minutosEspera() }} min
                      </span>
                    </div>
                  </div>

                  <div class="p-4 flex-1 space-y-2.5 overflow-y-auto max-h-64">
                    @for (item of order().items; track item.product.id) {
                      <div class="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-start gap-3 text-xs">
                        <span class="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-extrabold text-sm shrink-0">
                          {{ item.cantidad }}x
                        </span>
                        <div class="flex-1">
                          <p class="font-bold text-slate-100 text-sm">{{ item.product.nombre }}</p>
                          @if (item.notas) {
                            <p class="text-amber-300 font-medium italic mt-0.5 bg-amber-950/40 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                              <span class="flex items-center gap-1"><svg class="w-3 h-3 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>{{ item.notas }}</span>
                            </p>
                          }
                        </div>
                      </div>
                    }
                    @if (order().notasGenerales || order().cliente.referencia) {
                      <div class="p-2 rounded-lg bg-white/5 text-[11px] text-slate-400 italic">
                        Nota: {{ order().notasGenerales || order().cliente.referencia }}
                      </div>
                    }
                  </div>

                  <div class="p-4 border-t border-white/10 bg-black/40">
                    @if (esperando()) {
                      <div class="flex items-center justify-center p-3 rounded-xl bg-slate-500/10 border border-slate-500/30" data-testid="awaiting-badge">
                        <span class="text-xs text-slate-300 font-bold">
                          {{ order().estado === 'PENDIENTE_PAGO' ? 'Esperando pago: aún no se puede cocinar' : 'Esperando confirmación telefónica: aún no se puede cocinar' }}
                        </span>
                      </div>
                    } @else if (order().estado === 'PAGADO') {
                      <button
                        (click)="cambiarEstado.emit('EN_PREPARACION')"
                        class="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                      >
                        <span class="flex items-center justify-center gap-1.5"><svg class="w-4 h-4 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"/></svg>Empezar a Preparar</span>
                      </button>
                    } @else if (order().estado === 'EN_PREPARACION') {
                      <button
                        (click)="cambiarEstado.emit('LISTO_COCINA')"
                        class="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg cursor-pointer animate-pulse"
                      >
                        <span class="flex items-center justify-center gap-1.5"><svg class="w-4 h-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><span>{{ order().tipo === 'SALON' ? 'Listo para servir en mesa' : 'Listo para Reparto / Empacado' }}</span></span>
                      </button>
                    } @else if (order().estado === 'LISTO_COCINA') {
                      <div class="flex items-center justify-center p-3 rounded-xl bg-purple-500/10 border border-purple-500/30">
                        <span class="text-xs text-purple-300 font-bold flex items-center gap-2">
                          <span class="w-2.5 h-2.5 rounded-full bg-purple-400 animate-ping"></span>
                          <span class="flex items-center justify-center gap-1.5"><svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>{{ order().tipo === 'SALON' ? 'Comanda lista — el mozo ya puede servirla en mesa' : 'Empacado y listo — Esperando que el motorizado retire el pedido' }}</span>
                        </span>
                      </div>
                    }
                  </div>

                </div>
  `
})
export class KitchenOrderCardComponent {
  readonly order = input.required<Order>();
  /** Minutos de espera calculados por el contenedor (depende del reloj). */
  readonly minutosEspera = input.required<number>();
  readonly cambiarEstado = output<OrderStatus>();

  readonly codeNum = computed(() => codigoNumerico(this.order().codigoSeguimiento));

  /** Una comanda recién recibida (todavía sin empezar) se marca como nueva. */
  readonly esNueva = computed(() => {
    return this.order().estado === 'PAGADO';
  });

  /** Awaiting payment or phone confirmation: visible in the KDS but never cookable. */
  readonly esperando = computed(() => {
    const estado = this.order().estado;
    return estado === 'PENDIENTE_PAGO' || estado === 'PENDIENTE_CONFIRMACION';
  });

  readonly claseEspera = computed(() =>
    this.minutosEspera() >= 10
      ? 'text-rose-300 bg-rose-500/15 border-rose-500/30'
      : 'text-slate-300 bg-white/5 border-white/10'
  );
}
