import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyPENPipe } from '../../../../shared/pipes/currency-pen.pipe';
import { ArqueoCaja, BalanceDiario } from '../../../../core/models/finance.model';

/** Banner del turno de caja y métricas financieras del día. Presentacional. */
@Component({
  selector: 'app-cash-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CurrencyPENPipe],
  template: `
          <div class="p-4 rounded-2xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
            [ngClass]="cajaActual()?.estado === 'ABIERTA' ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-amber-950/20 border-amber-500/30'"
          >
            <div class="flex items-center gap-3">
              <span class="w-3 h-3 rounded-full" [ngClass]="cajaActual()?.estado === 'ABIERTA' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'"></span>
              <div>
                <span class="text-xs font-bold uppercase tracking-wider text-white">
                  Estado de Turno: {{ cajaActual()?.estado || 'SIN APERTURA' }}
                </span>
                <p class="text-xs text-slate-400">
                  Cajero: <strong class="text-slate-200">{{ cajaActual()?.cajero || userName() || 'Administrador' }}</strong> • 
                  Apertura con: <strong class="text-polleria-gold">{{ (cajaActual()?.montoInicial || 0) | currencyPEN }}</strong>
                </p>
              </div>
            </div>
            @if (cajaActual()?.estado === 'ABIERTA') {
              <span class="text-xs font-mono text-emerald-300">
                Apertura: {{ cajaActual()?.fechaApertura }}
              </span>
            }
          </div>

          <!-- Financial Metrics Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 space-y-1">
              <span class="text-[11px] text-slate-400 uppercase font-bold">Ventas Totales del Día</span>
              <p class="font-display text-2xl font-black text-white">
                {{ (balanceDiario()?.totalVentas || 0) | currencyPEN }}
              </p>
              <p class="text-[10px] text-emerald-400">Conciliado con orders-service</p>
            </div>
            <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 space-y-1">
              <span class="text-[11px] text-slate-400 uppercase font-bold">Caja Salón (Efectivo)</span>
              <p class="font-display text-2xl font-black text-polleria-gold">
                {{ (cajaActual()?.ventasEfectivo || 0) | currencyPEN }}
              </p>
              <p class="text-[10px] text-slate-400">Físico a rendir en gaveta</p>
            </div>
            <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 space-y-1">
              <span class="text-[11px] text-slate-400 uppercase font-bold">Pasarelas (Yape / Tarjetas)</span>
              <p class="font-display text-2xl font-black text-sky-400">
                {{ (cajaActual()?.ventasDigital || 0) | currencyPEN }}
              </p>
              <p class="text-[10px] text-slate-400">Acreditación automática en cuenta</p>
            </div>
            <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 space-y-1">
              <span class="text-[11px] text-slate-400 uppercase font-bold">Saldo Neto Consolidado</span>
              <p class="font-display text-2xl font-black text-emerald-400">
                {{ (balanceDiario()?.saldoNeto || 0) | currencyPEN }}
              </p>
              <p class="text-[10px] text-slate-400">Gastos: {{ (balanceDiario()?.totalGastos || 0) | currencyPEN }}</p>
            </div>
          </div>
  `
})
export class CashSummaryComponent {
  readonly cajaActual = input.required<ArqueoCaja | null>();
  readonly balanceDiario = input.required<BalanceDiario | null>();
  /** Nombre del usuario en sesión (cajero por defecto si la caja no lo trae). */
  readonly userName = input<string | undefined>();
}
