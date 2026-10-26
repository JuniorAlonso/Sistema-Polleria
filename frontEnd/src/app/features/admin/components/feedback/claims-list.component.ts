import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyPENPipe } from '../../../../shared/pipes/currency-pen.pipe';
import { Order } from '../../../../core/models/order.model';
import { ReporteIncidencia } from '../../../../core/models/feedback.model';
import { getMotivoLabel } from '../../shared/admin-format.util';

/** Libro de reclamaciones. Presentacional: toda acción sale como evento. */
@Component({
  selector: 'app-claims-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CurrencyPENPipe],
  template: `
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="font-display text-lg text-white font-bold flex items-center gap-2">
                <span>Libro de Reclamaciones</span>
                
              </h3>
              <span class="text-xs text-slate-400 font-mono">
                Total: {{ reportesReclamos().length }} reclamos
              </span>
            </div>

            @if (reportesReclamos().length === 0) {
              <div class="p-8 rounded-2xl bg-[#14161a] border border-white/10 text-center text-slate-400 space-y-2">
                <p class="text-sm font-semibold text-slate-300">No hay reclamos registrados</p>
                <p class="text-xs">Los reclamos enviados por los clientes aparecerán aquí automáticamente en tiempo real.</p>
              </div>
            } @else {
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                @for (rec of reportesReclamos(); track rec.id) {
                  <div 
                    class="p-5 rounded-2xl bg-[#14161a] border space-y-3 flex flex-col justify-between transition-all duration-300 hover:border-white/20 relative overflow-hidden"
                    [ngClass]="rec.esNuevo ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30 animate-fade-in' : 'border-white/10'"
                  >
                    <!-- Header Card -->
                    <div>
                      <div class="flex justify-between items-start gap-2">
                        <div>
                          <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-mono text-xs px-2 py-0.5 rounded bg-white/10 text-polleria-gold font-bold">
                              REC-{{ rec.id }}
                            </span>
                            <span class="text-xs font-bold text-white">Orden #{{ rec.ordenId }}</span>

                            @if (rec.esNuevo) {
                              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.4)]">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                NUEVO
                              </span>
                            }

                            @if (rec.fotoEvidenciaUrl || rec.fotoUrl) {
                              <button 
                                type="button"
                                (click)="photoRequested.emit(rec.fotoEvidenciaUrl || rec.fotoUrl)"
                                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold hover:bg-amber-500/30 transition cursor-pointer"
                                title="Click para ver la foto de evidencia"
                              >
                                <svg class="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3"/></svg>
                                <span>VER FOTO</span>
                              </button>
                            }
                          </div>

                          <!-- Subtítulo con Cliente Afectado -->
                          @if (getClienteDeOrden(rec.ordenId); as cli) {
                            <div class="mt-1 flex items-center gap-2 text-xs text-slate-300 font-medium">
                              <span class="text-polleria-gold">👤</span>
                              <strong class="text-white">{{ cli.nombre }}</strong>
                              @if (cli.celular) {
                                <span class="text-slate-400 font-mono text-[11px]">({{ cli.celular }})</span>
                              }
                              @if (cli.direccion) {
                                <span class="text-slate-400 text-[11px] truncate max-w-[200px]" [title]="cli.direccion">• {{ cli.direccion }}</span>
                              }
                            </div>
                          } @else {
                            <div class="mt-1 text-[11px] text-slate-400 italic">
                              👤 Cliente de Orden #{{ rec.ordenId }}
                            </div>
                          }
                          
                          <p class="text-xs text-rose-400 font-semibold mt-1">
                            Motivo: <strong class="text-rose-300">{{ getMotivoLabel(rec.motivo) }}</strong>
                          </p>

                          <div class="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5">
                            <svg class="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            <span>{{ rec.creadoEn | date:'dd/MM/yyyy HH:mm' }}</span>
                          </div>
                        </div>

                        <span 
                          class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0"
                          [ngClass]="{
                            'bg-amber-500/20 text-amber-300 border border-amber-500/30': rec.estado === 'PENDIENTE' || rec.estado === 'ABIERTO' || rec.estado === 'EN_REVISION',
                            'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30': rec.estado === 'RESUELTO',
                            'bg-rose-500/20 text-rose-400 border border-rose-500/30': rec.estado === 'RECHAZADO'
                          }"
                        >
                          {{ rec.estado }}
                        </span>
                      </div>

                      <p class="text-xs text-slate-300 leading-relaxed mt-2.5 bg-black/30 p-3 rounded-xl border border-white/5">
                        "{{ rec.descripcion }}"
                      </p>

                      @if (rec.montoReclamado) {
                        <p class="text-xs text-polleria-gold font-bold mt-2">
                          Monto Reclamado: {{ rec.montoReclamado | currencyPEN }}
                        </p>
                      }

                      <!-- Resumen de Resolución si está RESUELTO -->
                      @if (rec.estado === 'RESUELTO') {
                        <div class="mt-3 text-xs bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl text-emerald-300 space-y-1">
                          <div class="flex items-center justify-between font-bold text-emerald-400">
                            <span class="flex items-center gap-1.5">
                              <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                              Reclamo Atendido
                            </span>
                            @if (rec.reembolsoProcedente && rec.montoReembolso) {
                              <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Reembolso: {{ rec.montoReembolso | currencyPEN }}
                              </span>
                            }
                          </div>
                          <p class="text-slate-300 text-[11px] italic">
                            "{{ rec.respuestaAdmin || rec.resolucion || 'Reclamo resuelto satisfactoriamente.' }}"
                          </p>
                          @if (rec.resueltoEn) {
                            <p class="text-[10px] text-slate-400 font-mono text-right pt-0.5">
                              Resuelto el: {{ rec.resueltoEn | date:'dd/MM/yyyy HH:mm' }}
                            </p>
                          }
                        </div>
                      }

                      <!-- Resumen de Rechazo si está RECHAZADO -->
                      @if (rec.estado === 'RECHAZADO') {
                        <div class="mt-3 text-xs bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl text-rose-300 space-y-1">
                          <div class="flex items-center gap-1.5 font-bold text-rose-400">
                            <svg class="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                            <span>Reclamo No Procedente</span>
                          </div>
                          <p class="text-slate-300 text-[11px] italic">
                            "{{ rec.respuestaAdmin || rec.resolucion || 'El reclamo no procede según las políticas de atención.' }}"
                          </p>
                        </div>
                      }
                    </div>

                    <!-- Botón Principal "Revisar y Atender" (Oculto si RESUELTO) -->
                    @if (rec.estado !== 'RESUELTO') {
                      <div class="pt-3 border-t border-white/10 flex justify-end">
                        <button 
                          type="button"
                          (click)="resolveRequested.emit(rec)"
                          class="px-4 py-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-rose-900/30 flex items-center gap-2 cursor-pointer active:scale-95"
                        >
                          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
                          <span>Revisar y Atender</span>
                        </button>
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </div>
  `
})
export class ClaimsListComponent {
  readonly reportesReclamos = input.required<ReporteIncidencia[]>();
  /** Órdenes activas: permiten mostrar el cliente afectado de cada reclamo. */
  readonly ordenes = input.required<Order[]>();

  readonly photoRequested = output<string | undefined>();
  readonly resolveRequested = output<ReporteIncidencia>();

  protected readonly getMotivoLabel = getMotivoLabel;

  protected getClienteDeOrden(ordenId: number): Order['cliente'] | null {
    if (!ordenId) return null;
    const orden = this.ordenes().find(o => Number(o.id) === Number(ordenId));
    return orden?.cliente || null;
  }
}
