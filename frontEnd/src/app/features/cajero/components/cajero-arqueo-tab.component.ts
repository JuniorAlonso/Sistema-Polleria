import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { ArqueoCaja, MovimientoCaja } from '../../../core/models/finance.model';

@Component({
  selector: 'app-cajero-arqueo-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPENPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
            @if (!cajaAbierta()) {
              <!-- Formulario de Apertura de Caja -->
              <div class="max-w-xl mx-auto p-6 sm:p-8 rounded-3xl bg-[#14161a] border border-white/10 shadow-2xl space-y-6">
                <div class="text-center space-y-2">
                  <div class="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/>
                    </svg>
                  </div>
                  <h2 class="font-display text-2xl sm:text-3xl font-bold text-white tracking-wide">
                    APERTURA DE CAJA
                  </h2>
                  <p class="text-xs text-slate-400">
                    Ingresa el fondo inicial asignado a la gaveta de caja para iniciar el turno.
                  </p>
                </div>

                <div class="space-y-4">
                  <div>
                    <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      Fondo Inicial en Efectivo (S/) *
                    </label>
                    <div class="relative">
                      <span class="absolute left-4 top-1/2 -translate-y-1/2 text-polleria-gold font-bold">S/</span>
                      <input
                        type="number"
                        [(ngModel)]="montoApertura"
                        step="0.10"
                        min="0"
                        placeholder="200.00"
                        class="w-full pl-10 pr-4 py-3.5 bg-black/40 border border-white/10 rounded-xl text-lg font-bold text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      Observaciones de Apertura (Opcional)
                    </label>
                    <textarea
                      [(ngModel)]="observacionesApertura"
                      rows="2"
                      placeholder="Ej: Turno mañana, billetes de S/ 20 y monedas para vuelto"
                      class="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                    ></textarea>
                  </div>

                  <button
                    type="button"
                    (click)="aperturar.emit()"
                    [disabled]="montoApertura() < 0 || procesando()"
                    class="w-full py-4 bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-display text-xl font-bold tracking-wider uppercase rounded-xl transition duration-150 cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                  >
                    @if (procesando()) {
                      <span>ABRIENDO CAJA...</span>
                    } @else {
                      <span>CONFIRMAR APERTURA DE TURNO</span>
                    }
                  </button>
                </div>
              </div>
            } @else {
              <!-- Panel de Caja Abierta -->
              <div class="space-y-6">
                
                <!-- Tarjeta Principal de Resumen -->
                <div class="p-6 rounded-3xl bg-gradient-to-r from-emerald-950/30 to-[#14161a] border border-emerald-500/30 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <div class="flex items-center gap-2 mb-1">
                      <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500 text-slate-950">
                        Caja #{{ caja()?.id }} ABIERTA
                      </span>
                      <span class="text-xs text-slate-400 font-mono">
                        {{ caja()?.fechaApertura | date:'medium' }}
                      </span>
                    </div>
                    <h2 class="text-lg font-bold text-white">
                      Responsable: {{ caja()?.usuarioNombre || usuarioNombre() || 'Cajero' }}
                    </h2>
                  </div>

                  <!-- Botones de Acción: Movimiento y Cierre -->
                  <div class="flex items-center gap-3 w-full md:w-auto">
                    <button
                      type="button"
                      (click)="nuevoMovimiento.emit()"
                      class="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-xs font-bold text-white uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      <svg class="w-4 h-4 text-polleria-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                      </svg>
                      <span>Movimiento Caja Chica</span>
                    </button>

                    <button
                      type="button"
                      (click)="cerrarCaja.emit()"
                      class="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-xs font-bold text-rose-300 uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                      </svg>
                      <span>Cerrar Caja / Arqueo</span>
                    </button>
                  </div>
                </div>

                <!-- Grid de Métricas Financieras de la Caja -->
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 space-y-1">
                    <span class="text-[11px] text-slate-400 uppercase font-bold">Fondo Inicial Apertura</span>
                    <p class="font-display text-2xl text-slate-100 font-bold">
                      {{ (caja()?.montoApertura || 0) | currencyPEN }}
                    </p>
                  </div>

                  <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 space-y-1">
                    <span class="text-[11px] text-emerald-400 uppercase font-bold">Ingresos Extras</span>
                    <p class="font-display text-2xl text-emerald-300 font-bold">
                      +{{ totalIngresos() | currencyPEN }}
                    </p>
                  </div>

                  <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 space-y-1">
                    <span class="text-[11px] text-rose-400 uppercase font-bold">Egresos / Gastos Menores</span>
                    <p class="font-display text-2xl text-rose-300 font-bold">
                      -{{ totalEgresos() | currencyPEN }}
                    </p>
                  </div>

                  <div class="p-4 rounded-2xl bg-[#14161a] border border-polleria-gold/40 space-y-1">
                    <span class="text-[11px] text-polleria-gold uppercase font-bold">Saldo Teórico en Gaveta</span>
                    <p class="font-display text-2xl text-polleria-gold font-bold">
                      {{ saldoTeorico() | currencyPEN }}
                    </p>
                  </div>
                </div>

                <!-- Tabla de Movimientos de Caja Chica -->
                <div class="p-5 rounded-2xl bg-[#14161a] border border-white/10 space-y-4">
                  <div class="flex items-center justify-between">
                    <h3 class="font-bold text-sm text-white uppercase tracking-wider flex items-center gap-2">
                      <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                      </svg>
                      <span>Movimientos de Caja del Turno</span>
                    </h3>
                    <span class="text-xs text-slate-400 font-mono">
                      {{ movimientos().length }} registros
                    </span>
                  </div>

                  <div class="overflow-x-auto">
                    <table class="w-full text-left text-xs">
                      <thead>
                        <tr class="border-b border-white/10 text-slate-400 uppercase text-[10px] tracking-wider font-extrabold">
                          <th class="py-2.5 px-3">Hora</th>
                          <th class="py-2.5 px-3">Tipo</th>
                          <th class="py-2.5 px-3">Monto</th>
                          <th class="py-2.5 px-3">Concepto / Motivo</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-white/5 font-medium">
                        @for (mov of movimientos(); track mov.id) {
                          <tr class="hover:bg-white/5 transition">
                            <td class="py-2.5 px-3 font-mono text-slate-400">
                              {{ mov.fecha | date:'shortTime' }}
                            </td>
                            <td class="py-2.5 px-3">
                              @if (mov.tipo === 'INGRESO') {
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  INGRESO
                                </span>
                              } @else {
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                  EGRESO
                                </span>
                              }
                            </td>
                            <td class="py-2.5 px-3 font-mono font-bold"
                              [ngClass]="mov.tipo === 'INGRESO' ? 'text-emerald-400' : 'text-rose-400'"
                            >
                              {{ mov.tipo === 'INGRESO' ? '+' : '-' }}{{ mov.monto | currencyPEN }}
                            </td>
                            <td class="py-2.5 px-3 text-slate-300">
                              {{ mov.motivo || mov.concepto || 'Sin motivo' }}
                            </td>
                          </tr>
                        } @empty {
                          <tr>
                            <td colspan="4" class="py-8 text-center text-slate-500">
                              No hay movimientos registrados en la caja actual.
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            }
  `
})
export class CajeroArqueoTabComponent {
  readonly cajaAbierta = input.required<boolean>();
  readonly caja = input<ArqueoCaja | null>(null);
  readonly movimientos = input<MovimientoCaja[]>([]);
  readonly totalIngresos = input<number>(0);
  readonly totalEgresos = input<number>(0);
  readonly saldoTeorico = input<number>(0);
  readonly usuarioNombre = input<string | undefined>(undefined);
  readonly procesando = input<boolean>(false);

  readonly montoApertura = model<number>(0);
  readonly observacionesApertura = model<string>('');

  readonly aperturar = output<void>();
  readonly nuevoMovimiento = output<void>();
  readonly cerrarCaja = output<void>();
}
