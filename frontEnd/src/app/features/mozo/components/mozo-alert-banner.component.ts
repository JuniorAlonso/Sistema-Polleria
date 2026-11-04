import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AlertaPlatoListo } from '../mozo.types';
import { esMiComanda } from '../mozo.helpers';

@Component({
  selector: 'app-mozo-alert-banner',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'sticky top-16 z-30 mx-4 sm:mx-6 mt-3 animate-slide-up motion-reduce:animate-none rounded-2xl border border-amber-500/50 bg-amber-500/15 px-4 py-3 text-amber-100 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3', role: 'status', 'aria-live': 'polite' },
  template: `
            <div class="flex items-center gap-3 min-w-0">
              <span class="relative flex w-2.5 h-2.5 shrink-0">
                <span class="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping motion-reduce:animate-none"></span>
                <span class="relative inline-flex w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              </span>
              <div class="min-w-0">
                <p class="text-sm font-bold text-white truncate">
                  {{ alerta().mesa }} · Comanda lista para servir
                  @if (esMiComanda(alerta(), miUserId())) {
                    <span class="ml-2 align-middle px-2 py-0.5 rounded-full bg-polleria-gold/20 text-polleria-gold border border-polleria-gold/40 text-[10px] font-black uppercase tracking-wider">Tu comanda</span>
                  }
                </p>
                <p class="text-[11px] text-amber-200/80">Entregala en mesa; el cobro es después, cuando el cliente se retire.</p>
              </div>
            </div>
            <button
              type="button"
              (click)="servir.emit(alerta())"
              class="shrink-0 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition cursor-pointer"
            >
              Servir en mesa
            </button>
  `
})
export class MozoAlertBannerComponent {
  readonly alerta = input.required<AlertaPlatoListo>();
  readonly miUserId = input<number | null | undefined>(null);

  readonly servir = output<AlertaPlatoListo>();

  readonly esMiComanda = esMiComanda;
}
