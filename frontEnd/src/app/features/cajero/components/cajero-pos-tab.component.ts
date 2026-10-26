import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { Order } from '../../../core/models/order.model';

@Component({
  selector: 'app-cajero-pos-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPENPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <div class="space-y-6">
            <!-- Aviso si la caja está cerrada -->
            @if (!cajaAbierta()) {
              <div class="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center justify-between gap-4">
                <div class="flex items-center gap-3">
                  <svg class="w-5 h-5 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                  <div>
                    <strong class="font-bold block text-sm">Atención: La caja del turno no ha sido abierta</strong>
                    <span class="text-xs text-amber-300/80">
                      Debes abrir caja con un fondo inicial para registrar cobros en efectivo y movimientos.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  (click)="abrirCaja.emit()"
                  class="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer shrink-0"
                >
                  Abrir Caja Ahora
                </button>
              </div>
            }

            <!-- Filtros & Buscador -->
            <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <!-- Filtro de tipo -->
              <div class="flex items-center gap-1.5 p-1 bg-[#14161a] border border-white/10 rounded-xl">
                <button
                  type="button"
                  (click)="filtroTipoChange.emit('TODAS')"
                  class="px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                  [ngClass]="filtroTipo() === 'TODAS' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'"
                >
                  Todas ({{ totalPorCobrar() }})
                </button>
                <button
                  type="button"
                  (click)="filtroTipoChange.emit('SALON')"
                  class="px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                  [ngClass]="filtroTipo() === 'SALON' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'"
                >
                  Salón / Mesas
                </button>
                <button
                  type="button"
                  (click)="filtroTipoChange.emit('DELIVERY')"
                  class="px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                  [ngClass]="filtroTipo() === 'DELIVERY' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'"
                >
                  Delivery
                </button>
                <button
                  type="button"
                  (click)="filtroTipoChange.emit('RECOJO_EN_TIENDA')"
                  class="px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                  [ngClass]="filtroTipo() === 'RECOJO_EN_TIENDA' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'"
                >
                  Para Llevar
                </button>
              </div>

              <!-- Input de Búsqueda -->
              <div class="relative w-full sm:w-72">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                </span>
                <input
                  type="text"
                  [(ngModel)]="busquedaTexto"
                  placeholder="Buscar por orden, cliente o mesa..."
                  class="w-full pl-9 pr-3 py-2 bg-[#14161a] border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <!-- Listado de Comandas para Cobro -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              @for (orden of comandas(); track orden.id) {
                <div 
                  class="p-4 rounded-2xl bg-[#14161a] border border-white/10 hover:border-emerald-500/50 transition flex flex-col justify-between gap-4 cursor-pointer shadow-lg"
                  (click)="cobrar.emit(orden)"
                >
                  <div>
                    <!-- Header Card -->
                    <div class="flex items-start justify-between gap-2 mb-2">
                      <div class="flex items-center gap-2">
                        <span class="px-2 py-0.5 rounded-md text-[11px] font-mono font-black tracking-wider bg-white/10 text-white">
                          #{{ orden.codigoSeguimiento || orden.id }}
                        </span>
                        <!-- Badge Tipo -->
                        @if (orden.tipo === 'SALON') {
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Mesa {{ orden.cliente.mesaNumero || 'S/N' }}
                          </span>
                        } @else if (orden.tipo === 'DELIVERY') {
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                            Delivery
                          </span>
                        } @else {
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            Para Llevar
                          </span>
                        }
                      </div>
                      <span class="text-[10px] text-slate-400 font-mono">
                        {{ orden.createdAt | date:'shortTime' }}
                      </span>
                    </div>

                    <!-- Cliente Info -->
                    <p class="text-sm font-bold text-white truncate">
                      {{ orden.cliente.nombre || 'Cliente General' }}
                    </p>
                    <p class="text-xs text-slate-400 truncate mb-3">
                      Tel: {{ orden.cliente.celular || 'Sin teléfono' }}
                    </p>

                    <!-- Items Preview -->
                    <div class="space-y-1 border-t border-white/5 pt-2">
                      @for (item of orden.items; track item.product.id) {
                        <div class="flex justify-between items-center text-xs text-slate-300">
                          <span class="truncate flex-1 pr-2">
                            {{ item.cantidad }}x {{ item.product.nombre }}
                          </span>
                          <span class="font-mono text-slate-400">
                            {{ (item.product.precio * item.cantidad) | currencyPEN }}
                          </span>
                        </div>
                      }
                    </div>
                  </div>

                  <!-- Footer Card con Total y Botón de Cobro -->
                  <div class="border-t border-white/10 pt-3 flex items-center justify-between gap-3">
                    <div>
                      <span class="text-[10px] text-slate-400 uppercase font-semibold block">Total a Cobrar</span>
                      <span class="font-display text-2xl text-polleria-gold font-bold">
                        {{ orden.total | currencyPEN }}
                      </span>
                    </div>
                    <button
                      type="button"
                      (click)="$event.stopPropagation(); cobrar.emit(orden)"
                      class="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
                      </svg>
                      <span>Cobrar</span>
                    </button>
                  </div>
                </div>
              } @empty {
                <div class="col-span-full py-16 text-center text-slate-500 space-y-3">
                  <svg class="w-12 h-12 mx-auto text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  <p class="text-sm font-medium">No hay comandas pendientes de cobro con los filtros seleccionados.</p>
                </div>
              }
            </div>
    </div>
  `
})
export class CajeroPosTabComponent {
  readonly cajaAbierta = input.required<boolean>();
  readonly filtroTipo = input<string>('TODAS');
  readonly totalPorCobrar = input<number>(0);
  readonly comandas = input.required<Order[]>();
  /** Texto de busqueda (two-way): el contenedor mantiene el valor. */
  readonly busquedaTexto = model<string>('');

  readonly filtroTipoChange = output<string>();
  readonly abrirCaja = output<void>();
  readonly cobrar = output<Order>();
}
