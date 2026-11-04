import { ChangeDetectionStrategy, Component, effect, input, output, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AjustesWhatsapp, GobernadorWhatsapp } from '../../../../core/services/whatsapp-notifications.service';
import { AjustesWhatsappForm } from '../../models/admin-forms';
import {
  etiquetaEstadoBreaker,
  etiquetaMotivoPausa,
  formatearDuracionMs,
  porcentajePresupuesto
} from '../../shared/admin-format.util';

/**
 * Anti-baneo y contactos de WhatsApp. Presentacional: el formulario es un borrador local que se
 * sincroniza con los ajustes vigentes; al guardar emite el borrador y el contenedor manda solo lo que cambió.
 */
@Component({
  selector: 'app-whatsapp-settings-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
          <div class="bg-[#14161a] rounded-2xl border border-white/10 shadow-xl p-5 space-y-5">
            <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <h3 class="text-lg font-bold text-white flex items-center gap-2">
                  <span>Anti-baneo y contactos</span>
                  <span class="text-[10px] font-bold uppercase tracking-wider text-amber-300 px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20">
                    Solo ADMIN
                  </span>
                </h3>
                <p class="text-xs text-slate-400">Delay, humanización, presupuesto, ventana horaria, breaker y números de contacto del servicio WhatsApp.</p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  (click)="refreshRequested.emit()"
                  [disabled]="ajustesCargando()"
                  class="px-3 py-2 bg-white/10 hover:bg-white/15 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  {{ ajustesCargando() ? 'Actualizando...' : 'Refrescar' }}
                </button>
                <button
                  type="button"
                  (click)="saveRequested.emit(ajustesForm)"
                  [disabled]="guardandoAjustes() || !ajustes()"
                  class="px-4 py-2 bg-polleria-gold hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  {{ guardandoAjustes() ? 'Guardando...' : 'Guardar cambios' }}
                </button>
              </div>
            </div>

            <!-- S8: los ajustes viven en memoria, se pierden al reiniciar el servicio -->
            <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2" role="note">
              <svg class="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              <span>Estos ajustes viven <strong>en memoria</strong> del notification-service: se aplican en caliente, pero <strong>se pierden al reiniciar el servicio</strong> y vuelven a los valores por defecto del entorno (S8). No son persistentes.</span>
            </div>

            @if (ajustesError()) {
              <div class="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs" role="alert">
                {{ ajustesError() }}
              </div>
            }

            @if (ajustes()) {
              <!-- Estado del gobernador anti-baneo (viene en el mismo GET /ajustes) -->
              @if (gobernador(); as gob) {
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                  <div class="p-3 rounded-xl border" [ngClass]="gob.pausada ? 'bg-rose-500/10 border-rose-500/30' : 'bg-emerald-500/10 border-emerald-500/30'">
                    <p class="text-[10px] uppercase tracking-wider font-bold text-slate-400">Gobernador</p>
                    <p class="mt-1 text-base font-bold" [ngClass]="gob.pausada ? 'text-rose-300' : 'text-emerald-300'">
                      {{ gob.pausada ? 'PAUSADO' : 'Enviando' }}
                    </p>
                    @if (gob.pausada) {
                      <p class="text-[11px] text-rose-200 mt-0.5">{{ etiquetaMotivoPausa(gob.motivo) }}</p>
                      @if (gob.detalle) {
                        <p class="text-[11px] text-slate-400 mt-0.5">{{ gob.detalle }}</p>
                      }
                    }
                  </div>

                  <div class="p-3 rounded-xl bg-black/30 border border-white/10">
                    <p class="text-[10px] uppercase tracking-wider font-bold text-slate-400">Presupuesto por hora</p>
                    <p class="mt-1 font-mono font-bold text-white">{{ gob.presupuestoHora.enviados }} / {{ gob.presupuestoHora.limite }}</p>
                    <div class="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div class="h-full bg-polleria-gold" [style.width.%]="porcentajePresupuesto(gob.presupuestoHora.enviados, gob.presupuestoHora.limite)"></div>
                    </div>
                  </div>

                  <div class="p-3 rounded-xl bg-black/30 border border-white/10">
                    <p class="text-[10px] uppercase tracking-wider font-bold text-slate-400">Presupuesto del día</p>
                    <p class="mt-1 font-mono font-bold text-white">{{ gob.presupuestoDia.enviados }} / {{ gob.presupuestoDia.limite }}</p>
                    <div class="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div class="h-full bg-sky-400" [style.width.%]="porcentajePresupuesto(gob.presupuestoDia.enviados, gob.presupuestoDia.limite)"></div>
                    </div>
                  </div>

                  <div class="p-3 rounded-xl bg-black/30 border border-white/10">
                    <p class="text-[10px] uppercase tracking-wider font-bold text-slate-400">Ventana horaria</p>
                    <p class="mt-1 font-bold" [ngClass]="gob.ventana.abierta ? 'text-emerald-300' : 'text-amber-300'">
                      {{ gob.ventana.abierta ? 'Abierta' : 'Cerrada' }}
                    </p>
                    <p class="text-[11px] text-slate-400 mt-0.5">{{ gob.ventana.operativoTodoElDia ? 'Operación continua (24/7)' : gob.ventana.horaDesde + ':00 – ' + gob.ventana.horaHasta + ':00 (hora de Lima)' }}</p>
                  </div>

                  <div class="p-3 rounded-xl bg-black/30 border border-white/10">
                    <p class="text-[10px] uppercase tracking-wider font-bold text-slate-400">Circuit breaker</p>
                    <p class="mt-1 font-bold" [ngClass]="gob.breaker.estado === 'cerrado' ? 'text-emerald-300' : 'text-rose-300'">
                      {{ etiquetaEstadoBreaker(gob.breaker.estado) }}
                    </p>
                    @if (gob.breaker.senal) {
                      <p class="text-[11px] text-rose-200 mt-0.5">Señal: {{ gob.breaker.senal }}</p>
                    }
                    @if (gob.breaker.estado === 'abierto') {
                      <p class="text-[11px] text-slate-400 mt-0.5">Reintento en {{ formatearDuracionMs(gob.breaker.reintentoEn) }}</p>
                    } @else {
                      <p class="text-[11px] text-slate-400 mt-0.5">Aperturas: {{ gob.breaker.aperturas }}</p>
                    }
                  </div>
                </div>
              }

              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-amber-400/20 bg-amber-400/5">
                <div>
                  <p class="text-sm font-bold text-white">Operación todo el día</p>
                  <p class="text-xs text-slate-400 mt-1">Al activarlo, se omite únicamente la ventana horaria; se mantienen límites y protección anti-baneo. Se desactiva al reiniciar notification-service.</p>
                </div>
                <button type="button" (click)="toggle24hRequested.emit()"
                  [disabled]="guardandoAjustes() || !ajustes()"
                  class="px-4 py-2 rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                  [ngClass]="ajustes()?.operativoTodoElDia ? 'bg-rose-500/20 text-rose-200 border border-rose-400/30' : 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'">
                  {{ ajustes()?.operativoTodoElDia ? 'Desactivar 24/7' : 'Activar 24/7' }}
                </button>
              </div>

              <!-- Parámetros anti-baneo (borrador local; se manda solo lo cambiado) -->
              <div class="space-y-3">
                <p class="text-[11px] uppercase tracking-wider font-bold text-slate-400">Parámetros anti-baneo</p>
                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  <label class="flex flex-col gap-1 text-[11px] text-slate-400 font-bold uppercase">
                    Delay base (ms)
                    <input type="number" min="0" [(ngModel)]="ajustesForm.intervaloMs"
                      class="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs normal-case font-normal" />
                  </label>
                  <label class="flex flex-col gap-1 text-[11px] text-slate-400 font-bold uppercase">
                    Jitter (%)
                    <input type="number" min="0" max="100" [(ngModel)]="ajustesForm.jitterPct"
                      class="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs normal-case font-normal" />
                  </label>
                  <label class="flex flex-col gap-1 text-[11px] text-slate-400 font-bold uppercase">
                    Typing mínimo (ms)
                    <input type="number" min="0" [(ngModel)]="ajustesForm.typingMinMs"
                      class="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs normal-case font-normal" />
                  </label>
                  <label class="flex flex-col gap-1 text-[11px] text-slate-400 font-bold uppercase">
                    Typing máximo (ms)
                    <input type="number" min="0" [(ngModel)]="ajustesForm.typingMaxMs"
                      class="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs normal-case font-normal" />
                  </label>
                  <label class="flex flex-col gap-1 text-[11px] text-slate-400 font-bold uppercase">
                    Typing por carácter (ms)
                    <input type="number" min="0" [(ngModel)]="ajustesForm.typingMsPorCaracter"
                      class="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs normal-case font-normal" />
                  </label>
                  <label class="flex flex-col gap-1 text-[11px] text-slate-400 font-bold uppercase">
                    Presupuesto por hora
                    <input type="number" min="1" [(ngModel)]="ajustesForm.presupuestoHora"
                      class="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs normal-case font-normal" />
                  </label>
                  <label class="flex flex-col gap-1 text-[11px] text-slate-400 font-bold uppercase">
                    Presupuesto por día
                    <input type="number" min="1" [(ngModel)]="ajustesForm.presupuestoDia"
                      class="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs normal-case font-normal" />
                  </label>
                  <label class="flex flex-col gap-1 text-[11px] text-slate-400 font-bold uppercase">
                    Hora desde (0-23)
                    <input type="number" min="0" max="23" [(ngModel)]="ajustesForm.horaDesde"
                      class="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs normal-case font-normal" />
                  </label>
                  <label class="flex flex-col gap-1 text-[11px] text-slate-400 font-bold uppercase">
                    Hora hasta (0-23)
                    <input type="number" min="0" max="23" [(ngModel)]="ajustesForm.horaHasta"
                      class="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs normal-case font-normal" />
                  </label>
                  <label class="flex flex-col gap-1 text-[11px] text-slate-400 font-bold uppercase">
                    Breaker base (ms)
                    <input type="number" min="1" [(ngModel)]="ajustesForm.breakerBaseMs"
                      class="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs normal-case font-normal" />
                  </label>
                  <label class="flex flex-col gap-1 text-[11px] text-slate-400 font-bold uppercase">
                    Breaker máximo (ms)
                    <input type="number" min="1" [(ngModel)]="ajustesForm.breakerMaxMs"
                      class="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs normal-case font-normal" />
                  </label>
                </div>
              </div>

              <!-- Contactos del bot (S11/S13) -->
              <div class="space-y-3">
                <p class="text-[11px] uppercase tracking-wider font-bold text-slate-400">Contactos para el bot</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label class="flex flex-col gap-1 text-[11px] text-slate-400 font-bold uppercase">
                    Celular del asesor
                    <input type="text" [(ngModel)]="ajustesForm.numeroAsesor" placeholder="51999888777"
                      class="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs normal-case font-normal" />
                    <span class="text-[10px] text-slate-500 normal-case font-normal">Número del admin que conecta WhatsApp; se normaliza a 51 + 9 dígitos.</span>
                  </label>
                  <label class="flex flex-col gap-1 text-[11px] text-slate-400 font-bold uppercase">
                    Celular de respaldo (opcional)
                    <input type="text" [(ngModel)]="ajustesForm.numeroRespaldo" placeholder="Vacío = sin respaldo"
                      class="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs normal-case font-normal" />
                    <span class="text-[10px] text-slate-500 normal-case font-normal">Se usa si el número principal cae o queda bloqueado (S11). Puede quedar vacío.</span>
                  </label>
                  <label class="flex flex-col gap-1 text-[11px] text-slate-400 font-bold uppercase">
                    Yape de la pollería
                    <input type="text" [(ngModel)]="ajustesForm.numeroYape" placeholder="+51 934 421 442"
                      class="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs normal-case font-normal" />
                    <span class="text-[10px] text-slate-500 normal-case font-normal">Número al que el cliente paga por Yape: el bot se lo indica al cerrar el pedido (T6f).</span>
                  </label>
                </div>
              </div>
            } @else if (ajustesCargando()) {
              <p class="text-xs text-slate-500">Cargando ajustes del anti-baneo...</p>
            } @else {
              <p class="text-xs text-slate-500">No se pudieron cargar los ajustes. Usa "Refrescar" para reintentar.</p>
            }
          </div>
  `
})
export class WhatsappSettingsPanelComponent {
  readonly ajustes = input.required<AjustesWhatsapp | null>();
  readonly gobernador = input.required<GobernadorWhatsapp | null>();
  readonly ajustesCargando = input.required<boolean>();
  readonly guardandoAjustes = input.required<boolean>();
  readonly ajustesError = input.required<string | null>();

  readonly refreshRequested = output<void>();
  readonly saveRequested = output<AjustesWhatsappForm>();
  readonly toggle24hRequested = output<void>();

  protected readonly etiquetaEstadoBreaker = etiquetaEstadoBreaker;
  protected readonly etiquetaMotivoPausa = etiquetaMotivoPausa;
  protected readonly formatearDuracionMs = formatearDuracionMs;
  protected readonly porcentajePresupuesto = porcentajePresupuesto;

  // T5b (S4/S8/S11) — formulario editable de la sección "Anti-baneo y contactos".
  // Es un borrador local: el contenedor manda al backend SOLO lo que cambió.
  protected ajustesForm: AjustesWhatsappForm = {
    intervaloMs: 10000,
    jitterPct: 20,
    typingMinMs: 1000,
    typingMaxMs: 6000,
    typingMsPorCaracter: 50,
    presupuestoHora: 40,
    presupuestoDia: 500,
    horaDesde: 11,
    horaHasta: 23,
    breakerBaseMs: 60000,
    breakerMaxMs: 900000,
    numeroAsesor: '',
    numeroRespaldo: '',
    numeroYape: ''
  };

  /** Refleja en el formulario los ajustes vigentes cada vez que el servicio los carga o guarda. */
  private readonly sincronizarAjustesForm = effect(() => {
    const ajustes = this.ajustes();
    if (!ajustes) return;
    untracked(() => {
      this.ajustesForm = {
        intervaloMs: ajustes.intervaloMs,
        jitterPct: ajustes.jitterPct,
        typingMinMs: ajustes.typingMinMs,
        typingMaxMs: ajustes.typingMaxMs,
        typingMsPorCaracter: ajustes.typingMsPorCaracter,
        presupuestoHora: ajustes.presupuestoHora,
        presupuestoDia: ajustes.presupuestoDia,
        horaDesde: ajustes.horaDesde,
        horaHasta: ajustes.horaHasta,
        breakerBaseMs: ajustes.breakerBaseMs,
        breakerMaxMs: ajustes.breakerMaxMs,
        numeroAsesor: ajustes.numeroAsesor ?? '',
        numeroRespaldo: ajustes.numeroRespaldo ?? '',
        numeroYape: ajustes.numeroYape ?? ''
      };
    });
  });
}
