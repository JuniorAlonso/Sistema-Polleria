import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Resumen de mesas por estado. Presentacional: solo input(). */
@Component({
  selector: 'app-mesas-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div class="p-3 rounded-xl bg-[#14161a] border border-white/5 flex items-center justify-between">
              <span class="text-slate-400">Total Mesas</span>
              <span class="font-bold text-white font-mono">{{ total() }}</span>
            </div>
            <div class="p-3 rounded-xl bg-[#14161a] border border-emerald-500/20 flex items-center justify-between">
              <span class="text-emerald-400 flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Libres</span>
              <span class="font-bold text-emerald-400 font-mono">{{ libres() }}</span>
            </div>
            <div class="p-3 rounded-xl bg-[#14161a] border border-rose-500/20 flex items-center justify-between">
              <span class="text-rose-400 flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Ocupadas</span>
              <span class="font-bold text-rose-400 font-mono">{{ ocupadas() }}</span>
            </div>
            <div class="p-3 rounded-xl bg-[#14161a] border border-amber-500/20 flex items-center justify-between">
              <span class="text-amber-300 flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Por Cobrar</span>
              <span class="font-bold text-amber-300 font-mono">{{ porCobrar() }}</span>
            </div>
            <div class="p-3 rounded-xl bg-[#14161a] border border-sky-500/20 flex items-center justify-between">
              <span class="text-sky-300 flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-sky-400"></span> En Limpieza</span>
              <span class="font-bold text-sky-300 font-mono">{{ enLimpieza() }}</span>
            </div>
          </div>
  `
})
export class MesasSummaryComponent {
  readonly total = input.required<number>();
  readonly libres = input.required<number>();
  readonly ocupadas = input.required<number>();
  readonly porCobrar = input.required<number>();
  readonly enLimpieza = input.required<number>();
}
