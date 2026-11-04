import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-mozo-header',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'h-16 bg-[#14161a]/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-md' },
  template: `
          
          <div class="flex items-center gap-2.5">
            <h1 class="text-base sm:text-lg font-extrabold text-white tracking-wide uppercase">
              {{ tabLabel() }}
            </h1>
          </div>

          <div class="flex items-center gap-3">
            <!-- Quick Alert Indicator -->
            <button 
              (click)="openAlertas.emit()"
              class="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow"
              [ngClass]="alertasCount() > 0 ? 'animate-pulse motion-reduce:animate-none' : ''"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
              </svg>
              <span>Avisos Cocina ({{ alertasCount() }})</span>
            </button>

            <button 
              (click)="nuevaComanda.emit()"
              class="px-4 py-1.5 rounded-xl bg-polleria-crimson hover:bg-polleria-crimsonHover text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow"
            >
              <span>+ Tomar Comanda</span>
            </button>
          </div>

  `
})
export class MozoHeaderComponent {
  readonly tabLabel = input.required<string>();
  readonly alertasCount = input.required<number>();

  readonly openAlertas = output<void>();
  readonly nuevaComanda = output<void>();
}
