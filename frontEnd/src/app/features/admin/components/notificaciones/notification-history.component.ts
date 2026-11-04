import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EstadoNotificacion, NotificationLog } from '../../../../core/models/notification-log.model';
import { FiltroNotificaciones } from '../../models/admin-forms';
import { claseEstadoNotificacion, etiquetaTipoNotificacion } from '../../shared/admin-format.util';

/** Filtros e historial de notificaciones. Presentacional: los filtros son un borrador local que se emite al buscar. */
@Component({
  selector: 'app-notification-history',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
          <div class="flex flex-wrap items-end gap-3 bg-[#14161a] p-4 rounded-2xl border border-white/10">
            <label class="flex flex-col gap-1 text-[11px] text-slate-400 font-bold uppercase">
              N° Orden
              <input type="number" min="1" [(ngModel)]="filtroNotifOrdenId" placeholder="Todas"
                class="w-32 px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs normal-case font-normal" />
            </label>
            <label class="flex flex-col gap-1 text-[11px] text-slate-400 font-bold uppercase">
              Estado
              <select [(ngModel)]="filtroNotifEstado"
                class="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs normal-case font-normal">
                <option value="">Todos</option>
                <option value="EN_COLA">En cola</option>
                <option value="ENVIADO">Enviado</option>
                <option value="ERROR">Error</option>
              </select>
            </label>
            <label class="flex flex-col gap-1 text-[11px] text-slate-400 font-bold uppercase">
              Desde
              <input type="date" [(ngModel)]="filtroNotifDesde"
                class="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs normal-case font-normal" />
            </label>
            <button (click)="buscar()"
              class="px-4 py-2 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl transition cursor-pointer">
              Filtrar
            </button>
            <button (click)="limpiar()"
              class="px-4 py-2 text-slate-400 hover:text-white font-bold text-xs rounded-xl transition cursor-pointer">
              Limpiar
            </button>
          </div>

          @if (error()) {
            <div class="p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs">
              {{ error() }}
            </div>
          }

          <div class="bg-[#14161a] rounded-2xl border border-white/10 overflow-x-auto shadow-xl">
            <table class="w-full text-left text-xs">
              <thead class="bg-black/40 border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th class="p-4">ID</th>
                  <th class="p-4">Orden</th>
                  <th class="p-4">Destinatario</th>
                  <th class="p-4">Tipo</th>
                  <th class="p-4">Mensaje</th>
                  <th class="p-4 text-center">Intentos</th>
                  <th class="p-4">Creado / Enviado</th>
                  <th class="p-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5">
                @for (log of historial(); track log.id) {
                  <tr class="hover:bg-white/5 transition align-top">
                    <td class="p-4 text-slate-500 font-mono text-[11px]">{{ log.id }}</td>
                    <td class="p-4 font-bold text-white">{{ log.ordenId ? '#' + log.ordenId : '—' }}</td>
                    <td class="p-4 text-slate-300 font-mono">{{ log.destinatario }}</td>
                    <td class="p-4 text-slate-300">{{ etiquetaTipoNotificacion(log.tipo) }}</td>
                    <td class="p-4 text-slate-400 max-w-xs">
                      <p class="truncate" [title]="log.mensaje">{{ log.mensaje }}</p>
                      @if (log.errorDetalle) {
                        <p class="mt-1 text-red-400 text-[11px]">{{ log.errorDetalle }}</p>
                      }
                    </td>
                    <td class="p-4 text-center font-mono text-slate-300">{{ log.intentos }}</td>
                    <td class="p-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                      {{ log.creadoEn | date:'dd/MM HH:mm:ss' }}
                      @if (log.enviadoEn) {
                        <br /><span class="text-emerald-400">{{ log.enviadoEn | date:'dd/MM HH:mm:ss' }}</span>
                      }
                    </td>
                    <td class="p-4 text-center">
                      <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold" [ngClass]="claseEstadoNotificacion(log.estado)">
                        {{ log.estado }}
                      </span>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="8" class="p-8 text-center text-slate-500">
                      {{ isLoading() ? 'Cargando historial...' : 'No hay notificaciones registradas con estos filtros.' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
  `
})
export class NotificationHistoryComponent {
  readonly historial = input.required<NotificationLog[]>();
  readonly error = input.required<string | null>();
  readonly isLoading = input.required<boolean>();

  readonly searchRequested = output<FiltroNotificaciones>();

  protected readonly etiquetaTipoNotificacion = etiquetaTipoNotificacion;
  protected readonly claseEstadoNotificacion = claseEstadoNotificacion;

  // Notificaciones WhatsApp (RF30, RF31, RF32 - Fase 3)
  protected filtroNotifOrdenId: number | null = null;
  protected filtroNotifEstado: EstadoNotificacion | '' = '';
  protected filtroNotifDesde = '';

  protected buscar(): void {
    this.searchRequested.emit({
      ordenId: this.filtroNotifOrdenId,
      estado: this.filtroNotifEstado,
      desde: this.filtroNotifDesde
    });
  }

  protected limpiar(): void {
    this.filtroNotifOrdenId = null;
    this.filtroNotifEstado = '';
    this.filtroNotifDesde = '';
    this.buscar();
  }
}
