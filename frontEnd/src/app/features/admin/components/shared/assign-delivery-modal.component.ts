import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyPENPipe } from '../../../../shared/pipes/currency-pen.pipe';
import { Order } from '../../../../core/models/order.model';
import { Repartidor } from '../../../../core/services/repartidores.service';
import { getCodeNum } from '../../shared/admin-format.util';

/** Modal de asignación de motorizado (RF18). Presentacional: solo input()/output(). */
@Component({
  selector: 'app-assign-delivery-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CurrencyPENPipe],
  template: `
      @if (order(); as order) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div class="w-full max-w-lg bg-[#14161a] border border-amber-500/30 rounded-2xl p-6 shadow-2xl space-y-5 text-slate-100 animate-scale-up">
            
            <!-- Modal Header -->
            <div class="flex justify-between items-start border-b border-white/10 pb-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h2m-6 0a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/>
                  </svg>
                </div>
                <div>
                  <h3 class="font-display text-xl font-bold text-white flex items-center gap-2">
                    Asignar Motorizado
                    <span class="font-mono text-sm font-black text-polleria-gold px-2 py-0.5 rounded bg-black/40 border border-amber-500/30">
                      #{{ getCodeNum(order.codigoSeguimiento) }}
                    </span>
                  </h3>
                  <p class="text-xs text-slate-400 mt-0.5">
                    Selecciona el repartidor para despachar la orden a <span class="text-sky-300 font-bold">«En camino»</span>.
                  </p>
                </div>
              </div>

              <button 
                (click)="closed.emit()" 
                class="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
                aria-label="Cerrar modal"
              >
                ✕
              </button>
            </div>

            <!-- Order Quick Summary -->
            <div class="bg-black/40 p-3.5 rounded-xl border border-white/5 space-y-2 text-xs">
              <div class="flex justify-between items-center">
                <span class="text-slate-400 font-semibold">Cliente:</span>
                <span class="text-white font-bold">{{ order.cliente.nombre }} ({{ order.cliente.celular }})</span>
              </div>
              <div class="flex justify-between items-start gap-3">
                <span class="text-slate-400 font-semibold shrink-0">Dirección:</span>
                <span class="text-slate-200 text-right truncate font-medium">{{ order.cliente.direccion || 'Sin dirección especificada' }}</span>
              </div>
              @if (order.cliente.referencia) {
                <div class="flex justify-between items-start gap-3">
                  <span class="text-slate-400 font-semibold shrink-0">Referencia:</span>
                  <span class="text-amber-300/80 text-right italic">{{ order.cliente.referencia }}</span>
                </div>
              }
              <div class="flex justify-between items-center pt-1.5 border-t border-white/5">
                <span class="text-slate-400 font-semibold">Total / Pago:</span>
                <span class="font-bold text-polleria-gold">{{ order.total | currencyPEN }} <span class="text-slate-400 font-normal">({{ order.metodoPago || 'No registrado' }})</span></span>
              </div>
              <div class="p-2.5 rounded-xl border text-xs flex items-center justify-between"
                [ngClass]="isPaid() ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300' : 'bg-amber-950/30 border-amber-500/40 text-amber-300'"
              >
                <div class="flex items-center gap-1.5 font-bold">
                  @if (isPaid()) {
                    <span>✓ PEDIDO PAGADO</span>
                  } @else {
                    <span>💵 PAGO PENDIENTE (Contraentrega)</span>
                  }
                </div>
                <span class="text-[11px] font-medium font-mono">
                  {{ isPaid() ? 'No cobrar al cliente' : 'Cobrar: ' + (order.total | currencyPEN) }}
                </span>
              </div>
            </div>

            <!-- Motorizado Selector -->
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <label class="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Repartidores disponibles
                </label>
              </div>

              @if (rosterLoading()) {
                <p class="text-xs text-slate-400">Cargando motorizados...</p>
              } @else if (rosterError()) {
                <div class="p-3 rounded-xl bg-rose-900/30 border border-rose-500/40 text-xs text-rose-200">
                  No se pudo leer el roster de motorizados (auth-service). Sin esa lista no se sabe a quién
                  mandar el pedido, así que el despacho queda bloqueado.
                </div>
              } @else if (repartidores().length === 0) {
                <div class="p-3 rounded-xl bg-amber-900/30 border border-amber-500/40 text-xs text-amber-200">
                  No hay usuarios con rol REPARTIDOR activos. Registra un motorizado antes de despachar.
                </div>
              } @else {
                <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
                  @for (motorizado of repartidores(); track motorizado.id) {
                    <div 
                      (click)="repartidorSelected.emit(motorizado.id)"
                      class="p-3 rounded-xl border transition cursor-pointer flex items-center justify-between group"
                      [ngClass]="selectedRepartidorId() === motorizado.id 
                        ? 'bg-amber-500/10 border-amber-500/60 ring-1 ring-amber-500/40' 
                        : 'bg-black/30 border-white/5 hover:border-white/20 hover:bg-white/5'"
                    >
                      <div class="flex items-center gap-3">
                        <div 
                          class="w-9 h-9 rounded-lg flex items-center justify-center font-black text-xs transition"
                          [ngClass]="selectedRepartidorId() === motorizado.id 
                            ? 'bg-amber-500 text-slate-950 font-bold shadow' 
                            : 'bg-white/10 text-slate-300 group-hover:bg-white/20'"
                        >
                          #{{ motorizado.id }}
                        </div>
                        <div>
                          <div class="text-xs font-bold text-white flex items-center gap-2">
                            <span>{{ motorizado.nombre }}</span>
                          </div>
                          <div class="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span class="font-mono">{{ motorizado.telefono || 'sin teléfono registrado' }}</span>
                            <span>•</span>
                            <span class="font-mono text-slate-500">{{ motorizado.email }}</span>
                          </div>
                        </div>
                      </div>

                      <div 
                        class="w-5 h-5 rounded-full border flex items-center justify-center transition"
                        [ngClass]="selectedRepartidorId() === motorizado.id 
                          ? 'border-amber-400 bg-amber-400 text-slate-950' 
                          : 'border-white/20'"
                      >
                        @if (selectedRepartidorId() === motorizado.id) {
                          <svg class="w-3.5 h-3.5 font-bold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
                          </svg>
                        }
                      </div>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Modal Actions -->
            <div class="flex justify-end items-center gap-3 pt-3 border-t border-white/10">
              <button 
                type="button"
                (click)="closed.emit()"
                class="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition cursor-pointer"
                [disabled]="dispatching()"
              >
                Cancelar
              </button>

              <button 
                type="button"
                (click)="confirmed.emit()"
                class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold transition cursor-pointer shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                [disabled]="dispatching() || !canConfirm()"
              >
                @if (dispatching()) {
                  <span class="inline-block w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                  <span>Despachando...</span>
                } @else {
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
                  </svg>
                  <span>Confirmar & Pasar a «En Camino»</span>
                }
              </button>
            </div>

          </div>
        </div>
      }
  `
})
export class AssignDeliveryModalComponent {
  readonly order = input.required<Order>();
  readonly isPaid = input.required<boolean>();
  /** Roster real de motorizados (auth-service). */
  readonly repartidores = input.required<Repartidor[]>();
  readonly rosterLoading = input.required<boolean>();
  readonly rosterError = input.required<boolean>();
  readonly selectedRepartidorId = input.required<number | null>();
  readonly dispatching = input.required<boolean>();
  readonly canConfirm = input.required<boolean>();

  readonly repartidorSelected = output<number>();
  readonly closed = output<void>();
  readonly confirmed = output<void>();

  protected readonly getCodeNum = getCodeNum;
}
