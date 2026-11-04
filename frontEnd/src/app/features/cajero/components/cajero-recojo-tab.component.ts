import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { Order } from '../../../core/models/order.model';
import { EntregaRecojoEvent } from '../models/cajero.models';
import { MINUTOS_ESPERA_RECOJO, minutosRestantes } from '../models/cajero-plazos.helpers';

/**
 * Pickup counter: orders ready in store (LISTO_PARA_ENTREGAR). The cashier checks the customer's
 * ticket, collects the cash when the order is ContraPago and hands it over. After 1 hour the
 * order can be declared a ghost order. Presentational: every action goes through the container.
 */
@Component({
  selector: 'app-cajero-recojo-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPENPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <div class="space-y-4">
      <div class="p-5 rounded-2xl bg-[#14161a] border border-white/10 flex justify-between items-center">
        <div>
          <h3 class="font-bold text-base text-white flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Bandeja de Recojo en Tienda</span>
          </h3>
          <p class="text-xs text-slate-400">
            El cliente fue notificado al quedar listo. Tiene {{ plazo }} minutos para recoger; verifica su ticket antes de entregar.
          </p>
        </div>
        <span class="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/30">
          {{ ordenes().length }} por entregar
        </span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        @for (o of ordenes(); track o.id) {
          @let restantes = minutosRestantes(o.listoAt, plazo, now());
          @let vencido = restantes !== null && restantes <= 0;
          <div class="p-5 rounded-2xl bg-[#14161a] border shadow-xl space-y-3"
               [ngClass]="vencido ? 'border-rose-500/40' : 'border-emerald-500/30'">
            <div class="flex justify-between items-start border-b border-white/10 pb-2">
              <div>
                <span class="font-mono text-base font-black text-emerald-300">#{{ o.codigoSeguimiento || o.id }}</span>
                <p class="text-sm font-bold text-white">{{ o.cliente.nombre }}</p>
                @if (o.cliente.celular) {
                  <a [href]="'tel:' + o.cliente.celular" class="text-[11px] text-emerald-400 font-mono hover:underline">📞 {{ o.cliente.celular }}</a>
                }
              </div>
              <div class="text-right">
                <span class="text-xs text-slate-400 block font-mono">
                  {{ o.requiereCobroEfectivo ? 'COBRAR EN EFECTIVO:' : 'PAGADO' }}
                </span>
                <span class="font-mono text-lg font-black text-polleria-gold">{{ o.total | currencyPEN }}</span>
                @if (restantes !== null) {
                  <span class="block text-[11px] font-mono font-bold" [ngClass]="vencido ? 'text-rose-400' : 'text-amber-300'">
                    {{ vencido ? 'Plazo de 1 hora vencido' : '⏱ ' + restantes + ' min para recoger' }}
                  </span>
                }
              </div>
            </div>

            <div class="space-y-2 text-xs">
              <label class="block text-slate-400 font-bold">Código del ticket del cliente</label>
              <input type="text" [(ngModel)]="codigos[o.id]" placeholder="Ej: POL-0042"
                     class="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white font-mono focus:outline-none focus:border-emerald-400" />
              @if (o.requiereCobroEfectivo) {
                <label class="block text-slate-400 font-bold">Efectivo recibido (S/)</label>
                <input type="number" min="0" step="0.10" [(ngModel)]="efectivo[o.id]"
                       class="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white font-mono focus:outline-none focus:border-emerald-400" />
                <p class="text-slate-300">Vuelto: <strong class="text-emerald-300 font-mono">S/ {{ vuelto(o) }}</strong></p>
              }
            </div>

            <div class="flex items-center gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                (click)="entregar.emit({ orden: o, codigoTicket: codigos[o.id] || '', efectivoRecibido: efectivo[o.id] || 0 })"
                [disabled]="procesando() || !(codigos[o.id] || '').trim() || (o.requiereCobroEfectivo && (efectivo[o.id] || 0) < o.total)"
                class="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer"
              >
                {{ o.requiereCobroEfectivo ? '✓ Cobrar y Entregar' : '✓ Entregar' }}
              </button>
              @if (vencido) {
                <button
                  type="button"
                  (click)="fantasma.emit(o)"
                  [disabled]="procesando()"
                  class="py-2 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 disabled:opacity-40 text-rose-300 border border-rose-500/30 font-bold text-xs transition cursor-pointer"
                >
                  Pedido Fantasma
                </button>
              }
            </div>
          </div>
        } @empty {
          <div class="col-span-2 py-12 text-center text-slate-500 bg-[#14161a] rounded-2xl border border-white/10">
            <p class="text-sm">No hay pedidos listos para recoger.</p>
          </div>
        }
      </div>
    </div>
  `
})
export class CajeroRecojoTabComponent {
  readonly ordenes = input.required<Order[]>();
  readonly now = input.required<number>();
  readonly procesando = input<boolean>(false);

  readonly entregar = output<EntregaRecojoEvent>();
  readonly fantasma = output<Order>();

  protected readonly plazo = MINUTOS_ESPERA_RECOJO;
  protected readonly minutosRestantes = minutosRestantes;
  protected codigos: Record<string, string> = {};
  protected efectivo: Record<string, number> = {};

  protected vuelto(o: Order): string {
    return Math.max(0, (Number(this.efectivo[o.id]) || 0) - o.total).toFixed(2);
  }
}
