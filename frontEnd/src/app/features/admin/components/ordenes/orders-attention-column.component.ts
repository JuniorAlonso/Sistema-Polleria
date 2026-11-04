import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyPENPipe } from '../../../../shared/pipes/currency-pen.pipe';
import { Order } from '../../../../core/models/order.model';
import { OrderAdvance, ProofState } from '../../models/admin-forms';
import {
  formatRemaining,
  getCodeNum,
  ghostHint,
  ghostWindow,
  GhostWindow,
  proofRemainingMs
} from '../../shared/admin-format.util';

/**
 * Columna "ATENCIÓN" del tablero: pedidos que esperan una acción humana antes de avanzar
 * (comprobante de Yape, llamada de confirmación ContraPago, cliente en la puerta).
 * Presentacional: solo input()/output(); cada acción llama al endpoint real desde el contenedor.
 */
@Component({
  selector: 'app-orders-attention-column',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CurrencyPENPipe],
  template: `
    <div class="bg-[#121418] rounded-2xl border border-white/5 flex flex-col overflow-hidden shadow-xl">
      <div class="p-4 border-b border-white/5 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-fuchsia-500"></span>
          <h2 class="font-display text-lg tracking-wider uppercase text-white font-bold">ATENCIÓN</h2>
        </div>
        <span class="w-6 h-6 rounded-full bg-fuchsia-600 text-white text-xs font-black flex items-center justify-center font-mono">
          {{ orders().length }}
        </span>
      </div>

      <div class="flex-1 p-3 space-y-3 overflow-y-auto">
        @for (order of orders(); track order.id) {
          <div
            (click)="orderSelected.emit(order)"
            class="p-4 rounded-xl bg-[#1c1f24] border border-white/5 hover:border-polleria-gold/50 transition space-y-3 shadow-md cursor-pointer group"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="font-mono text-base font-black text-white group-hover:text-polleria-gold transition">
                  #{{ getCodeNum(order.codigoSeguimiento) }}
                </span>
                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-300">{{ order.tipo }}</span>
              </div>
              <span class="text-xs font-bold text-slate-300">{{ order.cliente.nombre }}</span>
            </div>

            @switch (order.estado) {
              @case ('PENDIENTE_PAGO') {
                <div class="text-xs space-y-1.5">
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded border font-mono"
                    [ngClass]="proofClass(order)">
                    {{ proofLabel(order) }}
                  </span>
                  @if (proofHint(order); as hint) {
                    <p class="text-[11px] text-slate-400" data-testid="proof-hint">{{ hint }}</p>
                  }
                </div>
                <div class="pt-2 border-t border-white/5 flex items-center justify-between" (click)="$event.stopPropagation()">
                  <span class="font-display text-xl font-bold text-polleria-gold">{{ order.total | currencyPEN }}</span>
                  <div class="flex items-center gap-1.5">
                    <button type="button" (click)="cancelled.emit(order)"
                      class="p-1.5 rounded-lg bg-white/5 hover:bg-rose-600/30 text-rose-400 transition cursor-pointer" title="Cancelar pedido">✕</button>
                    <button type="button" (click)="orderSelected.emit(order)"
                      [disabled]="!canVerifyProof(order)"
                      [attr.title]="proofHint(order) || 'Abrir el detalle para aprobar o rechazar el comprobante'"
                      class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                      Verificar comprobante
                    </button>
                  </div>
                </div>
              }
              @case ('PENDIENTE_CONFIRMACION') {
                <div class="text-xs text-slate-300 space-y-1">
                  <p>Teléfono: <strong class="text-white font-mono">{{ order.cliente.celular || '—' }}</strong></p>
                  <p>
                    Efectivo: <strong class="text-polleria-gold">{{ order.total | currencyPEN }}</strong>
                    @if (order.montoPagaCon) {
                      <span class="text-slate-400"> · paga con {{ order.montoPagaCon | currencyPEN }}</span>
                    }
                    @if (order.vueltoEstimado) {
                      <span class="text-slate-400"> · vuelto {{ order.vueltoEstimado | currencyPEN }}</span>
                    }
                  </p>
                  <p class="text-[11px] text-amber-300" data-testid="call-timer">{{ callTimer(order) }}</p>
                  <p class="text-[11px] text-slate-400">Intentos de llamada: {{ order.intentosLlamada ?? 0 }}</p>
                </div>
                <div class="pt-2 border-t border-white/5 flex items-center justify-end gap-1.5" (click)="$event.stopPropagation()">
                  <button type="button" (click)="callAttempt.emit(order)"
                    class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-amber-600 text-white font-bold text-xs transition cursor-pointer">
                    Sin respuesta
                  </button>
                  <button type="button" (click)="confirmCall.emit(order)"
                    class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer">
                    Confirmar llamada
                  </button>
                </div>
              }
              @case ('EN_PUERTA') {
                @if (ghost(order); as g) {
                  <div class="text-xs space-y-1">
                    <p class="text-sky-300 font-bold">El repartidor está en la puerta</p>
                    <p class="text-[11px] text-slate-400" data-testid="ghost-hint">{{ ghostText(g) }}</p>
                    @if (order.requiereCobroEfectivo) {
                      <p class="text-[11px] text-amber-300">Cobro en efectivo pendiente: lo registra el repartidor antes de entregar.</p>
                    }
                  </div>
                  <div class="pt-2 border-t border-white/5 flex items-center justify-end gap-1.5" (click)="$event.stopPropagation()">
                    <button type="button" (click)="declareGhost.emit(order)"
                      [disabled]="!g.canDeclare"
                      [attr.title]="ghostText(g)"
                      class="px-3 py-1.5 rounded-lg bg-rose-900/40 hover:bg-rose-700 text-rose-300 font-bold text-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                      Pedido fantasma
                    </button>
                    @if (!order.requiereCobroEfectivo) {
                      <button type="button" (click)="advance.emit({ order, status: 'COMPLETADO' })"
                        class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer">
                        Confirmar entrega
                      </button>
                    }
                  </div>
                }
              }
            }
          </div>
        } @empty {
          <p class="text-center text-xs text-slate-500 py-6">Nada pendiente de atención.</p>
        }
      </div>
    </div>
  `
})
export class OrdersAttentionColumnComponent {
  readonly orders = input.required<Order[]>();
  /** Reloj del contenedor (ms): evita leer Date.now() dentro de la vista. */
  readonly now = input.required<number>();
  /** Estado del comprobante por id de orden (solo órdenes PENDIENTE_PAGO). */
  readonly proofStates = input.required<Record<string, ProofState>>();

  readonly orderSelected = output<Order>();
  readonly cancelled = output<Order>();
  readonly confirmCall = output<Order>();
  readonly callAttempt = output<Order>();
  readonly declareGhost = output<Order>();
  readonly advance = output<OrderAdvance>();

  protected readonly getCodeNum = getCodeNum;

  protected proofState(order: Order): ProofState {
    return this.proofStates()[String(order.id)] ?? 'SIN_COMPROBANTE';
  }

  protected proofLabel(order: Order): string {
    switch (this.proofState(order)) {
      case 'PENDIENTE_VERIFICACION': return 'COMPROBANTE POR VERIFICAR';
      case 'RECHAZADO': return 'COMPROBANTE RECHAZADO';
      default: return 'SIN COMPROBANTE';
    }
  }

  protected proofClass(order: Order): string {
    switch (this.proofState(order)) {
      case 'PENDIENTE_VERIFICACION': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'RECHAZADO': return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      default: return 'bg-slate-700/60 text-slate-300 border-white/10';
    }
  }

  /** Verification needs an attached capture and the 15-minute window still open. */
  protected canVerifyProof(order: Order): boolean {
    return this.proofState(order) === 'PENDIENTE_VERIFICACION' && !this.windowExpired(order);
  }

  /** Why the verify button is disabled; null when it is enabled. */
  protected proofHint(order: Order): string | null {
    if (this.proofState(order) !== 'PENDIENTE_VERIFICACION') {
      return 'El cliente aún no adjuntó un comprobante de Yape.';
    }
    if (this.windowExpired(order)) {
      return 'Pasaron más de 15 minutos desde que se creó el pedido: ya no se puede verificar.';
    }
    return null;
  }

  protected callTimer(order: Order): string {
    const remaining = proofRemainingMs(order, this.now());
    if (remaining === null) return 'Sin hora de creación registrada';
    return remaining <= 0
      ? 'Plazo de 15 min vencido: el pedido se cancelará'
      : `Confirmar en ${formatRemaining(remaining)}`;
  }

  protected ghost(order: Order): GhostWindow | null {
    return ghostWindow(order, this.now());
  }

  protected ghostText(window: GhostWindow): string {
    return ghostHint(window);
  }

  private windowExpired(order: Order): boolean {
    const remaining = proofRemainingMs(order, this.now());
    return remaining !== null && remaining <= 0;
  }
}
