import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CajeroTab } from '../models/cajero.models';

@Component({
  selector: 'app-cajero-topbar',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
        <header class="h-16 px-4 sm:px-6 bg-[#14161a] border-b border-white/10 flex items-center justify-between gap-4 shrink-0">
          <div class="flex items-center gap-3">
            <h1 class="font-display text-xl sm:text-2xl text-white tracking-wide flex items-center gap-2">
              @if (activeTab() === 'POS') {
                <span>PUNTO DE COBRO & COMANDAS</span>
              } @else if (activeTab() === 'ARQUEO') {
                <span>ARQUEO Y MOVIMIENTOS DE CAJA</span>
              } @else {
                <span>HISTORIAL DE COBROS REALIZADOS</span>
              }
            </h1>
          </div>

          <div class="flex items-center gap-3">
            <!-- Hora Actual -->
            <div class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 font-mono">
              <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span>{{ horaActual() }}</span>
            </div>

            <!-- Botón Actualizar Datos -->
            <button
              type="button"
              (click)="refrescar.emit()"
              [disabled]="cargando()"
              class="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition cursor-pointer"
              title="Refrescar comanda y caja"
            >
              <svg class="w-4 h-4" [ngClass]="{'animate-spin': cargando()}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            </button>
          </div>
        </header>
  `
})
export class CajeroTopbarComponent {
  readonly activeTab = input.required<CajeroTab>();
  readonly horaActual = input<string>('');
  readonly cargando = input<boolean>(false);

  readonly refrescar = output<void>();
}
