import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { Order } from '../../../core/models/order.model';
import { ResolverFantasmaEvent } from '../models/cajero.models';

@Component({
  selector: 'app-cajero-mermas-tab',
  standalone: true,
  imports: [CommonModule, CurrencyPENPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
            <div class="space-y-4">
              <div class="p-5 rounded-2xl bg-[#14161a] border border-white/10 flex justify-between items-center">
                <div>
                  <h3 class="font-bold text-base text-rose-300">Gestión de Pedidos Fantasma y Destino de Merma</h3>
                  <p class="text-xs text-slate-400">
                    Clasificación de productos devueltos o abandonados (Control de inventario vs Venta Rápida en Salón).
                  </p>
                </div>
                <span class="px-3 py-1 rounded-xl bg-rose-500/20 text-rose-300 font-bold text-xs border border-rose-500/30">
                  {{ ordenes().length }} incidentes
                </span>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                @for (o of ordenes(); track o.id) {
                  <div class="p-5 rounded-2xl bg-[#14161a] border border-rose-500/40 shadow-xl space-y-3">
                    <div class="flex justify-between items-start border-b border-white/10 pb-2">
                      <div>
                        <span class="font-mono text-base font-black text-rose-400">#{{ o.codigoSeguimiento || o.id }}</span>
                        <p class="text-sm font-bold text-white">{{ o.cliente.nombre }}</p>
                      </div>
                      <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                        {{ o.tipo }} • FANTASMA
                      </span>
                    </div>

                    <div class="text-xs space-y-1">
                      <p class="text-slate-300"><strong>Motivo:</strong> {{ o.motivoFantasma || 'No atendido / Abandonado' }}</p>
                      <p class="text-slate-400"><strong>Teléfono Sancionado:</strong> {{ o.cliente.celular }}</p>
                      <p class="text-slate-400"><strong>Total Pérdida:</strong> {{ o.total | currencyPEN }}</p>
                    </div>

                    <div class="p-3 rounded-xl bg-black/40 border border-white/5 text-xs">
                      @if (o.tipo === 'RECOJO_EN_TIENDA') {
                        <p class="text-amber-300 pb-2">El pedido quedó en la vitrina caliente del local.</p>
                        <div class="flex gap-2">
                          <button 
                            (click)="resolver.emit({ orden: o, destino: 'VENTA_RAPIDA_SALON' })"
                            class="flex-1 py-2 px-2.5 rounded-xl bg-polleria-gold hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer"
                          >
                            Reasignar a Salón
                          </button>
                          <button 
                            (click)="resolver.emit({ orden: o, destino: 'MERMA_JUSTIFICADA' })"
                            class="flex-1 py-2 px-2.5 rounded-xl bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-500/40 font-bold text-xs transition cursor-pointer"
                          >
                            Merma Justificada
                          </button>
                        </div>
                      } @else {
                        <p class="text-slate-300 pb-2 text-[11px]">
                          Por inocuidad bromatológica (estuvo en moto >30 min), debe registrarse como Merma Justificada.
                        </p>
                        <button 
                          (click)="resolver.emit({ orden: o, destino: 'MERMA_JUSTIFICADA' })"
                          class="w-full py-2 px-3 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs transition cursor-pointer"
                        >
                          Asentar en Libro de Mermas
                        </button>
                      }
                    </div>
                  </div>
                } @empty {
                  <div class="col-span-2 py-12 text-center text-slate-500 bg-[#14161a] rounded-2xl border border-white/10">
                    <p class="text-sm">No hay pedidos fantasma pendientes de resolución de inventario.</p>
                  </div>
                }
              </div>
            </div>
  `
})
export class CajeroMermasTabComponent {
  readonly ordenes = input.required<Order[]>();

  readonly resolver = output<ResolverFantasmaEvent>();
}
