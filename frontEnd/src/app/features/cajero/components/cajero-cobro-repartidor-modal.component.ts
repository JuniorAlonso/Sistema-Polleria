import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Repartidor } from '../../../core/services/repartidores.service';
import { FinanceService } from '../../../core/services/finance.service';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { BackendEfectivoPendienteLiquidacion } from '../../../core/models/api-contracts.model';

@Component({
  selector: 'app-cajero-cobro-repartidor-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPENPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="w-full max-w-md bg-[#14161a] border border-white/15 rounded-3xl p-6 shadow-2xl space-y-4">
        <div>
          <h3 class="font-display text-xl font-bold text-white">Cobrar Efectivo a Repartidor</h3>
          <p class="text-xs text-slate-400 mt-0.5">El monto cobrado ingresa inmediatamente a la caja activa y disminuye la deuda del repartidor.</p>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block text-slate-300 font-bold mb-1">Repartidor:</label>
            @if (repartidores().length) {
              <select
                [ngModel]="repartidorId()"
                (ngModelChange)="onRepartidorChange($event)"
                class="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-white font-medium focus:border-amber-500 focus:outline-none"
              >
                <option [ngValue]="null" disabled>Selecciona un repartidor</option>
                @for (r of repartidores(); track r.id) {
                  <option [ngValue]="r.id">{{ r.nombre }}</option>
                }
              </select>
            } @else {
              <p class="text-amber-300">No se pudo cargar el roster de repartidores.</p>
            }
          </div>

          <!-- Resumen de cuenta del repartidor seleccionado -->
          @if (cargandoSaldo()) {
            <p class="text-slate-400 italic">Consultando saldo en backend...</p>
          }
          @if (!cargandoSaldo() && saldoInfo(); as info) {
            <div class="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1.5 font-mono text-[11px]">
              <div class="flex justify-between text-slate-400">
                <span>Cobrado en ruta (ContraPago):</span>
                <span class="text-white">{{ (info.totalCobrado ?? info.total) | currencyPEN }}</span>
              </div>
              <div class="flex justify-between text-slate-400">
                <span>Ya rendido a caja:</span>
                <span class="text-emerald-400">{{ (info.totalRendido ?? 0) | currencyPEN }}</span>
              </div>
              <div class="flex justify-between text-slate-200 font-bold border-t border-white/10 pt-1 text-xs">
                <span>Saldo Pendiente por Rendir:</span>
                <span class="text-polleria-gold font-display text-sm">{{ info.total | currencyPEN }}</span>
              </div>
            </div>
          }

          <div>
            <div class="flex justify-between items-center mb-1">
              <label class="text-slate-300 font-bold">Monto a Cobrar (S/):</label>
              @if (saldoInfo() && saldoInfo()!.total > 0) {
                <button
                  type="button"
                  (click)="cobrarTotal()"
                  class="text-[10px] text-amber-400 hover:text-amber-300 underline font-bold cursor-pointer"
                >
                  Cobrar Todo ({{ saldoInfo()!.total | currencyPEN }})
                </button>
              }
            </div>
            <input
              type="number"
              [(ngModel)]="monto"
              step="0.01"
              min="0.01"
              [max]="saldoMaximo()"
              placeholder="0.00"
              class="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-white font-mono text-lg font-bold focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label class="block text-slate-300 font-bold mb-1">Observaciones (opcional):</label>
            <input
              type="text"
              [(ngModel)]="observaciones"
              placeholder="Entrega parcial de turno / Arqueo intermedio"
              class="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-white focus:border-amber-500 focus:outline-none"
            />
          </div>
        </div>

        <!-- Validación / Feedback -->
        @if (errorMensaje()) {
          <p class="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-bold text-rose-300">
            {{ errorMensaje() }}
          </p>
        }
        @if (mensajeBloqueo()) {
          <p data-testid="cobro-repartidor-bloqueo" class="text-[11px] font-bold text-amber-300">
            {{ mensajeBloqueo() }}
          </p>
        }

        <div class="flex justify-end gap-2 pt-3 border-t border-white/10">
          <button
            type="button"
            (click)="cancelar.emit()"
            [disabled]="procesando()"
            class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs uppercase transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            (click)="ejecutarCobro()"
            [disabled]="botonDeshabilitado()"
            class="disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2 rounded-xl bg-polleria-gold hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-lg flex items-center gap-1.5"
          >
            @if (procesando()) {
              <span>Procesando...</span>
            } @else {
              <span>Confirmar Cobro</span>
            }
          </button>
        </div>
      </div>
    </div>
  `
})
export class CajeroCobroRepartidorModalComponent {
  private financeService = inject(FinanceService);

  readonly repartidores = input<Repartidor[]>([]);
  readonly repartidorId = model<number | null>(null);
  readonly monto = model<number>(0);
  readonly observaciones = model<string>('');

  readonly saldoInfo = signal<BackendEfectivoPendienteLiquidacion | null>(null);
  readonly cargandoSaldo = signal<boolean>(false);
  readonly procesando = signal<boolean>(false);
  readonly errorMensaje = signal<string | null>(null);

  readonly cancelar = output<void>();
  readonly cobroExitoso = output<void>();

  private lastConsultedId: number | null = null;

  constructor() {
    effect(() => {
      const id = this.repartidorId();
      if (id !== null && id !== undefined && id !== this.lastConsultedId) {
        this.consultarSaldo(id);
      }
    });
  }

  readonly saldoMaximo = computed(() => this.saldoInfo()?.total ?? 0);

  readonly mensajeBloqueo = computed<string | null>(() => {
    if (this.repartidorId() === null) {
      return 'Selecciona un repartidor para continuar.';
    }
    if (this.cargandoSaldo()) {
      return null;
    }
    const info = this.saldoInfo();
    if (info && info.total <= 0) {
      return 'El repartidor no tiene saldo pendiente por rendir.';
    }
    const m = this.monto();
    if (!m || m <= 0) {
      return 'Ingresa un monto mayor a S/ 0.00.';
    }
    if (info && m > info.total) {
      return `El monto ingresado (S/ ${m.toFixed(2)}) supera el saldo pendiente (S/ ${info.total.toFixed(2)}).`;
    }
    return null;
  });

  readonly botonDeshabilitado = computed(() =>
    this.procesando() || this.cargandoSaldo() || this.mensajeBloqueo() !== null
  );

  onRepartidorChange(id: number | null): void {
    this.repartidorId.set(id);
    if (!id) {
      this.lastConsultedId = null;
      this.saldoInfo.set(null);
      this.monto.set(0);
      this.errorMensaje.set(null);
      return;
    }
    this.consultarSaldo(id);
  }

  private consultarSaldo(id: number): void {
    this.lastConsultedId = id;
    this.cargandoSaldo.set(true);
    this.errorMensaje.set(null);
    this.financeService.obtenerEfectivoPendienteLiquidacion(id).subscribe({
      next: (info) => {
        this.saldoInfo.set(info);
        this.cargandoSaldo.set(false);
        if (info && info.total > 0) {
          this.monto.set(info.total);
        } else {
          this.monto.set(0);
        }
      },
      error: (err) => {
        this.saldoInfo.set(null);
        this.cargandoSaldo.set(false);
        const msg = err?.error?.message || 'No se pudo consultar el saldo pendiente del repartidor';
        this.errorMensaje.set(msg);
      }
    });
  }

  cobrarTotal(): void {
    const info = this.saldoInfo();
    if (info) {
      this.monto.set(info.total);
    }
  }

  ejecutarCobro(): void {
    const repId = this.repartidorId();
    const m = this.monto();
    if (!repId || !m || m <= 0) return;

    const rep = this.repartidores().find(r => r.id === repId);
    this.procesando.set(true);
    this.errorMensaje.set(null);

    this.financeService.registrarCobroRepartidor({
      repartidorId: repId,
      repartidorNombre: rep?.nombre,
      monto: m,
      observaciones: this.observaciones() || undefined
    }).subscribe({
      next: () => {
        this.procesando.set(false);
        this.cobroExitoso.emit();
      },
      error: (err) => {
        this.procesando.set(false);
        const msg = err?.error?.message || 'Error al registrar el cobro de efectivo. Verifica la caja chica activa.';
        this.errorMensaje.set(msg);
      }
    });
  }
}

