import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CurrencyPENPipe } from '../../../../shared/pipes/currency-pen.pipe';
import { Order } from '../../../../core/models/order.model';
import { PagoOrdenAdmin } from '../../../../core/services/payment.service';
import { OrderAdvance } from '../../models/admin-forms';
import { getCodeNum } from '../../shared/admin-format.util';

/** Inspector de orden (con verificación del comprobante de Yape para ADMIN). Presentacional. */
@Component({
  selector: 'app-order-detail-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, CurrencyPENPipe],
  template: `
      @if (order(); as order) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div class="w-full max-w-xl bg-slate-900 border border-polleria-gold/40 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100 animate-scale-up">
            
            <!-- Modal Header -->
            <div class="flex justify-between items-start border-b border-white/10 pb-4">
              <div>
                <div class="flex items-center gap-2.5">
                  <span class="font-mono text-2xl font-black text-polleria-gold">
                    #{{ getCodeNum(order.codigoSeguimiento) }}
                  </span>
                  <span class="text-xs font-bold px-2 py-0.5 rounded bg-white/10 text-slate-300">
                    {{ order.tipo }}
                  </span>
                  <span 
                    class="text-xs font-bold px-2 py-0.5 rounded"
                    [ngClass]="{
                      'bg-rose-500/20 text-rose-400': order.estado === 'PENDIENTE_PAGO' || order.estado === 'PAGADO',
                      'bg-amber-500/20 text-amber-300': order.estado === 'EN_PREPARACION' || order.estado === 'LISTO_COCINA',
                      'bg-sky-500/20 text-sky-300': order.estado === 'EN_REPARTO',
                      'bg-emerald-500/20 text-emerald-400': order.estado === 'COMPLETADO',
                      'bg-slate-700 text-slate-400': order.estado === 'CANCELADO'
                    }"
                  >
                    {{ order.estado }}
                  </span>
                </div>
                <p class="text-xs text-slate-400 mt-1">Registrado el: {{ order.createdAt | date:'medium' }}</p>
              </div>

              <button 
                (click)="closed.emit()" 
                class="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <!-- Customer Info -->
            <div class="bg-black/30 p-3.5 rounded-xl border border-white/5 space-y-1.5 text-xs">
              <div class="flex justify-between">
                <span class="text-slate-400">Cliente:</span>
                <strong class="text-white">{{ order.cliente.nombre }}</strong>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">Teléfono:</span>
                <span class="text-slate-200 font-mono">{{ order.cliente.celular }}</span>
              </div>
              @if (order.cliente.direccion) {
                <div class="flex justify-between">
                  <span class="text-slate-400">Dirección:</span>
                  <span class="text-slate-200 text-right">{{ order.cliente.direccion }}</span>
                </div>
              }
              @if (order.cliente.referencia) {
                <div class="flex justify-between">
                  <span class="text-slate-400">Referencia:</span>
                  <span class="text-amber-300/90 italic text-right">{{ order.cliente.referencia }}</span>
                </div>
              }
              <div class="flex justify-between">
                <span class="text-slate-400">Método de Pago:</span>
                <span class="text-polleria-gold font-bold">{{ order.metodoPago || 'No registrado' }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-slate-400">Estado del Cobro:</span>
                @if (isPaid()) {
                  <span class="text-emerald-400 font-bold bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30 text-[11px] font-mono">
                    ✓ COBRADO / PAGADO
                  </span>
                } @else {
                  <span class="text-amber-300 font-bold bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 text-[11px] font-mono">
                    💵 PAGO PENDIENTE (Contraentrega)
                  </span>
                }
              </div>
              @if (order.tipo === 'DELIVERY') {
                <div class="flex justify-between items-center pt-1.5 border-t border-white/5">
                  <span class="text-slate-400">Motorizado Asignado:</span>
                  @if (order.repartidorId) {
                    <span class="text-emerald-400 font-bold flex items-center gap-1">
                      <span>🛵</span>
                      <span>{{ motorizadoName() }}</span>
                    </span>
                  } @else {
                    <span class="text-amber-400 italic">Por asignar al despachar</span>
                  }
                </div>
              }
            </div>

            <!-- Items List -->
            <div class="space-y-2">
              <span class="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Detalle de Platos</span>
              <div class="max-h-48 overflow-y-auto space-y-2 pr-1 divide-y divide-white/5">
                @for (item of order.items; track item.product.id) {
                  <div class="pt-2 first:pt-0 flex justify-between items-start text-xs">
                    <div>
                      <p class="font-bold text-white">{{ item.cantidad }}x {{ item.product.nombre }}</p>
                      @if (item.notas) {
                        <p class="text-[11px] text-amber-300/80 italic">Instrucción: {{ item.notas }}</p>
                      }
                    </div>
                    <span class="font-mono font-bold text-slate-200">{{ item.subtotal | currencyPEN }}</span>
                  </div>
                }
              </div>
            </div>

            <!-- Total Breakdown -->
            <div class="bg-[#14161a] p-3 rounded-xl border border-white/5 flex justify-between items-center">
              <span class="font-bold text-sm text-white">Monto Total de la Orden:</span>
              <span class="font-display text-2xl font-black text-polleria-gold">{{ order.total | currencyPEN }}</span>
            </div>

            <!-- T6e (S6/S7): verificación del comprobante de Yape. Solo el ADMIN la ve y la ejecuta. -->
            @if (isAdmin()) {
              @if (comprobanteCargando()) {
                <div class="bg-black/30 p-3.5 rounded-xl border border-white/5 text-xs text-slate-400">
                  Buscando el comprobante de Yape de este pedido...
                </div>
              }

              @if (comprobantePendiente(); as pago) {
                <div class="bg-black/30 p-3.5 rounded-xl border border-polleria-gold/30 space-y-3">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Comprobante de Yape</span>
                    <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      Pendiente de verificación
                    </span>
                  </div>

                  @if (pago.comprobanteUrl) {
                    <img
                      [src]="pago.comprobanteUrl"
                      alt="Comprobante de Yape del pedido #{{ getCodeNum(order.codigoSeguimiento) }}"
                      class="w-full max-h-72 object-contain rounded-lg border border-white/10 bg-slate-950"
                    />
                    <p class="text-[10px] text-slate-500">
                      La imagen se pide al abrir el detalle y su enlace vence en 300 s: no se reutiliza entre consultas.
                    </p>
                  }

                  <div class="flex justify-between text-xs">
                    <span class="text-slate-400">Monto registrado:</span>
                    <strong class="text-polleria-gold font-mono">{{ pago.monto | currencyPEN }}</strong>
                  </div>

                  <div class="space-y-1.5">
                    <label
                      for="motivo-rechazo-comprobante"
                      class="text-[11px] font-bold uppercase text-slate-400 tracking-wider"
                    >
                      Motivo de rechazo
                    </label>
                    <textarea
                      id="motivo-rechazo-comprobante"
                      rows="2"
                      [ngModel]="motivoRechazo()"
                      (ngModelChange)="motivoRechazoChange.emit($event)"
                      placeholder="Ej.: el monto no coincide con el total del pedido"
                      class="w-full rounded-lg bg-slate-950 border border-white/10 text-xs text-slate-200 p-2 focus:border-polleria-gold focus:outline-none"
                    ></textarea>
                    <p class="text-[10px] text-slate-400">
                      El rechazo exige un motivo: el cliente lo recibe por WhatsApp y puede enviar un comprobante nuevo.
                    </p>
                  </div>

                  @if (errorVerificacion(); as error) {
                    <div class="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs" role="alert">
                      {{ error }}
                    </div>
                  }

                  <div class="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      (click)="rejectProof.emit()"
                      [disabled]="!puedeRechazarComprobante() || verificandoComprobante()"
                      [attr.title]="puedeRechazarComprobante() ? 'Rechazar el comprobante' : 'Escribí el motivo de rechazo para habilitar el botón'"
                      class="px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer bg-rose-900/40 hover:bg-rose-700 text-rose-300 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Rechazar comprobante
                    </button>
                    <button
                      type="button"
                      (click)="approveProof.emit()"
                      [disabled]="verificandoComprobante()"
                      class="px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {{ verificandoComprobante() ? 'Verificando...' : 'Aprobar comprobante' }}
                    </button>
                  </div>

                  @if (!puedeRechazarComprobante()) {
                    <p class="text-[10px] text-slate-400 text-right">
                      «Rechazar comprobante» está deshabilitado hasta que escribas el motivo.
                    </p>
                  }
                </div>
              }

              @if (decisionVerificacion(); as decision) {
                <div
                  class="p-3 rounded-xl text-xs border"
                  [ngClass]="decision.aprobado ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'"
                  role="status"
                >
                  @if (decision.aprobado) {
                    Comprobante aprobado. La orden avanzó y el cliente recibió el aviso por WhatsApp.
                  } @else {
                    Comprobante rechazado con el motivo indicado. El cliente recibió el aviso por WhatsApp.
                  }
                </div>
              }
            }

            <!-- Action Buttons -->
            <div class="flex flex-wrap justify-end gap-2 pt-2 border-t border-white/10">
              @if (order.estado !== 'COMPLETADO' && order.estado !== 'CANCELADO') {
                <button 
                  (click)="cancelled.emit(order); closed.emit()"
                  class="px-3.5 py-2 rounded-xl bg-rose-900/40 hover:bg-rose-700 text-rose-300 text-xs font-bold transition cursor-pointer"
                >
                  Cancelar Orden
                </button>
              }

              @if (order.estado === 'PENDIENTE_PAGO' || order.estado === 'PAGADO') {
                <button 
                  (click)="advance.emit({ order, status: 'EN_PREPARACION' }); closed.emit()"
                  class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer"
                >
                  Aceptar & Pasar a Cocina
                </button>
              } @else if (order.estado === 'EN_PREPARACION') {
                <button 
                  (click)="markReady.emit(order); closed.emit()"
                  class="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold transition cursor-pointer"
                >
                  Marcar Listo en Cocina
                </button>
              } @else if (order.estado === 'LISTO_COCINA') {
                <button 
                  (click)="advanceAfterReady.emit(order); closed.emit()"
                  class="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition cursor-pointer"
                >
                  {{ order.tipo === 'DELIVERY' ? 'Despachar (En Camino)' : 'Marcar Entregado' }}
                </button>
              } @else if (order.estado === 'EN_REPARTO') {
                <button 
                  (click)="advance.emit({ order, status: 'COMPLETADO' }); closed.emit()"
                  class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer"
                >
                  Confirmar Entrega
                </button>
              }
            </div>

          </div>
        </div>
      }
  `
})
export class OrderDetailModalComponent {
  readonly order = input.required<Order>();
  readonly isAdmin = input.required<boolean>();
  readonly isPaid = input.required<boolean>();
  readonly motorizadoName = input.required<string>();

  // Verificación del comprobante (estado que resuelve el contenedor contra el backend)
  readonly comprobanteCargando = input.required<boolean>();
  readonly comprobantePendiente = input.required<PagoOrdenAdmin | null>();
  readonly motivoRechazo = input.required<string>();
  readonly errorVerificacion = input.required<string | null>();
  readonly verificandoComprobante = input.required<boolean>();
  readonly decisionVerificacion = input.required<{ aprobado: boolean } | null>();

  readonly closed = output<void>();
  readonly cancelled = output<Order>();
  readonly advance = output<OrderAdvance>();
  readonly markReady = output<Order>();
  readonly advanceAfterReady = output<Order>();
  readonly motivoRechazoChange = output<string>();
  readonly approveProof = output<void>();
  readonly rejectProof = output<void>();

  /** Rechazar exige motivo: sin él el botón queda deshabilitado y se explica por qué. */
  protected readonly puedeRechazarComprobante = computed(() => this.motivoRechazo().trim().length > 0);

  protected readonly getCodeNum = getCodeNum;
}
