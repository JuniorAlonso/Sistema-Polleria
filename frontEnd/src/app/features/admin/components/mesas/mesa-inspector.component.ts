import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyPENPipe } from '../../../../shared/pipes/currency-pen.pipe';
import { MesaSalon } from '../../../../core/models/table.model';

/** Panel inspector administrativo de la mesa seleccionada. Presentacional. */
@Component({
  selector: 'app-mesa-inspector',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CurrencyPENPipe],
  template: `
    @if (mesa(); as mesa) {
            <div class="p-6 bg-[#14161a] rounded-2xl border border-polleria-gold/30 shadow-2xl flex flex-col md:flex-row justify-between gap-6 items-center">
              <div class="space-y-1">
                <div class="flex items-center gap-3">
                  <h3 class="font-display text-2xl font-bold text-white">Inspección de Mesa #{{ mesa.numero }}</h3>
                  <span class="text-xs font-mono px-2.5 py-0.5 rounded bg-white/10 text-slate-300 font-bold">
                    Zona: {{ (mesa.zona || 'SALON_PRINCIPAL').replace('_', ' ') }}
                  </span>
                  <span class="text-xs font-mono px-2.5 py-0.5 rounded bg-polleria-gold/20 text-polleria-gold font-bold">
                    Estado: {{ mesa.estado }}
                  </span>
                </div>
                @if (mesa.ordenActiva) {
                  <p class="text-xs text-slate-300">
                    Comanda en curso <strong>#{{ mesa.ordenActiva.codigoSeguimiento || mesa.ordenActiva.ordenId }}</strong> • Monto: <strong class="text-polleria-gold">{{ mesa.ordenActiva.total | currencyPEN }}</strong> • Estado: <strong class="text-amber-300">{{ mesa.ordenActiva.estadoOrden }}</strong>
                  </p>
                  <div class="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] font-bold">
                    <span class="px-2 py-0.5 rounded-full bg-white/10 text-slate-300">Creada hace {{ mesa.ordenActiva.tiempoEsperaMinutos }} min</span>
                    <span class="text-slate-600">→</span>
                    <span class="px-2 py-0.5 rounded-full" [ngClass]="mesa.ordenActiva.estadoOrden === 'LISTO' ? 'bg-amber-500/20 text-amber-300' : 'bg-sky-500/20 text-sky-300'">
                      {{ mesa.ordenActiva.estadoOrden === 'LISTO' ? 'Lista' : 'En cocina' }}
                    </span>
                    <span class="text-slate-600">→</span>
                    @if (mesa.ordenActiva.servidoEn) {
                      <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">Servida</span>
                    } @else {
                      <span class="px-2 py-0.5 rounded-full bg-white/10 text-slate-400">Pendiente de servir</span>
                    }
                  </div>
                } @else {
                  <p class="text-xs text-slate-400">Sin comanda activa vinculada. Capacidad configurada: {{ mesa.capacidad }} personas.</p>
                }
              </div>

              <div class="flex flex-wrap gap-2">
                @if (mesa.ordenActiva) {
                  <button 
                    (click)="addDishes.emit(mesa)"
                    class="px-4 py-2 bg-sky-600/20 hover:bg-sky-600/40 text-sky-300 border border-sky-500/30 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                    title="Agregar una segunda ronda a la comanda activa"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                    </svg>
                    <span>Agregar platos</span>
                  </button>
                  <button 
                    (click)="charge.emit(mesa)"
                    class="px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                    title="Cobrar la comanda y liberar la mesa"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
                    </svg>
                    <span>Cobrar comanda</span>
                  </button>
                } @else {
                  <button 
                    (click)="takeOrder.emit(mesa)"
                    class="px-4 py-2 bg-polleria-crimson hover:bg-polleria-crimsonHover text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                    title="Tomar la comanda de esta mesa"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                    </svg>
                    <span>Tomar comanda</span>
                  </button>
                }
                <button 
                  (click)="edit.emit(mesa)"
                  class="px-4 py-2 bg-polleria-gold hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                  <span>Editar Parámetros</span>
                </button>
                <button 
                  (click)="deactivate.emit(mesa)"
                  class="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                  <span>Dar de Baja</span>
                </button>
              </div>
            </div>
    }
  `
})
export class MesaInspectorComponent {
  readonly mesa = input.required<MesaSalon>();

  readonly addDishes = output<MesaSalon>();
  readonly charge = output<MesaSalon>();
  readonly takeOrder = output<MesaSalon>();
  readonly edit = output<MesaSalon>();
  readonly deactivate = output<MesaSalon>();
}
