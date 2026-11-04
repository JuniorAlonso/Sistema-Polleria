import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CurrencyPENPipe } from '../../../../shared/pipes/currency-pen.pipe';
import { Order } from '../../../../core/models/order.model';
import { PagoOrdenAdmin } from '../../../../core/services/payment.service';

/** Modal de validación de un comprobante Yape recibido por WhatsApp. Presentacional. */
@Component({
  selector: 'app-whatsapp-proof-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, CurrencyPENPipe],
  template: `
      @if (orden(); as orden) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div class="bg-[#14161a] border border-white/10 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col">
            
            <!-- Modal Header -->
            <div class="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-black/30">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-polleria-gold/15 text-polleria-gold flex items-center justify-center font-bold">
                  #{{ orden.id }}
                </div>
                <div>
                  <h3 class="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <span>Validación de Captura Yape</span>
                    <span class="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      WhatsApp
                    </span>
                  </h3>
                  <p class="text-xs text-slate-400">Cliente: {{ orden.cliente.nombre }} ({{ orden.cliente.celular }})</p>
                </div>
              </div>

              <button
                type="button"
                (click)="closed.emit()"
                class="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <!-- Modal Content Body -->
            <div class="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              
              <!-- Comparativa de montos -->
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div class="p-3 rounded-xl bg-black/40 border border-white/10">
                  <p class="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Total del Pedido</p>
                  <p class="mt-1 text-lg font-bold font-mono text-polleria-gold">{{ orden.total | currencyPEN }}</p>
                </div>
                <div class="p-3 rounded-xl bg-black/40 border border-white/10">
                  <p class="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Monto Registrado</p>
                  <p class="mt-1 text-lg font-bold font-mono text-white">
                    {{ (comprobanteWhatsappData()?.monto ?? orden.total) | currencyPEN }}
                  </p>
                </div>
                <div class="p-3 rounded-xl bg-black/40 border border-white/10 col-span-2 sm:col-span-1">
                  <p class="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Estado del Pago</p>
                  <p class="mt-1 font-bold text-amber-300">
                    {{ comprobanteWhatsappData()?.estado || 'PENDIENTE_VERIFICACION' }}
                  </p>
                </div>
              </div>

              <!-- Imagen de la Captura del Yape -->
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <label class="text-[11px] uppercase tracking-wider font-bold text-slate-300">
                    Captura del Comprobante (Enviada por WhatsApp)
                  </label>
                  @if (comprobanteWhatsappData()?.comprobanteUrl; as url) {
                    <a [href]="url" target="_blank" class="text-polleria-gold hover:underline flex items-center gap-1 font-semibold text-[11px]">
                      Abrir en pestaña nueva ↗
                    </a>
                  }
                </div>

                @if (cargandoComprobanteWhatsapp()) {
                  <div class="h-64 rounded-xl bg-black/50 border border-white/10 flex flex-col items-center justify-center gap-2">
                    <div class="w-7 h-7 border-2 border-polleria-gold border-t-transparent rounded-full animate-spin"></div>
                    <span class="text-slate-400">Cargando comprobante desde MinIO...</span>
                  </div>
                } @else {
                  @if (comprobanteWhatsappData()?.comprobanteUrl; as imgUrl) {
                    <div class="bg-black/80 rounded-xl border border-white/10 p-2 flex items-center justify-center max-h-80 overflow-hidden">
                      <img
                        [src]="imgUrl"
                        alt="Captura Yape orden #{{ orden.id }}"
                        class="max-h-76 w-auto object-contain rounded-lg shadow-md"
                      />
                    </div>
                    <p class="text-[10px] text-slate-500">
                      * El enlace de la captura es firmado y vence en 300 segundos por seguridad.
                    </p>
                  } @else {
                    <div class="p-6 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center space-y-2">
                      <p class="text-amber-200 font-semibold">No hay imagen de captura disponible o aún no se ha subido</p>
                      <p class="text-slate-400 text-[11px]">
                        El cliente puede estar en proceso de adjuntar la captura al chat de WhatsApp.
                      </p>
                    </div>
                  }
                }
              </div>

              <!-- Motivo de Rechazo (si aplica) -->
              <div class="p-4 rounded-xl bg-black/30 border border-white/10 space-y-2.5">
                <div class="flex items-center justify-between">
                  <label for="motivoRechazoWhatsappInput" class="text-[11px] uppercase tracking-wider font-bold text-slate-300">
                    Motivo de Rechazo (Opcional si apruebas, Obligatorio si rechazas)
                  </label>
                  <span class="text-[10px] text-slate-500">Se enviará como mensaje de WhatsApp al cliente</span>
                </div>

                <!-- Chips de motivos comunes -->
                <div class="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    (click)="motivoChange.emit('El monto transferido no coincide con el total de la orden.')"
                    class="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-slate-300 transition"
                  >
                    Monto no coincide
                  </button>
                  <button
                    type="button"
                    (click)="motivoChange.emit('La captura está borrosa o ilegible. Por favor envía una captura clara.')"
                    class="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-slate-300 transition"
                  >
                    Captura borrosa
                  </button>
                  <button
                    type="button"
                    (click)="motivoChange.emit('La captura está cortada y no se aprecia el número de operación ni la fecha.')"
                    class="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-slate-300 transition"
                  >
                    Captura cortada
                  </button>
                  <button
                    type="button"
                    (click)="motivoChange.emit('El comprobante corresponde a una fecha u operación ya registrada anteriormente.')"
                    class="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-slate-300 transition"
                  >
                    Comprobante duplicado
                  </button>
                </div>

                <textarea
                  id="motivoRechazoWhatsappInput"
                  rows="2"
                  [ngModel]="motivoRechazoWhatsapp()"
                  (ngModelChange)="motivoChange.emit($event)"
                  placeholder="Escribe el motivo del rechazo para que el cliente lo reciba por WhatsApp..."
                  class="w-full rounded-xl bg-black/40 border border-white/10 p-2.5 text-slate-200 text-xs focus:border-polleria-gold focus:outline-none"
                ></textarea>
              </div>

              @if (errorVerifWhatsapp()) {
                <div class="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                  {{ errorVerifWhatsapp() }}
                </div>
              }

              @if (feedbackVerifWhatsapp(); as fb) {
                <div class="p-3 rounded-xl border text-xs"
                  [ngClass]="fb.aprobado ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/15 border-rose-500/30 text-rose-300'">
                  {{ fb.aprobado ? '✓ Comprobante aprobado con éxito. La orden #' + fb.ordenId + ' pasó a preparación y el cliente fue notificado por WhatsApp.' : '✕ Comprobante rechazado. Se notificó al cliente el motivo por WhatsApp.' }}
                </div>
              }

            </div>

            <!-- Modal Footer Actions -->
            <div class="p-4 border-t border-white/10 bg-black/30 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                (click)="closed.emit()"
                class="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 font-semibold text-xs transition cursor-pointer"
              >
                Cerrar
              </button>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  (click)="rejected.emit()"
                  [disabled]="verificandoWhatsapp() || !motivoRechazoWhatsapp().trim()"
                  class="px-4 py-2.5 rounded-xl bg-rose-900/40 hover:bg-rose-800 border border-rose-500/40 text-rose-200 font-bold text-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  @if (verificandoWhatsapp()) {
                    <span class="w-3.5 h-3.5 border-2 border-rose-300 border-t-transparent rounded-full animate-spin"></span>
                  } @else {
                    <span>✕</span>
                  }
                  <span>Rechazar Comprobante</span>
                </button>

                <button
                  type="button"
                  (click)="approved.emit()"
                  [disabled]="verificandoWhatsapp()"
                  class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-lg shadow-emerald-950"
                >
                  @if (verificandoWhatsapp()) {
                    <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Confirmando...</span>
                  } @else {
                    <span>✓</span>
                    <span>Aprobar y Pasar a Cocina</span>
                  }
                </button>
              </div>
            </div>

          </div>
        </div>
      }
  `
})
export class WhatsappProofModalComponent {
  readonly orden = input.required<Order>();
  readonly comprobanteWhatsappData = input.required<PagoOrdenAdmin | null>();
  readonly cargandoComprobanteWhatsapp = input.required<boolean>();
  readonly verificandoWhatsapp = input.required<boolean>();
  readonly motivoRechazoWhatsapp = input.required<string>();
  readonly errorVerifWhatsapp = input.required<string | null>();
  readonly feedbackVerifWhatsapp = input.required<{ aprobado: boolean; ordenId: string } | null>();

  readonly closed = output<void>();
  readonly motivoChange = output<string>();
  readonly approved = output<void>();
  readonly rejected = output<void>();
}
