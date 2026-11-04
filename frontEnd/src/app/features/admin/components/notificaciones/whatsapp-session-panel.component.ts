import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AjustesWhatsapp } from '../../../../core/services/whatsapp-notifications.service';
import { WhatsappQr, WhatsappStatus } from '../../../../core/models/notification-log.model';

/** Estado de la sesión de WhatsApp: cabecera, aviso de desconexión, totales y vínculo por QR. Presentacional. */
@Component({
  selector: 'app-whatsapp-session-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#14161a] p-4 rounded-2xl border border-white/10 shadow-lg">
            <div>
              <h2 class="text-2xl font-bold text-white flex items-center gap-2">
                <span>Monitor de Notificaciones & WhatsApp</span>
                <span class="text-[11px] font-normal text-emerald-400 px-2.5 py-0.5 rounded-full bg-emerald-400/10 border border-emerald-400/20">
                  Fase 3 - En Vivo
                </span>
              </h2>
              <p class="text-xs text-slate-400">Historial de envíos (RF32) con cola de 10s entre mensajes (RNF10) en notification-service (:3001).</p>
            </div>

            <button
              (click)="refreshRequested.emit()"
              [disabled]="isLoading()"
              class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition cursor-pointer"
            >
              {{ isLoading() ? 'Actualizando...' : 'Actualizar' }}
            </button>
          </div>

          <!-- Estado de la sesión y totales -->
          <!-- T9 (S11): si el canal no está conectado, quien atiende tiene que verlo acá y saber qué hacer. -->
          @if (status()?.whatsapp && status()?.whatsapp !== 'connected') {
            <div class="p-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 text-amber-200 text-xs space-y-1.5" role="alert">
              <p class="font-bold uppercase tracking-wider">
                ⚠️ El canal de WhatsApp no está conectado ({{ etiquetaSesionWhatsapp() }})
              </p>
              <p>
                Mientras siga así <strong>no se pueden recibir ni enviar mensajes por el chat</strong>: los pedidos
                nuevos tienen que entrar por el checkout web y las consultas atenderse por teléfono.
              </p>
              <p>
                Si el número quedó bloqueado, publicá el número de respaldo
                <strong>{{ ajustes()?.numeroRespaldo || 'sin respaldo configurado' }}</strong>
                y volvé a vincular la sesión escaneando el QR.
              </p>
            </div>
          }

          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-[#14161a] p-4 rounded-2xl border border-white/10">
              <p class="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Sesión WhatsApp</p>
              <p class="mt-1 text-lg font-bold" [ngClass]="status()?.whatsapp === 'connected' ? 'text-emerald-400' : 'text-amber-300'">
                {{ etiquetaSesionWhatsapp() }}
              </p>
              <p class="text-[11px] text-slate-500">En cola ahora: {{ status()?.colaPendiente ?? '-' }}</p>
            </div>
            <div class="bg-[#14161a] p-4 rounded-2xl border border-white/10">
              <p class="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Enviados</p>
              <p class="mt-1 text-2xl font-bold text-emerald-400">{{ totales().enviados }}</p>
            </div>
            <div class="bg-[#14161a] p-4 rounded-2xl border border-white/10">
              <p class="text-[11px] uppercase tracking-wider text-slate-400 font-bold">En cola</p>
              <p class="mt-1 text-2xl font-bold text-amber-300">{{ totales().enCola }}</p>
            </div>
            <div class="bg-[#14161a] p-4 rounded-2xl border border-white/10">
              <p class="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Con error</p>
              <p class="mt-1 text-2xl font-bold text-red-400">{{ totales().errores }}</p>
            </div>
          </div>

          <!-- Vincular WhatsApp: QR visible solo para ADMIN cuando no hay sesión -->
          @if (status()?.whatsapp !== 'connected') {
            @if (qr() ?? { whatsapp: 'starting', qr: null }; as estadoQr) {
              <div class="bg-[#14161a] p-6 rounded-2xl border border-amber-400/30 flex flex-col md:flex-row items-center gap-6">
                <div class="w-[220px] h-[220px] shrink-0 rounded-xl bg-white flex items-center justify-center overflow-hidden">
                  @if (estadoQr.qr) {
                    <img [src]="estadoQr.qr" alt="Código QR para vincular WhatsApp" class="w-full h-full" />
                  } @else if (qrError()) {
                    <span class="text-xs text-red-500 px-4 text-center">{{ qrError() }}</span>
                  } @else if (diagnostico()) {
                    <span class="text-xs text-red-500 px-4 text-center">
                      WhatsApp no pudo iniciar. Pulsa "Forzar nuevo QR" para reintentar.
                    </span>
                  } @else {
                    <div class="flex flex-col items-center gap-2 p-4 text-center">
                      <div class="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                      <span class="text-xs text-slate-500">Generando el código QR...</span>
                    </div>
                  }
                </div>
                <div class="space-y-3 text-sm flex-1">
                  <div class="flex items-center justify-between">
                    <h3 class="text-lg font-bold text-white">Vincula el WhatsApp de la pollería</h3>
                    <button
                      type="button"
                      (click)="restartRequested.emit()"
                      [disabled]="reiniciandoWhatsapp()"
                      class="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer">
                      @if (reiniciandoWhatsapp()) {
                        <span class="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></span>
                        <span>Reiniciando...</span>
                      } @else {
                        <span>🔄 Forzar nuevo QR</span>
                      }
                    </button>
                  </div>
                  <p class="text-slate-400 text-xs">
                    Los avisos a clientes no se enviarán hasta que se vincule un número. Escanea el código con el celular del negocio:
                  </p>
                  <ol class="list-decimal list-inside text-xs text-slate-300 space-y-1">
                    <li>Abre WhatsApp en el celular.</li>
                    <li>Toca Más opciones (⋮) o Configuración y entra a <strong>Dispositivos vinculados</strong>.</li>
                    <li>Toca <strong>Vincular un dispositivo</strong> y apunta la cámara a este código.</li>
                  </ol>
                  <p class="text-[11px] text-slate-500">El código cambia cada pocos segundos; esta vista se actualiza sola.</p>
                </div>
              </div>
            }
          }
  `
})
export class WhatsappSessionPanelComponent {
  readonly status = input.required<WhatsappStatus | null>();
  readonly ajustes = input.required<AjustesWhatsapp | null>();
  readonly totales = input.required<{ enviados: number; enCola: number; errores: number }>();
  readonly qr = input.required<WhatsappQr | null>();
  readonly qrError = input.required<string | null>();
  readonly diagnostico = input.required<string | null>();
  readonly isLoading = input.required<boolean>();
  readonly reiniciandoWhatsapp = input.required<boolean>();

  readonly refreshRequested = output<void>();
  readonly restartRequested = output<void>();

  protected etiquetaSesionWhatsapp(): string {
    const etiquetas: Record<string, string> = {
      connected: 'Conectado',
      waiting_qr: 'Esperando QR',
      starting: 'Iniciando',
      disconnected: 'Desconectado',
      auth_failure: 'Error de sesión',
      error_inicio: 'No pudo iniciar'
    };
    const status = this.status();
    return status ? (etiquetas[status.whatsapp] ?? status.whatsapp) : 'Sin conexión';
  }
}
