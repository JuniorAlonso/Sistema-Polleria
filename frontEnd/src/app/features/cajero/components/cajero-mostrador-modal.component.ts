import { Component, inject, input, output, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { PaymentService } from '../../../core/services/payment.service';
import { FinanceService } from '../../../core/services/finance.service';
import { NotificationService } from '../../../core/services/notification.service';
import { OrdersApiService } from '../../../core/api/orders-api.service';
import { mensajeError } from '../../../core/utils/api-error';

interface ProductoSimple {
  id: number;
  nombre: string;
  precio: number;
  disponible: boolean;
  categoria?: string;
}

interface LineaMostrador {
  producto: ProductoSimple;
  cantidad: number;
}

type MetodoPagoMostrador = 'EFECTIVO_CONTRAENTREGA' | 'TARJETA' | 'YAPE';

/**
 * Quick counter-sale modal (D2.1): creates a RECOJO order from the SALON channel in PENDIENTE_PAGO,
 * then collects payment immediately via the existing iniciarPago / confirmarPago flow.
 * Receipt is emitted on successful payment (D2.6). Cash income is registered in the register (D2.4).
 */
@Component({
  selector: 'app-cajero-mostrador-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPENPipe],
  template: `
    <div class="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-4"
         (click)="onBackdrop($event)">
      <div class="w-full max-w-3xl bg-[#14161a] rounded-2xl border border-white/10 shadow-2xl mx-4 my-auto"
           (click)="$event.stopPropagation()">

        <!-- Header -->
        <div class="flex items-center justify-between p-5 border-b border-white/10">
          <h2 class="text-base font-bold text-white">Venta en Mostrador</h2>
          <button type="button" (click)="cerrar.emit()"
            class="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer transition">✕</button>
        </div>

        <div class="flex flex-col lg:flex-row">

          <!-- Product menu -->
          <div class="flex-1 p-5 border-b lg:border-b-0 lg:border-r border-white/10">
            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Carta</h3>
            @if (cargandoProductos()) {
              <div class="py-12 text-center text-slate-500 text-sm">Cargando carta…</div>
            } @else if (productos().length === 0) {
              <div class="py-12 text-center text-slate-500 text-sm">No hay productos disponibles.</div>
            } @else {
              <div class="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                @for (p of productos(); track p.id) {
                  <button type="button" (click)="agregar(p)"
                    class="relative flex items-center gap-2 p-3 rounded-xl bg-black/40 border border-white/10 hover:border-emerald-500/50 text-left transition cursor-pointer">
                    <div class="flex-1 min-w-0">
                      <p class="text-xs font-bold text-white truncate">{{ p.nombre }}</p>
                      <p class="text-[11px] text-polleria-gold font-mono">S/ {{ p.precio | number:'1.2-2' }}</p>
                    </div>
                    @if (cantidadDe(p) > 0) {
                      <span class="text-xs font-bold text-emerald-300 bg-emerald-500/20 rounded-full px-2 py-0.5 shrink-0">
                        {{ cantidadDe(p) }}
                      </span>
                    }
                  </button>
                }
              </div>
            }
          </div>

          <!-- Cart + payment -->
          <div class="w-full lg:w-72 p-5 flex flex-col gap-4">

            <!-- Cart -->
            <div>
              <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Pedido</h3>
              @if (lineas().length === 0) {
                <p class="text-slate-600 text-xs py-6 text-center">Selecciona productos de la carta</p>
              } @else {
                <div class="space-y-1 max-h-36 overflow-y-auto pr-1">
                  @for (l of lineas(); track l.producto.id) {
                    <div class="flex items-center gap-2">
                      <span class="flex-1 text-xs text-white truncate">{{ l.producto.nombre }}</span>
                      <div class="flex items-center gap-1">
                        <button type="button" (click)="quitar(l.producto)"
                          class="w-5 h-5 rounded-full bg-white/10 hover:bg-rose-500/30 text-white text-xs flex items-center justify-center cursor-pointer">−</button>
                        <span class="text-xs font-mono text-white w-4 text-center">{{ l.cantidad }}</span>
                        <button type="button" (click)="agregar(l.producto)"
                          class="w-5 h-5 rounded-full bg-white/10 hover:bg-emerald-500/30 text-white text-xs flex items-center justify-center cursor-pointer">+</button>
                      </div>
                      <span class="text-[11px] font-mono text-polleria-gold w-14 text-right">
                        S/ {{ l.producto.precio * l.cantidad | number:'1.2-2' }}
                      </span>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Total -->
            <div class="border-t border-white/10 pt-3 flex justify-between items-center">
              <span class="text-sm font-bold text-slate-400">TOTAL</span>
              <span class="text-xl font-black text-polleria-gold font-mono">{{ total() | currencyPEN }}</span>
            </div>

            <!-- Payment method -->
            <div>
              <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Método de pago</h3>
              <div class="flex gap-1.5">
                <button type="button" (click)="metodo.set('EFECTIVO_CONTRAENTREGA')"
                  [class]="metodo() === 'EFECTIVO_CONTRAENTREGA'
                    ? 'flex-1 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white cursor-pointer'
                    : 'flex-1 py-2 rounded-xl text-xs font-bold bg-white/5 text-slate-400 hover:bg-white/10 cursor-pointer border border-white/10'">
                  Efectivo
                </button>
                <button type="button" (click)="metodo.set('TARJETA')"
                  [class]="metodo() === 'TARJETA'
                    ? 'flex-1 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white cursor-pointer'
                    : 'flex-1 py-2 rounded-xl text-xs font-bold bg-white/5 text-slate-400 hover:bg-white/10 cursor-pointer border border-white/10'">
                  Tarjeta
                </button>
                <button type="button" (click)="metodo.set('YAPE')"
                  [class]="metodo() === 'YAPE'
                    ? 'flex-1 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white cursor-pointer'
                    : 'flex-1 py-2 rounded-xl text-xs font-bold bg-white/5 text-slate-400 hover:bg-white/10 cursor-pointer border border-white/10'">
                  Yape
                </button>
              </div>
            </div>

            <!-- Efectivo input -->
            @if (metodo() === 'EFECTIVO_CONTRAENTREGA') {
              <div>
                <label class="text-xs text-slate-400 font-bold block mb-1">Efectivo recibido (S/)</label>
                <input type="number" min="0" step="0.10" [(ngModel)]="efectivoRecibidoInput"
                  class="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-emerald-400" />
                <div class="flex gap-1.5 mt-1.5">
                  @for (extra of [1, 5, 10, 20]; track extra) {
                    <button type="button" (click)="sumarEfectivo(extra)"
                      class="flex-1 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs cursor-pointer transition">+{{ extra }}</button>
                  }
                </div>
                @if (efectivoRecibidoInput >= total() && total() > 0) {
                  <p class="text-xs text-emerald-300 mt-1.5 font-mono">Vuelto: S/ {{ vueltoCalculado() | number:'1.2-2' }}</p>
                }
                @if (!cajaAbierta()) {
                  <p class="text-xs font-bold text-amber-300 mt-1.5">⚠ Caja cerrada — el ingreso no se registrará automáticamente</p>
                }
              </div>
            }

            <!-- Reference for card / Yape -->
            @if (metodo() !== 'EFECTIVO_CONTRAENTREGA') {
              <div>
                <label class="text-xs text-slate-400 font-bold block mb-1">
                  {{ metodo() === 'TARJETA' ? 'N.° operación POS' : 'Número Yape confirmado' }}
                </label>
                <input type="text" [(ngModel)]="referencia"
                  [placeholder]="metodo() === 'TARJETA' ? 'Ej: 123456' : 'Yape verificado'"
                  class="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-emerald-400" />
              </div>
            }

            <!-- Actions -->
            <div class="flex gap-2 pt-1">
              <button type="button" (click)="cerrar.emit()"
                class="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-bold cursor-pointer transition border border-white/10">
                Cancelar
              </button>
              <button type="button" (click)="confirmar()" [disabled]="!esValido() || procesando()"
                class="flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                [ngClass]="esValido() ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-white/5 text-slate-400'">
                {{ procesando() ? 'Procesando…' : 'Cobrar y registrar' }}
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  `
})
export class CajeroMostradorModalComponent implements OnInit {
  readonly cajaAbierta = input<boolean>(false);
  readonly cerrar = output<void>();
  readonly confirmado = output<void>();

  private readonly http = inject(HttpClient);
  private readonly ordersApi = inject(OrdersApiService);
  private readonly paymentService = inject(PaymentService);
  private readonly financeService = inject(FinanceService);
  private readonly notify = inject(NotificationService);

  readonly productos = signal<ProductoSimple[]>([]);
  readonly cargandoProductos = signal(true);
  readonly lineas = signal<LineaMostrador[]>([]);
  readonly metodo = signal<MetodoPagoMostrador>('EFECTIVO_CONTRAENTREGA');
  referencia = '';
  efectivoRecibidoInput = 0;
  readonly procesando = signal(false);

  readonly total = computed(() =>
    this.lineas().reduce((s, l) => s + l.producto.precio * l.cantidad, 0)
  );

  ngOnInit(): void {
    this.http.get<any[]>(`${environment.ordersApiUrl}/productos?soloDisponibles=true`).subscribe({
      next: (ps) => {
        this.productos.set((ps || []).filter(p => p.disponible !== false).map(p => ({
          id: Number(p.id),
          nombre: String(p.nombre),
          precio: Number(p.precio),
          disponible: Boolean(p.disponible),
          categoria: p.categoria
        })));
        this.cargandoProductos.set(false);
      },
      error: () => this.cargandoProductos.set(false)
    });
  }

  agregar(p: ProductoSimple): void {
    const existing = this.lineas().find(l => l.producto.id === p.id);
    if (existing) {
      this.lineas.update(ls => ls.map(l => l.producto.id === p.id ? { ...l, cantidad: l.cantidad + 1 } : l));
    } else {
      this.lineas.update(ls => [...ls, { producto: p, cantidad: 1 }]);
    }
    if (this.metodo() === 'EFECTIVO_CONTRAENTREGA') {
      this.efectivoRecibidoInput = this.total();
    }
  }

  quitar(p: ProductoSimple): void {
    this.lineas.update(ls => ls
      .map(l => l.producto.id === p.id ? { ...l, cantidad: l.cantidad - 1 } : l)
      .filter(l => l.cantidad > 0)
    );
    if (this.metodo() === 'EFECTIVO_CONTRAENTREGA') {
      this.efectivoRecibidoInput = this.total();
    }
  }

  cantidadDe(p: ProductoSimple): number {
    return this.lineas().find(l => l.producto.id === p.id)?.cantidad ?? 0;
  }

  sumarEfectivo(extra: number): void {
    this.efectivoRecibidoInput = (this.efectivoRecibidoInput || 0) + extra;
  }

  vueltoCalculado(): number {
    return Math.max(0, (this.efectivoRecibidoInput || 0) - this.total());
  }

  esValido(): boolean {
    if (this.lineas().length === 0) return false;
    if (this.metodo() === 'EFECTIVO_CONTRAENTREGA') {
      return (this.efectivoRecibidoInput || 0) >= this.total();
    }
    return this.referencia.trim().length > 0;
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cerrar.emit();
    }
  }

  confirmar(): void {
    if (!this.esValido() || this.procesando()) return;
    this.procesando.set(true);

    const body = {
      tipo: 'RECOJO',
      canalOrigen: 'SALON',
      estadoInicial: 'PENDIENTE_PAGO',
      nombreCliente: 'Mostrador',
      items: this.lineas().map(l => ({ productoId: l.producto.id, cantidad: l.cantidad }))
    };

    this.ordersApi.crear(body).subscribe({
      next: (dto) => this.procesarPago(dto),
      error: (err) => {
        this.procesando.set(false);
        this.notify.showError('No se pudo crear el pedido', mensajeError(err, 'Intenta nuevamente.'));
      }
    });
  }

  private procesarPago(dto: any): void {
    const ordenId = Number(String(dto.id).replace(/^ord-/, ''));
    const monto = Number(dto.total);
    const metodo = this.metodo();

    this.paymentService.iniciarPago(ordenId, monto, metodo).subscribe({
      next: (pago) => {
        if (metodo !== 'EFECTIVO_CONTRAENTREGA') {
          // D2.4: manual cashier confirmation after verifying POS terminal or Yape screen.
          this.paymentService.confirmarPago(Number(pago.id), this.referencia || 'MANUAL').subscribe({
            next: () => this.finalizarMostrador(dto),
            error: (err) => {
              this.procesando.set(false);
              this.notify.showError('El pedido fue creado pero el pago no pudo confirmarse',
                mensajeError(err, 'Confírmalo desde el historial.'));
            }
          });
        } else {
          this.finalizarMostrador(dto);
        }
      },
      error: (err) => {
        this.procesando.set(false);
        this.notify.showError('No se pudo procesar el pago', mensajeError(err, 'El pedido se creó. Intenta confirmar el pago.'));
      }
    });
  }

  private finalizarMostrador(dto: any): void {
    const ordenId = Number(String(dto.id).replace(/^ord-/, ''));
    const codigo = dto.codigoSeguimiento || dto.id;
    const total = Number(dto.total);

    // D2.6: emit receipt at payment time for mostrador orders.
    this.financeService.emitirComprobante({
      ordenId,
      tipo: 'BOLETA',
      clienteNombre: 'Mostrador',
      total,
      pagadoDigitalmente: this.metodo() !== 'EFECTIVO_CONTRAENTREGA',
    }).subscribe({
      error: (err) => this.notify.showError('No se emitió el comprobante', mensajeError(err, ''))
    });

    if (this.metodo() === 'EFECTIVO_CONTRAENTREGA' && this.cajaAbierta()) {
      this.financeService.registrarMovimiento({
        tipo: 'INGRESO',
        monto: total,
        motivo: `Venta mostrador #${codigo}`
      }).subscribe({
        error: () => this.notify.showError('No se registró el ingreso en caja',
          'El cobro sí se procesó. Registra el ingreso manualmente en Arqueo.')
      });
    }

    this.procesando.set(false);
    this.notify.showSuccess('Venta en mostrador registrada', `Pedido #${codigo} enviado a cocina`);
    this.confirmado.emit();
  }
}
