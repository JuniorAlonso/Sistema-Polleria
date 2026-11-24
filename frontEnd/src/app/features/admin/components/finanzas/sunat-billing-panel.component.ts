import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CurrencyPENPipe } from '../../../../shared/pipes/currency-pen.pipe';
import { BackendComprobanteResponse } from '../../../../core/models/api-contracts.model';
import { EnvioSunatResponse, EstadoSunat } from '../../../../core/api/facturacion-sunat-api.service';

export type FiltroEstadoSunat = 'TODOS' | 'SIN_ENVIAR' | 'ANULADO' | EstadoSunat;
export type FiltroTipoComprobante = 'TODOS' | 'BOLETA' | 'FACTURA';

interface FilaFacturacionSunat {
  ordenId: number;
  tipo: 'BOLETA' | 'FACTURA';
  serieNumero: string;
  clienteNombre: string;
  clienteDoc: string;
  total: number;
  anulado: boolean;
  emitidoEn: string | null;
  envio: EnvioSunatResponse | null;
  estadoSunat: 'SIN_ENVIAR' | 'ANULADO' | EstadoSunat;
}

/** Panel de gestión y monitoreo de envíos electrónicos a SUNAT para Admin Finanzas. */
@Component({
  selector: 'app-sunat-billing-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPENPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      @if (error(); as errMsg) {
        <div class="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex flex-wrap items-center justify-between gap-3">
          <p class="text-xs font-medium text-rose-200">{{ errMsg }}</p>
          <button
            type="button"
            (click)="refrescar.emit()"
            class="px-3 py-1.5 rounded-lg bg-rose-500/30 hover:bg-rose-500/40 text-xs font-bold text-white transition cursor-pointer"
          >
            Reintentar carga
          </button>
        </div>
      }

      <!-- KPIs SUNAT -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Comprobantes</span>
          <span class="font-display text-2xl font-bold text-white">{{ kpis().total }}</span>
        </div>
        <div class="p-4 rounded-2xl bg-[#14161a] border border-emerald-500/20">
          <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">Aceptados SUNAT</span>
          <span class="font-display text-2xl font-bold text-emerald-400">{{ kpis().aceptados }}</span>
        </div>
        <div class="p-4 rounded-2xl bg-[#14161a] border border-amber-500/20">
          <span class="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">Sin Enviar / Observados</span>
          <span class="font-display text-2xl font-bold text-amber-400">{{ kpis().pendientesOObservados }}</span>
        </div>
        <div class="p-4 rounded-2xl bg-[#14161a] border border-rose-500/20">
          <span class="text-[10px] font-bold uppercase tracking-wider text-rose-400 block">Rechazados / Error</span>
          <span class="font-display text-2xl font-bold text-rose-400">{{ kpis().conError }}</span>
        </div>
      </div>

      <!-- Filtros y tabla -->
      <div class="bg-[#14161a] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
        <div class="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="font-bold text-sm text-white uppercase tracking-wider">
              Comprobantes y Envíos a SUNAT
            </h3>
            <p class="text-xs text-slate-400">
              Envía comprobantes emitidos, consulta CDRs y descarga XMLs firmados
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <input
              type="text"
              [ngModel]="busqueda()"
              (ngModelChange)="busqueda.set($event)"
              placeholder="Buscar serie, orden o cliente..."
              class="px-3 py-1.5 rounded-lg bg-[#0d0e11] border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-polleria-gold"
            />
            <select
              [ngModel]="filtroTipo()"
              (ngModelChange)="filtroTipo.set($event)"
              class="px-2.5 py-1.5 rounded-lg bg-[#0d0e11] [color-scheme:dark] border border-white/10 text-xs text-white focus:outline-none focus:border-polleria-gold"
            >
              <option class="bg-[#14161a] text-white" value="TODOS">Todos los tipos</option>
              <option class="bg-[#14161a] text-white" value="FACTURA">Facturas</option>
              <option class="bg-[#14161a] text-white" value="BOLETA">Boletas</option>
            </select>
            <select
              [ngModel]="filtroEstado()"
              (ngModelChange)="filtroEstado.set($event)"
              class="px-2.5 py-1.5 rounded-lg bg-[#0d0e11] [color-scheme:dark] border border-white/10 text-xs text-white focus:outline-none focus:border-polleria-gold"
            >
              <option class="bg-[#14161a] text-white" value="TODOS">Todos los estados</option>
              <option class="bg-[#14161a] text-white" value="SIN_ENVIAR">Sin enviar</option>
              <option class="bg-[#14161a] text-white" value="ACEPTADO">ACEPTADO</option>
              <option class="bg-[#14161a] text-white" value="OBSERVADO">OBSERVADO</option>
              <option class="bg-[#14161a] text-white" value="RECHAZADO">RECHAZADO</option>
              <option class="bg-[#14161a] text-white" value="ERROR">ERROR</option>
              <option class="bg-[#14161a] text-white" value="ENVIANDO">ENVIANDO</option>
              <option class="bg-[#14161a] text-white" value="ANULADO">Anulados</option>
            </select>
            <button
              type="button"
              [disabled]="cargando()"
              (click)="refrescar.emit()"
              class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 text-xs font-bold text-white transition cursor-pointer"
            >
              {{ cargando() ? 'Actualizando...' : 'Actualizar' }}
            </button>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-black/40 border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th class="p-3">Serie-Número</th>
                <th class="p-3">Orden</th>
                <th class="p-3">Cliente</th>
                <th class="p-3">Total</th>
                <th class="p-3">Estado SUNAT</th>
                <th class="p-3">Respuesta / Hash</th>
                <th class="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5">
              @for (fila of filasFiltradas(); track fila.ordenId) {
                @let enviando = enviandoOrdenIds().has(fila.ordenId);
                <tr class="hover:bg-white/5 transition">
                  <td class="p-3">
                    <div class="font-mono font-bold text-white">{{ fila.serieNumero }}</div>
                    <span class="text-[10px] text-slate-400">{{ fila.tipo }}</span>
                    @if (fila.anulado) {
                      <span class="ml-1 px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[9px] font-bold">ANULADO</span>
                    }
                  </td>
                  <td class="p-3 font-mono text-slate-300">#{{ fila.ordenId }}</td>
                  <td class="p-3">
                    <div class="text-white font-medium truncate max-w-[180px]">{{ fila.clienteNombre }}</div>
                    <div class="text-[10px] font-mono text-slate-400">{{ fila.clienteDoc }}</div>
                  </td>
                  <td class="p-3 font-mono font-bold text-polleria-gold">
                    {{ fila.total | currencyPEN }}
                  </td>
                  <td class="p-3">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold" [ngClass]="claseEstado(fila.estadoSunat)">
                      {{ etiquetaEstado(fila.estadoSunat) }}
                    </span>
                    @if (fila.envio?.intentos) {
                      <div class="text-[10px] text-slate-500 mt-0.5">
                        Intentos: {{ fila.envio?.intentos }}
                      </div>
                    }
                  </td>
                  <td class="p-3 max-w-[260px]">
                    @if (fila.envio; as e) {
                      <div class="text-[11px] text-slate-300 truncate" [title]="e.descripcion || ''">
                        @if (e.codigoRespuesta) {
                          <span class="font-mono font-bold">[{{ e.codigoRespuesta }}]</span>
                        }
                        {{ e.descripcion || '—' }}
                      </div>
                      @if (e.observaciones) {
                        <div class="text-[10px] text-amber-300 truncate" [title]="e.observaciones">
                          Obs: {{ e.observaciones }}
                        </div>
                      }
                      @if (e.hash) {
                        <div class="text-[10px] font-mono text-slate-500 truncate" [title]="e.hash">
                          Hash: {{ e.hash }}
                        </div>
                      }
                    } @else if (fila.anulado) {
                      <span class="text-slate-500 text-[11px]">Anulado (no enviable)</span>
                    } @else {
                      <span class="text-slate-500 text-[11px]">Aún no enviado a SUNAT</span>
                    }
                  </td>
                  <td class="p-3 text-right">
                    <div class="inline-flex flex-wrap justify-end gap-1.5">
                      @if (!fila.anulado && (fila.estadoSunat === 'SIN_ENVIAR' || fila.estadoSunat === 'RECHAZADO' || fila.estadoSunat === 'ERROR' || fila.estadoSunat === 'ENVIANDO')) {
                        <button
                          type="button"
                          [disabled]="enviando"
                          (click)="enviarSunat.emit(fila.ordenId)"
                          class="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-[11px] transition cursor-pointer"
                        >
                          {{ enviando ? 'Enviando...' : (fila.envio ? 'Reintentar' : 'Enviar a SUNAT') }}
                        </button>
                      }
                      @if (fila.envio && (fila.estadoSunat === 'ACEPTADO' || fila.estadoSunat === 'OBSERVADO')) {
                        <button
                          type="button"
                          (click)="verTicketSunat.emit(fila.ordenId)"
                          class="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-[11px] transition cursor-pointer"
                        >
                          Ticket QR
                        </button>
                        <button
                          type="button"
                          (click)="descargarXml.emit(fila.ordenId)"
                          class="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-[11px] transition cursor-pointer"
                        >
                          XML
                        </button>
                        @if (fila.envio.tieneCdr) {
                          <button
                            type="button"
                            (click)="descargarCdr.emit(fila.ordenId)"
                            class="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-[11px] transition cursor-pointer"
                          >
                            CDR
                          </button>
                        }
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="p-8 text-center text-slate-500">
                    No hay comprobantes que coincidan con los filtros seleccionados.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class SunatBillingPanelComponent {
  readonly comprobantesEmitidos = input<BackendComprobanteResponse[]>([]);
  readonly envios = input<EnvioSunatResponse[]>([]);
  readonly cargando = input<boolean>(false);
  readonly error = input<string | null>(null);
  readonly enviandoOrdenIds = input<Set<number>>(new Set());

  readonly refrescar = output<void>();
  readonly enviarSunat = output<number>();
  readonly verTicketSunat = output<number>();
  readonly descargarXml = output<number>();
  readonly descargarCdr = output<number>();

  readonly filtroEstado = signal<FiltroEstadoSunat>('TODOS');
  readonly filtroTipo = signal<FiltroTipoComprobante>('TODOS');
  readonly busqueda = signal<string>('');

  private readonly filasUnificadas = computed<FilaFacturacionSunat[]>(() => {
    const porOrden = new Map<number, FilaFacturacionSunat>();
    const enviosMap = new Map<number, EnvioSunatResponse>(this.envios().map(e => [e.ordenId, e]));

    for (const c of this.comprobantesEmitidos()) {
      const envio = enviosMap.get(c.ordenId) ?? null;
      const anulado = Boolean(c.anulado);
      porOrden.set(c.ordenId, {
        ordenId: c.ordenId,
        tipo: c.tipo,
        serieNumero: envio?.serieNumero ?? c.serieCorrelativo,
        clienteNombre: c.clienteNombre || 'CLIENTES VARIOS',
        clienteDoc: c.clienteNumDoc ? `${c.clienteTipoDoc || 'DOC'}: ${c.clienteNumDoc}` : 'Sin documento',
        total: Number(c.total ?? envio?.total ?? 0),
        anulado,
        emitidoEn: c.emitidoEn ?? envio?.enviadoEn ?? null,
        envio,
        estadoSunat: envio?.estado ?? (anulado ? 'ANULADO' : 'SIN_ENVIAR')
      });
    }

    for (const e of this.envios()) {
      if (!porOrden.has(e.ordenId)) {
        porOrden.set(e.ordenId, {
          ordenId: e.ordenId,
          tipo: e.tipo,
          serieNumero: e.serieNumero,
          clienteNombre: '—',
          clienteDoc: '—',
          total: Number(e.total ?? 0),
          anulado: false,
          emitidoEn: e.enviadoEn,
          envio: e,
          estadoSunat: e.estado
        });
      }
    }

    return Array.from(porOrden.values()).sort((a, b) => b.ordenId - a.ordenId);
  });

  readonly kpis = computed(() => {
    const filas = this.filasUnificadas();
    return {
      total: filas.length,
      aceptados: filas.filter(f => f.estadoSunat === 'ACEPTADO').length,
      pendientesOObservados: filas.filter(
        f => !f.anulado && (f.estadoSunat === 'SIN_ENVIAR' || f.estadoSunat === 'OBSERVADO')
      ).length,
      conError: filas.filter(f => f.estadoSunat === 'RECHAZADO' || f.estadoSunat === 'ERROR').length
    };
  });

  readonly filasFiltradas = computed(() => {
    const estado = this.filtroEstado();
    const tipo = this.filtroTipo();
    const q = this.busqueda().trim().toLowerCase();

    return this.filasUnificadas().filter(f => {
      if (estado !== 'TODOS' && f.estadoSunat !== estado) return false;
      if (tipo !== 'TODOS' && f.tipo !== tipo) return false;
      if (q) {
        const texto = `${f.serieNumero} ${f.ordenId} ${f.clienteNombre} ${f.clienteDoc}`.toLowerCase();
        if (!texto.includes(q)) return false;
      }
      return true;
    });
  });

  protected etiquetaEstado(estado: FilaFacturacionSunat['estadoSunat']): string {
    if (estado === 'SIN_ENVIAR') return 'Sin enviar';
    if (estado === 'ANULADO') return 'Anulado';
    return estado;
  }

  protected claseEstado(estado: FilaFacturacionSunat['estadoSunat']): string {
    switch (estado) {
      case 'ACEPTADO': return 'bg-emerald-500/20 text-emerald-300';
      case 'OBSERVADO': return 'bg-amber-500/20 text-amber-300';
      case 'RECHAZADO':
      case 'ERROR':
      case 'ANULADO': return 'bg-rose-500/20 text-rose-300';
      case 'ENVIANDO': return 'bg-sky-500/20 text-sky-300';
      default: return 'bg-slate-700/60 text-slate-300';
    }
  }
}
