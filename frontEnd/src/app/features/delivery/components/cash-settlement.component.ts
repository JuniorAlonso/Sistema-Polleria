import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { BackendEfectivoPendienteLiquidacion } from '../../../core/models/api-contracts.model';

@Component({
  selector: 'app-cash-settlement',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPENPipe],
  template: `
          <main class="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-6">

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 shadow">
                <span class="text-xs text-slate-400 font-medium">Efectivo Cobrado Hoy</span>
                <p class="font-display text-3xl font-black text-polleria-gold mt-1">{{ totalEfectivo() | currencyPEN }}</p>
              </div>
              <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 shadow">
                <span class="text-xs text-slate-400 font-medium">Digital (Tarjeta / Yape)</span>
                <p class="font-display text-3xl font-black text-purple-400 mt-1">{{ totalDigital() | currencyPEN }}</p>
              </div>
              <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 shadow">
                <span class="text-xs text-slate-400 font-medium">Entregas Validadas</span>
                <p class="font-display text-3xl font-black text-emerald-400 mt-1">{{ completadasCount() }}</p>
              </div>
            </div>

            <!-- Pending cash, as computed by finance-service from registered cash payments -->
            <div class="bg-[#14161a] p-6 rounded-2xl border border-white/10 shadow-xl space-y-4">
              <div class="pb-3 border-b border-white/10">
                <h3 class="text-base font-bold text-white">Efectivo pendiente de liquidar</h3>
                <p class="text-xs text-slate-400">La liquidación la cierra el Cajero al recibir el efectivo en caja.</p>
              </div>

              @if (errorPendiente()) {
                <p class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">{{ errorPendiente() }}</p>
              }
              @if (pendiente(); as p) {
                <div class="space-y-3 text-xs">
                  <div class="flex justify-between items-center p-3 rounded-xl bg-white/5">
                    <span class="text-slate-300">Total en efectivo por entregar en caja:</span>
                    <span class="font-display text-xl font-bold text-polleria-gold">{{ p.total | currencyPEN }}</span>
                  </div>
                  <div class="flex justify-between items-center p-3 rounded-xl bg-white/5">
                    <span class="text-slate-300">Cobros en efectivo sin liquidar:</span>
                    <span class="font-mono text-white font-bold">{{ p.cantidad }}</span>
                  </div>
                </div>
              } @else if (!errorPendiente()) {
                <p class="text-xs text-slate-400">Cargando saldo pendiente...</p>
              }

              <button
                (click)="refrescar.emit()"
                class="w-full py-3 rounded-xl bg-polleria-gold hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-lg"
              >Actualizar saldo pendiente</button>
            </div>

          </main>
  `
})
export class CashSettlementComponent {
  readonly totalEfectivo = input.required<number>();
  readonly totalDigital = input.required<number>();
  readonly completadasCount = input.required<number>();
  /** Backend pending cash; null while loading or when it failed. */
  readonly pendiente = input<BackendEfectivoPendienteLiquidacion | null>(null);
  readonly errorPendiente = input<string | null>(null);
  readonly refrescar = output<void>();
}
