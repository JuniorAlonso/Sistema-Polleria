import { ChangeDetectionStrategy, Component, OnInit, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CurrencyPENPipe } from '../../../../shared/pipes/currency-pen.pipe';
import { Order } from '../../../../core/models/order.model';
import { ReporteIncidencia, EstadoReclamo } from '../../../../core/models/feedback.model';
import { ResolverReclamoValues } from '../../models/admin-forms';
import { getMotivoLabel } from '../../shared/admin-format.util';

/**
 * Modal para revisar y atender un reclamo. Presentacional: el formulario reactivo es solo el
 * borrador local; al confirmar emite los valores y el contenedor llama al backend.
 */
@Component({
  selector: 'app-claim-resolution-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, CurrencyPENPipe],
  template: `
      @if (reclamo(); as reclamo) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div class="w-full max-w-2xl bg-[#14161a] border border-rose-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 text-slate-100 animate-scale-up max-h-[90vh] overflow-y-auto no-scrollbar">
            
            <!-- Modal Header -->
            <div class="flex justify-between items-start border-b border-white/10 pb-4">
              <div>
                <div class="flex items-center gap-2">
                  <span class="px-2.5 py-0.5 rounded-lg bg-rose-500/20 text-rose-400 font-mono text-xs font-bold border border-rose-500/30">
                    REC-{{ reclamo.id }}
                  </span>
                  <span class="text-xs font-bold text-slate-300">Orden asociada #{{ reclamo.ordenId }}</span>
                  <span class="text-[11px] text-slate-500 font-mono">
                    • {{ reclamo.creadoEn | date:'dd/MM/yyyy HH:mm' }}
                  </span>
                </div>
                <h3 class="font-display text-2xl font-black text-white mt-1">
                  Atención del Libro de Reclamaciones
                </h3>
                @if (getClienteDeOrden(reclamo.ordenId); as cli) {
                  <p class="text-xs text-slate-300 mt-1 flex items-center gap-2">
                    <span class="text-polleria-gold font-bold">👤 Cliente Afectado:</span>
                    <strong class="text-white">{{ cli.nombre }}</strong>
                    @if (cli.celular) {
                      <span class="text-slate-400 font-mono">| Tel: {{ cli.celular }}</span>
                    }
                    @if (cli.direccion) {
                      <span class="text-slate-400">| Dir: {{ cli.direccion }}</span>
                    }
                  </p>
                }
              </div>
              <button 
                type="button"
                (click)="closed.emit()" 
                class="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer" 
                aria-label="Cerrar"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <!-- Detalle del Reclamo & Evidencia Expandida -->
            <div class="space-y-4 text-xs">
              <div class="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-3">
                <div class="flex justify-between items-center">
                  <div>
                    <span class="text-slate-500 font-bold uppercase text-[10px] tracking-wider block">MOTIVO DECLARADO:</span>
                    <p class="text-rose-400 font-bold text-sm mt-0.5">{{ getMotivoLabel(reclamo.motivo) }}</p>
                  </div>
                  @if (reclamo.montoReclamado) {
                    <div class="text-right">
                      <span class="text-slate-500 font-bold uppercase text-[10px] tracking-wider block">MONTO SOLICITADO:</span>
                      <p class="text-polleria-gold font-bold text-sm font-mono mt-0.5">
                        {{ reclamo.montoReclamado | currencyPEN }}
                      </p>
                    </div>
                  }
                </div>

                <div>
                  <span class="text-slate-500 font-bold uppercase text-[10px] tracking-wider block">DESCRIPCIÓN DEL CLIENTE:</span>
                  <p class="text-slate-200 text-xs leading-relaxed mt-1 bg-black/30 p-3 rounded-xl border border-white/5 italic">
                    "{{ reclamo.descripcion }}"
                  </p>
                </div>

                <!-- Evidencia Fotográfica Expandida -->
                @if (reclamo.fotoEvidenciaUrl || reclamo.fotoUrl) {
                  <div>
                    <div class="flex justify-between items-center mb-1.5">
                      <span class="text-slate-400 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3"/></svg>
                        Evidencia Fotográfica Adjunta:
                      </span>
                      <button 
                        type="button"
                        (click)="photoRequested.emit(reclamo.fotoEvidenciaUrl || reclamo.fotoUrl)"
                        class="text-[11px] text-polleria-gold hover:underline font-bold cursor-pointer"
                      >
                        Ampliar foto ↗
                      </button>
                    </div>
                    <div class="rounded-2xl overflow-hidden border border-white/10 bg-black/60 max-h-72 flex items-center justify-center cursor-pointer" (click)="photoRequested.emit(reclamo.fotoEvidenciaUrl || reclamo.fotoUrl)">
                      <img 
                        [src]="fotoSrc()" 
                        alt="Evidencia del reclamo" 
                        class="w-full h-72 object-contain hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  </div>
                }
              </div>

              <!-- Formulario Reactivo de Resolución -->
              <form [formGroup]="resolucionForm" class="space-y-4 pt-1">
                
                <!-- Select Estado Final -->
                <div>
                  <label class="block font-bold text-slate-300 mb-1">
                    Decisión Administrativa (Estado Final): <span class="text-rose-400">*</span>
                  </label>
                  <select 
                    formControlName="estadoFinal"
                    class="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-rose-400 font-bold"
                  >
                    <option value="RESUELTO">RESUELTO (Reclamo Procedente / Aceptado)</option>
                    <option value="RECHAZADO">RECHAZADO (Reclamo No Procedente)</option>
                  </select>
                </div>

                <!-- Textarea Respuesta Obligatoria -->
                <div>
                  <div class="flex justify-between items-center mb-1">
                    <label class="block font-bold text-slate-300">
                      Respuesta al Cliente (Obligatoria): <span class="text-rose-400">*</span>
                    </label>
                    <span class="text-[10px] text-slate-400 font-mono">Mínimo 5 caracteres</span>
                  </div>
                  <textarea 
                    formControlName="respuestaAdmin"
                    rows="3"
                    placeholder="Detalla la resolución oficial y la respuesta que se notificará al cliente..."
                    class="w-full p-3 rounded-xl bg-black/50 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-400 resize-none"
                  ></textarea>
                </div>

                <!-- Toggle / Checkbox Reembolso -->
                <div class="space-y-3">
                  <div class="flex items-center justify-between p-3.5 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                    <div>
                      <span class="text-xs text-rose-300 font-bold block">¿Emitir Reembolso Automático?</span>
                      <span class="text-[11px] text-slate-400">Ejecuta el reembolso de fondos hacia la pasarela de pagos / caja.</span>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        formControlName="emitirReembolso"
                        class="sr-only peer"
                      />
                      <div class="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                    </label>
                  </div>

                  <!-- Input Monto de Reembolso (Obligatorio si toggle activo) -->
                  @if (resolucionForm.get('emitirReembolso')?.value) {
                    <div class="p-3.5 bg-black/40 rounded-2xl border border-white/10 space-y-1.5 animate-fade-in">
                      <label class="block font-bold text-slate-300">
                        Monto a Reembolsar (S/): <span class="text-rose-400">*</span>
                      </label>
                      <input 
                        type="number" 
                        formControlName="montoReembolso"
                        step="0.50"
                        min="0.10"
                        placeholder="15.00"
                        class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono text-sm focus:outline-none focus:ring-1 focus:ring-rose-400"
                      />
                      <p class="text-[10px] text-amber-300">
                        Se enviará la solicitud de reembolso con Idempotency-Key a payments-service (:8083).
                      </p>
                    </div>
                  }
                </div>

              </form>
            </div>

            <!-- Footer con Botón "Confirmar Resolución" y Spinner -->
            <div class="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button 
                type="button"
                (click)="closed.emit()" 
                [disabled]="isResolviendoReclamo()"
                class="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold cursor-pointer transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button 
                type="button"
                (click)="confirmar()" 
                [disabled]="!isFormResolucionValido() || isResolviendoReclamo()"
                class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold uppercase transition shadow-lg shadow-rose-900/30 flex items-center gap-2 cursor-pointer"
              >
                @if (isResolviendoReclamo()) {
                  <svg class="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>Procesando...</span>
                } @else {
                  <span>Confirmar Resolución</span>
                }
              </button>
            </div>

          </div>
        </div>
      }
  `
})
export class ClaimResolutionModalComponent implements OnInit {
  readonly reclamo = input.required<ReporteIncidencia>();
  /** Órdenes activas: permiten mostrar el cliente afectado. */
  readonly ordenes = input.required<Order[]>();
  /** URL ya resuelta de la foto de evidencia (la resuelve el contenedor). */
  readonly fotoSrc = input.required<string>();
  readonly isResolviendoReclamo = input.required<boolean>();

  readonly closed = output<void>();
  readonly photoRequested = output<string | undefined>();
  readonly confirmed = output<ResolverReclamoValues>();

  protected readonly getMotivoLabel = getMotivoLabel;

  protected readonly resolucionForm = new FormGroup({
    estadoFinal: new FormControl<EstadoReclamo | null>('RESUELTO', [Validators.required]),
    respuestaAdmin: new FormControl<string | null>('', [Validators.required, Validators.minLength(5)]),
    emitirReembolso: new FormControl<boolean | null>(false),
    montoReembolso: new FormControl<number | null>(15.00)
  });

  ngOnInit(): void {
    const rec = this.reclamo();
    this.resolucionForm.reset({
      estadoFinal: 'RESUELTO',
      respuestaAdmin: rec.respuestaAdmin || 'Se verificó la orden y se procede con la atención y solución correspondiente.',
      emitirReembolso: rec.reembolsoProcedente ?? false,
      montoReembolso: rec.montoReclamado || 15.00
    });
  }

  protected getClienteDeOrden(ordenId: number): Order['cliente'] | null {
    if (!ordenId) return null;
    const orden = this.ordenes().find(o => Number(o.id) === Number(ordenId));
    return orden?.cliente || null;
  }

  protected isFormResolucionValido(): boolean {
    if (this.resolucionForm.invalid) return false;
    const vals = this.resolucionForm.value;
    if (!vals.respuestaAdmin || vals.respuestaAdmin.trim().length < 5) return false;
    if (vals.emitirReembolso && (!vals.montoReembolso || vals.montoReembolso <= 0)) return false;
    return true;
  }

  protected confirmar(): void {
    if (!this.isFormResolucionValido() || this.isResolviendoReclamo()) return;
    this.confirmed.emit(this.resolucionForm.getRawValue());
  }
}
