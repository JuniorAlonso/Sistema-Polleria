import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { Order } from '../../../core/models/order.model';
import { MINUTOS_VALIDACION_PAGO, minutosRestantes } from '../models/cajero-plazos.helpers';

@Component({
  selector: 'app-cajero-llamadas-tab',
  standalone: true,
  imports: [CommonModule, CurrencyPENPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
            <div class="space-y-4">
              <div class="p-5 rounded-2xl bg-[#14161a] border border-white/10 flex justify-between items-center">
                <div>
                  <h3 class="font-bold text-base text-white flex items-center gap-2">
                    <span class="w-3 h-3 rounded-full bg-amber-400 animate-pulse"></span>
                    <span>Bandeja de Confirmación de Llamadas (ContraPago)</span>
                  </h3>
                  <p class="text-xs text-slate-400">
                    SLA Máximo: 15 minutos para llamar al cliente y validar vuelto antes de cocinar. (Máximo 2 intentos).
                  </p>
                </div>
                <span class="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 font-bold text-xs border border-amber-500/30">
                  {{ ordenes().length }} llamadas pendientes
                </span>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                @for (o of ordenes(); track o.id) {
                  @let restantes = minutosRestantes(o.createdAt, plazo, now());
                  @let vencido = restantes !== null && restantes <= 0;
                  <div class="p-5 rounded-2xl bg-[#14161a] border shadow-xl space-y-3"
                       [ngClass]="vencido ? 'border-rose-500/40' : 'border-amber-500/30'">
                    <div class="flex justify-between items-start border-b border-white/10 pb-2">
                      <div>
                        <span class="font-mono text-base font-black text-amber-300">#{{ o.codigoSeguimiento || o.id }}</span>
                        <p class="text-sm font-bold text-white">{{ o.cliente.nombre }}</p>
                      </div>
                      <div class="text-right">
                        <span class="text-xs text-slate-400 block font-mono">Total a Cobrar:</span>
                        <span class="font-mono text-lg font-black text-polleria-gold">{{ o.total | currencyPEN }}</span>
                      </div>
                    </div>

                    <div class="text-xs space-y-1.5">
                      <div class="flex items-center gap-2">
                        <span class="text-slate-400 font-bold">Celular:</span>
                        <a [href]="'tel:' + o.cliente.celular" class="text-emerald-400 font-mono font-bold hover:underline">
                          📞 {{ o.cliente.celular }}
                        </a>
                      </div>
                      <div class="flex items-center gap-2">
                        <span class="text-slate-400 font-bold">Dirección:</span>
                        <span class="text-slate-200 truncate">{{ o.cliente.direccion || 'Ica' }}</span>
                      </div>
                      @if (o.cliente.referencia) {
                        <p class="text-[11px] text-slate-400 italic">Ref: {{ o.cliente.referencia }}</p>
                      }
                      <div class="p-2.5 rounded-xl bg-black/40 border border-white/5 flex justify-between items-center text-xs">
                        <span class="text-slate-300">Paga con billete: <strong class="text-white">S/ {{ o.montoPagaCon || o.total }}</strong></span>
                        <span class="text-emerald-300 font-bold font-mono">Vuelto: S/ {{ o.vueltoEstimado || 0 }}</span>
                      </div>
                      <div class="flex justify-between items-center text-[11px] pt-1 text-slate-400">
                        <span>Intentos realizados: <strong class="text-white">{{ o.intentosLlamada || 0 }} / 2</strong></span>
                        @if (restantes !== null) {
                          <span class="font-mono font-bold" [ngClass]="vencido ? 'text-rose-400' : 'text-amber-300'">
                            {{ vencido ? 'Plazo de 15 min vencido' : '⏱ ' + restantes + ' min restantes' }}
                          </span>
                        }
                      </div>
                    </div>

                    <div class="flex items-center gap-2 pt-2 border-t border-white/10">
                      <button 
                        (click)="confirmar.emit(o)"
                        [disabled]="vencido"
                        class="flex-1 disabled:opacity-40 disabled:cursor-not-allowed py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                      >
                        ✓ Confirmar y Cocinar
                      </button>
                      <button 
                        (click)="noContesta.emit(o)"
                        class="py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold text-xs transition cursor-pointer"
                        title="Registrar intento fallido de llamada"
                      >
                        📞 No Contesta
                      </button>
                      <button 
                        (click)="cancelar.emit(o)"
                        class="py-2 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold text-xs transition cursor-pointer"
                        title="Cancelar pedido por no atender"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                } @empty {
                  <div class="col-span-2 py-12 text-center text-slate-500 bg-[#14161a] rounded-2xl border border-white/10">
                    <p class="text-sm">No hay llamadas pendientes de confirmación en este momento.</p>
                  </div>
                }
              </div>
            </div>
  `
})
export class CajeroLlamadasTabComponent {
  readonly ordenes = input.required<Order[]>();
  readonly now = input.required<number>();

  protected readonly plazo = MINUTOS_VALIDACION_PAGO;
  protected readonly minutosRestantes = minutosRestantes;

  readonly confirmar = output<Order>();
  readonly noContesta = output<Order>();
  readonly cancelar = output<Order>();
}
