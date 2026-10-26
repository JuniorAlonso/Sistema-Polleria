import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyPENPipe } from '../../../../shared/pipes/currency-pen.pipe';
import { AlertaStock, RentabilidadInventario } from '../../../../core/models/inventory.model';

/** Métricas de inventario y alertas de abastecimiento por umbral. Presentacional. */
@Component({
  selector: 'app-inventory-alerts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CurrencyPENPipe],
  template: `
            <div class="space-y-6">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="p-5 rounded-2xl bg-[#14161a] border border-white/10 space-y-3">
                  <span class="text-xs text-slate-400 uppercase font-bold">Valor del Inventario</span>
                  <p class="font-display text-3xl font-black text-polleria-gold">
                    {{ (rentabilidad()?.valorTotalInventario ?? 0) | currencyPEN }}
                  </p>
                  <p class="text-xs text-slate-400">{{ rentabilidad()?.totalInsumos ?? 0 }} insumos registrados</p>
                </div>

                <div class="p-5 rounded-2xl bg-[#14161a] border border-white/10 space-y-3">
                  <span class="text-xs text-slate-400 uppercase font-bold">Insumos Bajo Umbral</span>
                  <p class="font-display text-3xl font-black text-rose-400">{{ alertas().length }}</p>
                  <p class="text-xs text-slate-300">Stock igual o por debajo del mínimo configurado.</p>
                </div>

                <div class="p-5 rounded-2xl bg-[#14161a] border border-white/10 space-y-3">
                  <span class="text-xs text-slate-400 uppercase font-bold">Costo de Mermas</span>
                  <p class="font-display text-3xl font-black text-emerald-400">
                    {{ (rentabilidad()?.costoTotalMermas ?? 0) | currencyPEN }}
                  </p>
                  <p class="text-xs text-slate-300">Valorizado al costo unitario de cada insumo.</p>
                </div>
              </div>

              <!-- Lista de Alertas Predictivas -->
              <div class="bg-[#14161a] rounded-2xl border border-white/10 p-5 space-y-4">
                <h3 class="font-display text-lg text-white font-bold flex items-center gap-2">
                  <span>Alertas de Abastecimiento por Umbral (RF25)</span>
                </h3>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  @for (alerta of alertas(); track alerta.insumoId) {
                    <div 
                      class="p-4 rounded-xl border space-y-2"
                      [ngClass]="alerta.nivelCriticidad === 'CRITICO' ? 'bg-rose-500/10 border-rose-500/30' : 'bg-amber-500/10 border-amber-500/30'"
                    >
                      <div class="flex justify-between items-start">
                        <h4 class="font-bold text-white text-sm">{{ alerta.insumoNombre }}</h4>
                        <span 
                          class="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          [ngClass]="alerta.nivelCriticidad === 'CRITICO' ? 'bg-rose-500 text-white' : 'bg-amber-400 text-slate-950'"
                        >
                          {{ alerta.nivelCriticidad }}
                        </span>
                      </div>
                      <p class="text-xs text-slate-300">
                        Stock actual: <strong class="text-white">{{ alerta.stockActual }} {{ alerta.unidadMedida }}</strong> • Mínimo configurado: <strong>{{ alerta.stockMinimoAlerta }} {{ alerta.unidadMedida }}</strong>
                      </p>
                      <p class="text-xs text-amber-300/90 font-medium italic">
                        <svg class="w-3.5 h-3.5 inline mr-1 text-polleria-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>{{ alerta.mensaje }}
                      </p>
                    </div>
                  }
                </div>
              </div>
            </div>
  `
})
export class InventoryAlertsComponent {
  readonly rentabilidad = input.required<RentabilidadInventario | null>();
  readonly alertas = input.required<AlertaStock[]>();
}
