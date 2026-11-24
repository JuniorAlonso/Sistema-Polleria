import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { TicketVista } from '../models/cajero.models';
import { BackendComprobanteResponse } from '../../../core/models/api-contracts.model';
import { EnvioSunatResponse } from '../../../core/api/facturacion-sunat-api.service';

/** Ticket data plus the receipt the backend emitted (null/absent when emission failed). */
export type TicketComprobanteVista = TicketVista & { comprobante?: BackendComprobanteResponse | null };

@Component({
  selector: 'app-cajero-ticket-modal',
  standalone: true,
  imports: [CommonModule, CurrencyPENPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
        <div class="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div class="w-full max-w-sm max-h-[90vh] overflow-y-auto print:max-h-none print:overflow-visible bg-white text-slate-950 rounded-2xl shadow-2xl p-6 space-y-4 print:p-0 print:m-0 print:shadow-none">
            
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
                @if (comprobante; as c) {
                  <span class="text-xs font-bold uppercase tracking-wider bg-slate-100 px-3 py-1 rounded-md">
                    {{ c.tipo === 'FACTURA' ? 'FACTURA' : 'BOLETA DE VENTA' }}
                  </span>
                  <p class="text-xs font-mono font-bold mt-1">{{ c.serieCorrelativo }}</p>
                  @if (c.anulado) {
                    <span class="inline-block mt-1 px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold uppercase">
                      ANULADO
                    </span>
                  }
                } @else {
                  <span class="text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-3 py-1 rounded-md">
                    Comprobante pendiente
                  </span>
                  <p class="text-[10px] text-slate-500 mt-1">El comprobante aún no se ha emitido para esta venta.</p>
                }
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
                <span>{{ ticket().cajero || '—' }}</span>
              </div>
              <div class="flex justify-between">
                <span>Cliente:</span>
                <span class="font-bold truncate max-w-[160px]">{{ clienteNombre }}</span>
              </div>
              @if (comprobante?.clienteNumDoc) {
                <div class="flex justify-between">
                  <span>{{ comprobante?.clienteTipoDoc || 'Doc.' }}:</span>
                  <span>{{ comprobante?.clienteNumDoc }}</span>
                </div>
              }
              <div class="flex justify-between">
                <span>Tipo:</span>
                <span class="font-bold">{{ tipoOrden }}</span>
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
              @if (comprobante; as c) {
                <div class="flex justify-between text-slate-600">
                  <span>OP. GRAVADA:</span>
                  <span>{{ c.subtotal | currencyPEN }}</span>
                </div>
                <div class="flex justify-between text-slate-600">
                  <span>I.G.V. (18%):</span>
                  <span>{{ c.igv | currencyPEN }}</span>
                </div>
              }
              <div class="flex justify-between font-bold text-base text-slate-900 pt-1">
                <span>TOTAL:</span>
                <span>{{ totalMonto | currencyPEN }}</span>
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

            <!-- Facturación SUNAT (bajo demanda, oculto al imprimir) -->
            @if (comprobante; as c) {
              @if (!c.anulado) {
                <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 print:hidden">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      Comprobante SUNAT
                    </span>
                    <span
                      class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                      [ngClass]="claseEstadoSunat()"
                    >
                      {{ etiquetaEstadoSunat() }}
                    </span>
                  </div>

                  @if (envioSunat(); as envio) {
                    @if (envio.descripcion) {
                      <p class="text-[11px] text-slate-600 leading-snug">
                        @if (envio.codigoRespuesta) {
                          <span class="font-mono font-bold">[{{ envio.codigoRespuesta }}]</span>
                        }
                        {{ envio.descripcion }}
                      </p>
                    }
                    @if (envio.observaciones) {
                      <p class="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                        {{ envio.observaciones }}
                      </p>
                    }
                  }

                  <div class="flex flex-wrap gap-1.5">
                    @if (puedeEnviarSunat()) {
                      <button
                        type="button"
                        [disabled]="enviandoSunat()"
                        (click)="enviarSunat.emit(c.ordenId)"
                        class="flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-[11px] uppercase tracking-wider rounded-lg transition cursor-pointer"
                      >
                        {{ enviandoSunat() ? 'Enviando...' : (envioSunat() ? 'Reintentar envío SUNAT' : 'Enviar a SUNAT') }}
                      </button>
                    }
                    @if (esAceptadoSunat()) {
                      <button
                        type="button"
                        (click)="verTicketSunat.emit(c.ordenId)"
                        class="flex-1 py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-lg transition cursor-pointer"
                      >
                        Ticket SUNAT (QR)
                      </button>
                      <button
                        type="button"
                        (click)="descargarXml.emit(c.ordenId)"
                        class="py-1.5 px-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-[11px] rounded-lg transition cursor-pointer"
                      >
                        XML
                      </button>
                      @if (envioSunat()?.tieneCdr) {
                        <button
                          type="button"
                          (click)="descargarCdr.emit(c.ordenId)"
                          class="py-1.5 px-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-[11px] rounded-lg transition cursor-pointer"
                        >
                          CDR
                        </button>
                      }
                    }
                  </div>
                </div>
              }
            }

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
  readonly ticket = input.required<TicketComprobanteVista>();
  readonly envioSunat = input<EnvioSunatResponse | null>(null);
  readonly enviandoSunat = input<boolean>(false);

  readonly imprimir = output<void>();
  readonly cerrar = output<void>();
  readonly enviarSunat = output<number>();
  readonly verTicketSunat = output<number>();
  readonly descargarXml = output<number>();
  readonly descargarCdr = output<number>();

  /** Receipt emitted by the backend; null when emission failed or is unknown. */
  protected get comprobante(): BackendComprobanteResponse | null {
    return this.ticket().comprobante ?? null;
  }

  protected esAceptadoSunat(): boolean {
    const estado = this.envioSunat()?.estado;
    return estado === 'ACEPTADO' || estado === 'OBSERVADO';
  }

  protected puedeEnviarSunat(): boolean {
    const estado = this.envioSunat()?.estado;
    return !estado || estado === 'RECHAZADO' || estado === 'ERROR' || estado === 'ENVIANDO';
  }

  protected etiquetaEstadoSunat(): string {
    if (this.enviandoSunat()) return 'ENVIANDO...';
    return this.envioSunat()?.estado ?? 'Sin enviar a SUNAT';
  }

  protected claseEstadoSunat(): string {
    if (this.enviandoSunat()) return 'bg-sky-100 text-sky-800';
    switch (this.envioSunat()?.estado) {
      case 'ACEPTADO': return 'bg-emerald-100 text-emerald-800';
      case 'OBSERVADO': return 'bg-amber-100 text-amber-800';
      case 'RECHAZADO':
      case 'ERROR': return 'bg-rose-100 text-rose-800';
      case 'ENVIANDO': return 'bg-sky-100 text-sky-800';
      default: return 'bg-slate-200 text-slate-700';
    }
  }

  protected get clienteNombre(): string {
    const t = this.ticket() as any;
    return this.comprobante?.clienteNombre || t?.cliente || t?.clienteNombre || '—';
  }

  protected get tipoOrden(): string {
    const t = this.ticket() as any;
    return t?.tipo || t?.tipoOrden || '—';
  }

  protected get totalMonto(): number {
    const t = this.ticket() as any;
    return Number(this.comprobante?.total ?? t?.total ?? t?.monto ?? 0);
  }
}
