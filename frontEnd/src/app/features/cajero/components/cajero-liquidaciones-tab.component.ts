import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { BackendLiquidacionResponse } from '../../../core/models/api-contracts.model';

@Component({
  selector: 'app-cajero-liquidaciones-tab',
  standalone: true,
  imports: [CommonModule, CurrencyPENPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
            <div class="space-y-4">
              <div class="p-5 rounded-2xl bg-[#14161a] border border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 class="font-bold text-base text-white">Liquidación y Cobro a Repartidores</h3>
                  <p class="text-xs text-slate-400">Cobro de efectivo recaudado en delivery y entrega de fondo de vueltos.</p>
                </div>
                <div class="flex items-center gap-2">
                  <button 
                    (click)="cobrarEfectivo.emit()"
                    class="px-4 py-2 rounded-xl bg-polleria-gold hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 shadow-lg"
                  >
                    <span>$ Cobrar Efectivo</span>
                  </button>
                  <button 
                    (click)="nuevaLiquidacion.emit()"
                    class="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5"
                  >
                    <span>+ Fondo de Vueltos</span>
                  </button>
                </div>
              </div>

              <div class="overflow-x-auto rounded-2xl border border-white/10 bg-[#14161a]">
                <table class="w-full text-left text-xs">
                  <thead>
                    <tr class="border-b border-white/10 text-slate-400 uppercase text-[10px] tracking-wider font-extrabold">
                      <th class="py-3 px-4">ID</th>
                      <th class="py-3 px-4">Repartidor</th>
                      <th class="py-3 px-4">Hora Salida</th>
                      <th class="py-3 px-4">Fondo Inicial</th>
                      <th class="py-3 px-4">Cobrado Efectivo</th>
                      <th class="py-3 px-4">Ya Rendido</th>
                      <th class="py-3 px-4">Saldo Pendiente</th>
                      <th class="py-3 px-4">Estado</th>
                      <th class="py-3 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/5 font-medium">
                    @for (liq of liquidaciones(); track liq.id) {
                      <tr class="hover:bg-white/5 transition">
                        <td class="py-3 px-4 font-mono font-bold text-white">#{{ liq.id }}</td>
                        <td class="py-3 px-4 text-slate-200 font-bold">{{ liq.repartidorNombre }}</td>
                        <td class="py-3 px-4 font-mono text-slate-400">{{ liq.creadoEn | date:'shortTime' }}</td>
                        <td class="py-3 px-4 font-mono text-polleria-gold">{{ liq.fondoInicial | currencyPEN }}</td>
                        <td class="py-3 px-4 font-mono text-emerald-400">{{ liq.totalCobradoEfectivo | currencyPEN }}</td>
                        <td class="py-3 px-4 font-mono text-cyan-400">{{ (liq.totalRendido || 0) | currencyPEN }}</td>
                        <td class="py-3 px-4 font-mono font-bold text-white">{{ ((liq.fondoInicial + liq.totalCobradoEfectivo) - (liq.totalRendido || 0)) | currencyPEN }}</td>
                        <td class="py-3 px-4">
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {{ liq.estado }}
                          </span>
                        </td>
                        <td class="py-3 px-4 text-right">
                          <div class="flex items-center justify-end gap-1.5">
                            <button 
                              (click)="recargarFondo.emit(liq)"
                              class="px-2.5 py-1.5 rounded-lg bg-sky-600/30 hover:bg-sky-600 text-sky-200 hover:text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                              title="Añadir más sencillo al repartidor en ruta"
                            >
                              + Recargar
                            </button>
                            <button 
                              (click)="rendir.emit(liq)"
                              class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                            >
                              Rendir Caja
                            </button>
                          </div>
                        </td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="8" class="py-12 text-center text-slate-500">
                          No hay liquidaciones abiertas de repartidores en este turno.
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
  `
})
export class CajeroLiquidacionesTabComponent {
  readonly liquidaciones = input.required<BackendLiquidacionResponse[]>();

  readonly nuevaLiquidacion = output<void>();
  readonly cobrarEfectivo = output<void>();
  readonly recargarFondo = output<BackendLiquidacionResponse>();
  readonly rendir = output<BackendLiquidacionResponse>();
}
