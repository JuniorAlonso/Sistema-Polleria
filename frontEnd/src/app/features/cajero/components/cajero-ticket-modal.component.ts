import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { TicketVista } from '../models/cajero.models';

@Component({
  selector: 'app-cajero-ticket-modal',
  standalone: true,
  imports: [CommonModule, CurrencyPENPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
        <div class="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div class="w-full max-w-sm bg-white text-slate-950 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4 print:p-0 print:m-0 print:shadow-none">
            
            <!-- Encabezado Ticket -->
            <div class="text-center space-y-1 border-b border-dashed border-slate-300 pb-4">
              <h4 class="font-display text-2xl font-black tracking-wide text-slate-900">
                POLLERÍA SAN POLLO DE ICA
              </h4>
              <p class="text-[11px] text-slate-600 font-mono">
                R.U.C. 20608945123 • Sabor Criollo & Brasa
              </p>
              <p class="text-[10px] text-slate-500">
                Av. San Martín 456 - Ica, Perú
              </p>
              <div class="pt-2">
                <span class="text-xs font-bold uppercase tracking-wider bg-slate-100 px-3 py-1 rounded-md">
                  BOLETA DE VENTA ELECTRÓNICA
                </span>
                <p class="text-xs font-mono font-bold mt-1">
                  B001-{{ ticket().ordenId }}
                </p>
              </div>
            </div>

            <!-- Datos de la Venta -->
            <div class="text-xs space-y-1 font-mono text-slate-700 border-b border-dashed border-slate-300 pb-3">
              <div class="flex justify-between">
                <span>Fecha:</span>
                <span>{{ ticket().fechaHora | date:'dd/MM/yyyy HH:mm' }}</span>
              </div>
              <div class="flex justify-between">
                <span>Cajero:</span>
                <span>{{ ticket().cajero }}</span>
              </div>
              <div class="flex justify-between">
                <span>Cliente:</span>
                <span class="font-bold truncate max-w-[160px]">{{ ticket().cliente }}</span>
              </div>
              <div class="flex justify-between">
                <span>Tipo:</span>
                <span class="font-bold">{{ ticket().tipo }}</span>
              </div>
            </div>

            <!-- Detalle de Productos -->
            <div class="space-y-1.5 border-b border-dashed border-slate-300 pb-3 text-xs">
              <div class="flex justify-between font-bold text-slate-800 text-[11px]">
                <span>CANT / DESCRIPCIÓN</span>
                <span>TOTAL</span>
              </div>
              @for (item of ticket().items; track item.product.id) {
                <div class="flex justify-between text-slate-700">
                  <span class="truncate pr-2">
                    {{ item.cantidad }}x {{ item.product.nombre }}
                  </span>
                  <span class="font-mono shrink-0">
                    {{ (item.product.precio * item.cantidad) | currencyPEN }}
                  </span>
                </div>
              }
            </div>

            <!-- Totales & Cuadre -->
            <div class="space-y-1 text-xs font-mono border-b border-dashed border-slate-300 pb-3">
              <div class="flex justify-between text-slate-600">
                <span>OP. GRAVADA:</span>
                <span>{{ ((ticket().total || 0) / 1.18) | currencyPEN }}</span>
              </div>
              <div class="flex justify-between text-slate-600">
                <span>I.G.V. (18%):</span>
                <span>{{ ((ticket().total || 0) - ((ticket().total || 0) / 1.18)) | currencyPEN }}</span>
              </div>
              <div class="flex justify-between font-bold text-base text-slate-900 pt-1">
                <span>TOTAL:</span>
                <span>{{ ticket().total | currencyPEN }}</span>
              </div>
              <div class="flex justify-between text-slate-700 pt-2 border-t border-slate-200">
                <span>MÉTODO:</span>
                <span class="font-bold">{{ ticket().metodo }}</span>
              </div>
              @if (ticket().metodo === 'EFECTIVO') {
                <div class="flex justify-between text-slate-600">
                  <span>RECIBIDO:</span>
                  <span>{{ ticket().efectivoRecibido | currencyPEN }}</span>
                </div>
                <div class="flex justify-between font-bold text-emerald-700">
                  <span>VUELTO:</span>
                  <span>{{ ticket().vuelto | currencyPEN }}</span>
                </div>
              } @else {
                <div class="flex justify-between text-slate-600">
                  <span>REF / OP:</span>
                  <span>{{ ticket().referencia }}</span>
                </div>
              }
            </div>

            <!-- Footer Ticket -->
            <div class="text-center space-y-1 text-[11px] text-slate-500 pt-1">
              <p class="font-serif italic font-bold">¡Gracias por su preferencia!</p>
              <p class="text-[10px]">Conserve este comprobante para cualquier reclamo.</p>
            </div>

            <!-- Botones Imprimir y Cerrar (Ocultos al imprimir) -->
            <div class="flex items-center gap-2 pt-2 print:hidden">
              <button
                type="button"
                (click)="imprimir.emit()"
                class="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                </svg>
                <span>Imprimir Ticket</span>
              </button>

              <button
                type="button"
                (click)="cerrar.emit()"
                class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
              >
                Listo
              </button>
            </div>

          </div>
        </div>
  `
})
export class CajeroTicketModalComponent {
  readonly ticket = input.required<TicketVista>();

  readonly imprimir = output<void>();
  readonly cerrar = output<void>();
}
