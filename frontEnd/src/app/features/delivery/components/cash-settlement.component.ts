import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';

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

            <!-- Rendición Form Card -->
            <div class="bg-[#14161a] p-6 rounded-2xl border border-white/10 shadow-xl space-y-4">
              <div class="pb-3 border-b border-white/10">
                <h3 class="text-base font-bold text-white">Hoja de Liquidación de Caja al Administrador</h3>
                <p class="text-xs text-slate-400">Rinde los cobros en efectivo acumulados durante el turno para liberar tu cuenta.</p>
              </div>

              <div class="space-y-3 text-xs">
                <div class="flex justify-between items-center p-3 rounded-xl bg-white/5">
                  <span class="text-slate-300">Total en Efectivo por Entregar en Caja:</span>
                  <span class="font-display text-xl font-bold text-polleria-gold">{{ totalEfectivo() | currencyPEN }}</span>
                </div>

                <div class="flex justify-between items-center p-3 rounded-xl bg-white/5">
                  <span class="text-slate-300">Base / Fondo de Vueltos Inicial:</span>
                  <span class="font-mono text-white font-bold">S/. 100.00</span>
                </div>
              </div>

              <button
                (click)="onSettle.emit()"
                class="w-full py-3 rounded-xl bg-polleria-gold hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-lg"
              >
                <svg class="w-4 h-4 inline mr-1 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>Rendir Efectivo y Cerrar Liquidación
              </button>
            </div>

          </main>
  `
})
export class CashSettlementComponent {
  readonly totalEfectivo = input.required<number>();
  readonly totalDigital = input.required<number>();
  readonly completadasCount = input.required<number>();
  readonly onSettle = output<void>();
}
