import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { Order } from '../../../core/models/order.model';
import { getCodeNum } from './delivery.utils';

@Component({
  selector: 'app-route-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPENPipe],
  template: `
          <main class="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">

            <div class="bg-[#14161a] p-4 rounded-2xl border border-white/10 shadow flex justify-between items-center">
              <div>
                <h2 class="text-lg font-bold text-white flex items-center gap-2">
                  <span>Ruta Satelital y Cobertura de Reparto en Ica</span>
                </h2>
                <p class="text-xs text-slate-400">Visualización de ruta optimizada desde el local (Av. San Martín) hacia las direcciones de entrega.</p>
              </div>
            </div>

            <!-- Simulated Interactive Map Card -->
            <div class="bg-[#14161a] rounded-2xl border border-white/10 p-6 shadow-xl relative overflow-hidden h-[420px] flex flex-col justify-between">

              <div class="absolute inset-0 opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]"></div>

              <div class="relative z-10 flex items-center justify-between">
                <div class="p-3 rounded-xl bg-polleria-crimson text-white font-bold text-xs flex items-center gap-2 shadow-lg">
                  <span class="flex items-center gap-1.5"><svg class="w-4 h-4 text-polleria-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>Local San Pollo (Av. San Martín 450, Ica)</span>
                </div>
                <div class="text-xs font-mono text-sky-400 bg-black/60 px-3 py-1.5 rounded-xl border border-white/10">
                  En ruta: {{ orders().length }} pedidos
                </div>
              </div>

              <!-- Markers List on Map -->
              <div class="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
                @for (order of orders(); track order.id) {
                  <div class="p-3 rounded-xl bg-black/70 border border-sky-500/30 text-xs space-y-1 shadow">
                    <div class="flex justify-between items-center">
                      <span class="font-bold text-white">Destino: #{{ getCodeNum(order.codigoSeguimiento) }}</span>
                      <span class="text-sky-400 font-mono">{{ order.total | currencyPEN }}</span>
                    </div>
                    <p class="text-slate-300 truncate">{{ order.cliente.direccion || 'Ica' }}</p>
                    <span class="text-[10px] text-amber-400 font-bold">{{ order.cliente.nombre }}</span>
                  </div>
                }
              </div>

              <!-- Map Footer -->
              <div class="relative z-10 flex justify-between items-center text-xs text-slate-400 pt-3 border-t border-white/10">
                <span>Zona de cobertura: Cercado Ica, San Joaquín, La Tinguiña, Parcona.</span>
                <span class="text-emerald-400 font-bold">Base de despacho: San Martín</span>
              </div>

            </div>

          </main>
  `
})
export class RouteMapComponent {
  readonly orders = input.required<Order[]>();
  readonly getCodeNum = getCodeNum;
}
