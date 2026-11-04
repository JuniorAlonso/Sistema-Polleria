import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { CapturaPendiente, RechazarCapturaEvent } from '../models/cajero.models';
import { MINUTOS_VALIDACION_PAGO, minutosRestantes } from '../models/cajero-plazos.helpers';
import { PagoOrdenAdmin } from '../../../core/models/payment.model';

/**
 * PENDIENTE_PAGO inbox (WhatsApp orders paid with Yape/Plin). Presentational: the container
 * calls payments-service and only reloads the list after the backend answered.
 */
@Component({
  selector: 'app-cajero-capturas-tab',
  standalone: true,
  imports: [CommonModule, CurrencyPENPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <div class="space-y-4">
      <div class="p-5 rounded-2xl bg-[#14161a] border border-white/10 flex justify-between items-center">
        <div>
          <h3 class="font-bold text-base text-white flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-sky-400 animate-pulse"></span>
            <span>Bandeja de Capturas de Pago (Yape / Plin)</span>
          </h3>
          <p class="text-xs text-slate-400">
            Plazo máximo: {{ plazo }} minutos desde que se creó el pedido. Sin captura adjunta no se puede confirmar.
          </p>
        </div>
        <span class="px-3 py-1 rounded-xl bg-sky-500/20 text-sky-300 font-bold text-xs border border-sky-500/30">
          {{ capturas().length }} pendientes
        </span>
      </div>

      @if (error()) {
        <p class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">{{ error() }}</p>
      }

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        @for (c of capturas(); track c.orden.id) {
          @let restantes = minutosRestantes(c.orden.createdAt, plazo, now());
          @let vencido = restantes !== null && restantes <= 0;
          <div class="p-5 rounded-2xl bg-[#14161a] border shadow-xl space-y-3"
               [ngClass]="vencido ? 'border-rose-500/40' : 'border-sky-500/30'">
            <div class="flex justify-between items-start border-b border-white/10 pb-2">
              <div>
                <span class="font-mono text-base font-black text-sky-300">#{{ c.orden.codigoSeguimiento || c.orden.id }}</span>
                <p class="text-sm font-bold text-white">{{ c.orden.cliente.nombre }}</p>
                <p class="text-[11px] text-slate-400">{{ c.orden.tipo === 'RECOJO_EN_TIENDA' ? 'Recojo en tienda' : 'Delivery' }}</p>
              </div>
              <div class="text-right">
                <span class="text-xs text-slate-400 block font-mono">Monto:</span>
                <span class="font-mono text-lg font-black text-polleria-gold">{{ c.orden.total | currencyPEN }}</span>
                @if (restantes !== null) {
                  <span class="block text-[11px] font-mono font-bold" [ngClass]="vencido ? 'text-rose-400' : 'text-amber-300'">
                    {{ vencido ? 'Plazo vencido' : '⏱ ' + restantes + ' min restantes' }}
                  </span>
                }
              </div>
            </div>

            @if (c.pago?.comprobanteUrl) {
              <a [href]="c.pago!.comprobanteUrl" target="_blank" rel="noopener" class="block">
                <img [src]="c.pago!.comprobanteUrl" alt="Captura de pago del cliente"
                     class="w-full max-h-72 object-contain rounded-xl bg-black/40 border border-white/10" />
              </a>
            } @else {
              <div class="p-6 rounded-xl bg-black/40 border border-dashed border-white/10 text-center text-xs text-slate-400">
                El cliente todavía no adjuntó la captura de pago.
              </div>
            }

            <div class="flex items-center gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                (click)="aprobar.emit(c.pago!)"
                [disabled]="procesando() || vencido || !c.pago?.comprobanteUrl"
                class="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer"
              >
                ✓ Confirmar Pago
              </button>
              <button
                type="button"
                (click)="pedirMotivoYRechazar(c.pago!)"
                [disabled]="procesando() || !c.pago"
                class="py-2 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 disabled:opacity-40 disabled:cursor-not-allowed text-rose-300 border border-rose-500/30 font-bold text-xs transition cursor-pointer"
              >
                ✕ Rechazar
              </button>
            </div>
          </div>
        } @empty {
          <div class="col-span-2 py-12 text-center text-slate-500 bg-[#14161a] rounded-2xl border border-white/10">
            <p class="text-sm">No hay pedidos esperando validación de captura.</p>
          </div>
        }
      </div>
    </div>
  `
})
export class CajeroCapturasTabComponent {
  readonly capturas = input.required<CapturaPendiente[]>();
  readonly now = input.required<number>();
  readonly procesando = input<boolean>(false);
  readonly error = input<string | null>(null);

  readonly aprobar = output<PagoOrdenAdmin>();
  readonly rechazar = output<RechazarCapturaEvent>();

  protected readonly plazo = MINUTOS_VALIDACION_PAGO;
  protected readonly minutosRestantes = minutosRestantes;

  protected pedirMotivoYRechazar(pago: PagoOrdenAdmin): void {
    const motivo = (prompt('Motivo del rechazo (se enviará al cliente):') ?? '').trim();
    if (motivo) this.rechazar.emit({ pago, motivo });
  }
}
