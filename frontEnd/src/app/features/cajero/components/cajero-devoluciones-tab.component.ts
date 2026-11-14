import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { ReporteIncidencia } from '../../../core/models/feedback.model';

/** Pestaña de devoluciones en ventanilla (canal VENTANILLA, devueltoEn = null). Presentacional. */
@Component({
  selector: 'app-cajero-devoluciones-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CurrencyPENPipe],
  template: `
    <div class="space-y-5">

      <!-- Header -->
      <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 class="text-xl font-bold text-white flex items-center gap-2">
            <svg class="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
            </svg>
            Devoluciones en Ventanilla
          </h2>
          <p class="text-xs text-slate-400 mt-0.5">Reembolsos aprobados pendientes de entrega en efectivo al cliente.</p>
        </div>
        <button
          type="button"
          (click)="refresh.emit()"
          class="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition cursor-pointer border border-white/10"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          Actualizar
        </button>
      </div>

      <!-- Empty state -->
      @if (devoluciones().length === 0) {
        <div class="p-10 rounded-2xl bg-[#14161a] border border-white/10 text-center space-y-2">
          <svg class="w-10 h-10 text-emerald-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p class="text-sm font-semibold text-slate-300">Sin devoluciones pendientes</p>
          <p class="text-xs text-slate-500">Los reembolsos en ventanilla aprobados aparecerán aquí.</p>
        </div>
      }

      <!-- Lista de devoluciones -->
      <div class="space-y-3">
        @for (dev of devoluciones(); track dev.id) {
          <div class="p-5 rounded-2xl bg-[#14161a] border border-rose-500/30 shadow-md space-y-3">

            <div class="flex justify-between items-start">
              <div class="flex items-center gap-3 flex-wrap">
                <span class="font-mono text-xs px-2 py-0.5 rounded bg-white/10 text-polleria-gold font-bold">
                  REC-{{ dev.id }}
                </span>
                <span class="text-sm font-bold text-white">Orden #{{ dev.ordenId }}</span>
                @if (dev.clienteNombre) {
                  <span class="text-xs text-slate-300">— {{ dev.clienteNombre }}</span>
                }
              </div>
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 animate-pulse">
                PENDIENTE ENTREGA
              </span>
            </div>

            <div class="bg-black/30 p-3 rounded-xl border border-white/5 text-xs space-y-1.5">
              <div class="flex justify-between items-center">
                <span class="text-slate-500 font-bold uppercase tracking-wider text-[10px]">MONTO A DEVOLVER:</span>
                <span class="text-polleria-gold font-black text-base font-mono">{{ dev.montoReembolso | currencyPEN }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-slate-500 font-bold uppercase tracking-wider text-[10px]">MOTIVO:</span>
                <span class="text-slate-300">{{ dev.motivo }}</span>
              </div>
              @if (dev.respuestaAdmin || dev.resolucion) {
                <div>
                  <span class="text-slate-500 font-bold uppercase tracking-wider text-[10px] block mb-0.5">RESOLUCIÓN:</span>
                  <p class="text-slate-300 italic">"{{ dev.respuestaAdmin || dev.resolucion }}"</p>
                </div>
              }
              @if (dev.resueltoEn) {
                <div class="flex justify-between items-center">
                  <span class="text-slate-500 font-bold uppercase tracking-wider text-[10px]">APROBADO EL:</span>
                  <span class="text-slate-400 font-mono">{{ dev.resueltoEn | date:'dd/MM/yyyy HH:mm' }}</span>
                </div>
              }
            </div>

            <div class="flex justify-end pt-1">
              <button
                type="button"
                (click)="entregar.emit(dev.id)"
                [disabled]="procesando()"
                class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-emerald-900/30 cursor-pointer"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                Entregar Efectivo
              </button>
            </div>

          </div>
        }
      </div>

    </div>
  `
})
export class CajeroDevolucionesTabComponent {
  readonly devoluciones = input.required<ReporteIncidencia[]>();
  readonly procesando = input<boolean>(false);
  readonly refresh = output<void>();
  readonly entregar = output<number>();
}
