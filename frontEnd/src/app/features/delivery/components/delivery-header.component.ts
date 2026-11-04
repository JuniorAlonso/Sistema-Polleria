import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';

@Component({
  selector: 'app-delivery-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPENPipe],
  template: `
        <!-- Top Bar -->
        <header class="h-16 bg-[#14161a]/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-md">

          <div class="flex items-center gap-2.5">
            <h1 class="text-base sm:text-lg font-extrabold text-white tracking-wide uppercase">
              {{ title() }}
            </h1>
          </div>

          <!-- Quick Stats Top -->
          <div class="flex items-center gap-3">
            <div class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs">
              <span class="text-slate-400">Total Efectivo a Rendir:</span>
              <span class="font-display font-bold text-polleria-gold">{{ totalEfectivo() | currencyPEN }}</span>
            </div>

            <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-bold">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>GPS Activo (Ica)</span>
            </div>
          </div>

        </header>
  `
})
export class DeliveryHeaderComponent {
  readonly title = input.required<string>();
  readonly totalEfectivo = input.required<number>();
}
