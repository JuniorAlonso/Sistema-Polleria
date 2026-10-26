import { etiquetaPedido } from '../../../core/utils/pedido';
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CartService } from '../../../core/services/cart.service';
import { OrdersService } from '../../../core/services/orders.service';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { NotificationService } from '../../../core/services/notification.service';
import { Order, OrderType, PaymentMethod } from '../../../core/models/order.model';
import { PaymentService } from '../../../core/services/payment.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CurrencyPENPipe],
  template: `
    <div class="min-h-screen lg:h-screen lg:max-h-screen w-full flex flex-col lg:flex-row bg-white font-sans text-slate-900 selection:bg-polleria-gold selection:text-slate-900 lg:overflow-hidden">
      
      <!-- ================= LEFT COLUMN: RESUMEN DE PEDIDO ================= -->
      <div class="lg:w-1/2 p-4 sm:p-6 lg:p-8 flex flex-col justify-between bg-white h-full lg:overflow-hidden border-r border-slate-100">
        
        <!-- Top Header -->
        <div class="flex items-center justify-between pb-2 shrink-0">
          <div>
            <h1 class="font-display text-3xl sm:text-4xl font-black text-polleria-crimson tracking-wider leading-none">
              EL SAN POLLO
            </h1>
            <p class="text-xs text-slate-500 font-medium mt-0.5">
              Resumen de tu pedido
            </p>
          </div>

          <a 
            routerLink="/menu" 
            class="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 hover:text-polleria-crimson transition tracking-wider uppercase px-3 py-1.5 rounded-lg hover:bg-slate-100"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
            </svg>
            <span>VOLVER</span>
          </a>
        </div>

        <!-- Product Cards List -->
        <div class="flex-1 overflow-y-auto space-y-2.5 my-2.5 pr-1.5">
          @for (item of cart.items(); track item.product.id) {
            <div class="p-3 rounded-2xl border border-slate-200/90 bg-white hover:border-slate-300 transition flex items-center justify-between gap-3 shadow-xs">
              
              <!-- Left: Thumbnail & Info -->
              <div class="flex items-center gap-3">
                <img 
                  [src]="item.product.imagenUrl" 
                  [alt]="item.product.nombre"
                  class="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border border-slate-100 shrink-0 bg-slate-900"
                />

                <div class="space-y-0.5">
                  <h3 class="font-bold text-xs sm:text-sm text-slate-900 uppercase tracking-wide line-clamp-1">
                    {{ item.product.nombre }}
                  </h3>
                  <p class="text-[11px] text-slate-500 line-clamp-1 max-w-[180px] sm:max-w-xs">
                    {{ item.product.descripcion }}
                  </p>

                  <!-- Cantidad Counter -->
                  <div class="inline-flex items-center gap-1.5 pt-0.5">
                    <button 
                      (click)="cart.updateQuantity(item.product.id, -1)"
                      class="text-slate-600 hover:text-slate-900 font-bold text-xs px-1.5 py-0.5 rounded hover:bg-slate-100 cursor-pointer"
                    >
                      -
                    </button>
                    <span class="px-2 py-0.5 rounded bg-[#16181b] text-white text-[10px] font-bold font-mono">
                      Cant: {{ item.cantidad }}
                    </span>
                    <button 
                      (click)="cart.updateQuantity(item.product.id, 1)"
                      class="text-slate-600 hover:text-slate-900 font-bold text-xs px-1.5 py-0.5 rounded hover:bg-slate-100 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <!-- Right: Item Subtotal -->
              <div class="text-right shrink-0">
                <span class="font-display text-lg sm:text-xl font-bold text-polleria-crimson tracking-wide">
                  {{ item.subtotal | currencyPEN }}
                </span>
              </div>

            </div>
          } @empty {
            <div class="py-12 text-center text-slate-400 space-y-3">
              <p class="text-sm font-semibold">Tu carrito de compras está vacío.</p>
              <a 
                routerLink="/menu" 
                class="inline-block px-5 py-2 rounded-xl bg-polleria-crimson text-white text-xs font-bold uppercase tracking-wider hover:bg-[#a81125] transition"
              >
                Explorar la Carta
              </a>
            </div>
          }
        </div>

        <!-- Financial Breakdown -->
        <div class="pt-3 border-t border-slate-200 space-y-1.5 shrink-0">
          <div class="flex justify-between text-xs text-slate-600 font-medium">
            <span>Subtotal</span>
            <span class="font-semibold text-slate-900">{{ getSubtotalNeto() | currencyPEN }}</span>
          </div>

          <div class="flex justify-between text-xs text-slate-600 font-medium">
            <span>IGV (18%)</span>
            <span class="font-semibold text-slate-900">{{ getIgv() | currencyPEN }}</span>
          </div>

          <div class="flex justify-between text-xs text-slate-600 font-medium">
            <span>Envío ({{ tipoPedido() === 'DELIVERY' ? 'Delivery' : 'Recojo en local' }})</span>
            <span class="font-semibold text-slate-900">
              {{ (tipoPedido() === 'DELIVERY' ? cart.costoEnvio() : 0) | currencyPEN }}
            </span>
          </div>

          <!-- TOTAL A PAGAR -->
          <div class="pt-2 border-t border-slate-200 flex items-baseline justify-between">
            <span class="font-bold text-xs sm:text-sm uppercase tracking-widest text-slate-900">
              TOTAL A PAGAR
            </span>
            <span class="font-display text-3xl sm:text-4xl font-black text-polleria-crimson tracking-tight">
              {{ totalPagar() | currencyPEN }}
            </span>
          </div>
        </div>

      </div>

      <!-- ================= RIGHT COLUMN: DETALLES DE PAGO ================= -->
      <div class="lg:w-1/2 p-4 sm:p-6 lg:p-8 bg-[#7a0513] text-white flex flex-col justify-between h-full lg:overflow-y-auto shadow-2xl">
        
        <div class="space-y-4">
          
          <!-- Title -->
          <div class="flex items-center justify-between">
            <h2 class="font-display text-2xl sm:text-3xl font-black uppercase text-white tracking-wide leading-none">
              CHECKOUT
            </h2>
            
            <!-- Selector Tipo de Pedido -->
            <div class="flex bg-black/40 p-1 rounded-xl border border-white/15 text-xs font-bold">
              <button 
                type="button" 
                (click)="tipoPedido.set('DELIVERY')"
                [ngClass]="tipoPedido() === 'DELIVERY' ? 'bg-polleria-gold text-slate-950 shadow' : 'text-white/70 hover:text-white'"
                class="px-3 py-1.5 rounded-lg transition uppercase tracking-wider cursor-pointer"
              >
                Delivery
              </button>
              <button 
                type="button" 
                (click)="tipoPedido.set('RECOJO_EN_TIENDA')"
                [ngClass]="tipoPedido() === 'RECOJO_EN_TIENDA' ? 'bg-polleria-gold text-slate-950 shadow' : 'text-white/70 hover:text-white'"
                class="px-3 py-1.5 rounded-lg transition uppercase tracking-wider cursor-pointer"
              >
                Recojo en Tienda
              </button>
            </div>
          </div>

          <!-- Card 1: DATOS DE ENTREGA O RECOJO -->
          <div class="p-4 rounded-2xl bg-black/25 border border-white/10 space-y-2.5">
            
            <div class="flex items-center gap-2 text-polleria-gold text-xs font-bold uppercase tracking-wider">
              <svg class="w-4 h-4 text-polleria-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              <span>{{ tipoPedido() === 'DELIVERY' ? 'DIRECCIÓN DE ENTREGA' : 'LOCAL DE RECOJO EN TIENDA' }}</span>
            </div>

            @if (tipoPedido() === 'DELIVERY') {
              <!-- Input Dirección -->
              <input 
                type="text" 
                [(ngModel)]="direccion" 
                placeholder="Av. San Martín 1234, Ica"
                class="w-full px-3.5 py-2.5 rounded-xl bg-black/30 border border-white/15 text-white placeholder:text-white/50 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-polleria-gold transition"
              />

              <!-- Input Instrucciones Especiales -->
              <input 
                type="text" 
                [(ngModel)]="instrucciones" 
                placeholder="Referencia (ej. Frente al parque, timbre 201)"
                class="w-full px-3.5 py-2.5 rounded-xl bg-black/30 border border-white/15 text-white placeholder:text-white/50 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-polleria-gold transition"
              />
            } @else {
              <div class="p-3 rounded-xl bg-black/40 border border-polleria-gold/30 text-xs space-y-1">
                <p class="font-bold text-polleria-gold">Local Principal San Pollo:</p>
                <p class="text-white/90">Av. San Martín 456, Centro de Ica (Frente a Plaza de Armas)</p>
                <p class="text-[11px] text-white/60">Tiempo aprox. de preparación: 25 - 35 minutos. Tienes hasta 1 hora para retirarlo una vez listo.</p>
              </div>
            }

            <!-- Input Celular: notificaciones de WhatsApp -->
            <div class="space-y-1">
              <input 
                type="tel" 
                [(ngModel)]="celular" 
                (ngModelChange)="onCelularChange($event)"
                inputmode="numeric"
                maxlength="9"
                placeholder="Celular para WhatsApp (ej. 912345678)"
                class="w-full px-3.5 py-2.5 rounded-xl bg-black/30 border border-white/15 text-white placeholder:text-white/50 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-polleria-gold transition"
              />
              <p class="text-[10px] text-white/50 px-1">Te avisaremos por WhatsApp el estado del pedido y cuando esté en tu puerta o listo para recoger.</p>
            </div>
          </div>

          <!-- AVISO DE CLIENTE SANCIONADO (BLACK LIST) -->
          @if (sancionActiva()) {
            <div class="p-3.5 rounded-2xl bg-rose-950/80 border-2 border-rose-500/80 text-rose-200 text-xs space-y-1 shadow-lg animate-pulse">
              <div class="flex items-center gap-2 font-bold text-rose-300">
                <svg class="w-5 h-5 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
                <span>PAGO EN EFECTIVO NO DISPONIBLE</span>
              </div>
              <p class="text-[11px] leading-relaxed">
                Este número o dirección registra una sanción por <strong>Pedido Fantasma / No recogido</strong>. Por eso ocultamos el pago contra entrega: para continuar debes pagar en línea con <strong>Tarjeta</strong> o <strong>Yape OTP</strong>.
              </p>
            </div>
          } @else if (sancionNoVerificada()) {
            <div class="p-3 rounded-2xl bg-amber-950/60 border border-amber-500/50 text-amber-100 text-[11px] leading-relaxed">
              No pudimos revisar tu historial de pedidos en este momento. Puedes continuar; la validación final del pago en efectivo se hace al registrar el pedido y, si no procede, te lo indicaremos.
            </div>
          }

          <!-- Card 2: MÉTODO DE PAGO -->
          <div class="p-4 rounded-2xl bg-black/25 border border-white/10 space-y-2.5">
            
            <div class="flex items-center gap-2 text-polleria-gold text-xs font-bold uppercase tracking-wider">
              <svg class="w-4 h-4 text-polleria-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
              </svg>
              <span>MÉTODO DE PAGO</span>
            </div>

            <!-- Selector Tabs: Tarjeta vs Yape OTP vs Efectivo -->
            <div class="grid grid-cols-3 gap-2">
              <button 
                type="button"
                (click)="metodoPago.set('TARJETA')"
                class="py-2 px-1.5 rounded-xl border text-[11px] font-bold uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition cursor-pointer"
                [ngClass]="metodoPago() === 'TARJETA' ? 
                  'border-2 border-polleria-gold bg-black/50 text-white shadow-md' : 
                  'border-white/15 bg-black/20 text-white/70 hover:bg-black/30'"
              >
                <span>TARJETA</span>
                <span class="text-[9px] text-white/50">Mercado Pago</span>
              </button>

              <button 
                type="button"
                (click)="metodoPago.set('YAPE_OTP')"
                class="py-2 px-1.5 rounded-xl border text-[11px] font-bold uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition cursor-pointer"
                [ngClass]="metodoPago() === 'YAPE_OTP' ? 
                  'border-2 border-purple-400 bg-purple-950/40 text-purple-200 shadow-md' : 
                  'border-white/15 bg-black/20 text-white/70 hover:bg-black/30'"
              >
                <span>YAPE OTP</span>
                <span class="text-[9px] text-purple-300/60">Pase a Cocina</span>
              </button>

              <button 
                type="button"
                (click)="seleccionarEfectivo()"
                [disabled]="sancionActiva()"
                class="py-2 px-1.5 rounded-xl border text-[11px] font-bold uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                [ngClass]="metodoPago() === 'EFECTIVO_CONTRAENTREGA' ? 
                  'border-2 border-emerald-400 bg-emerald-950/40 text-emerald-200 shadow-md' : 
                  'border-white/15 bg-black/20 text-white/70 hover:bg-black/30'"
              >
                <span>EFECTIVO</span>
                <span class="text-[9px] text-emerald-300/60">{{ tipoPedido() === 'DELIVERY' ? 'En Puerta' : 'En Caja' }}</span>
              </button>
            </div>

            <!-- CONTENIDO ESPECÍFICO SEGÚN MÉTODO -->
            @if (metodoPago() === 'YAPE_OTP') {
              <div class="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/30 space-y-2.5">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-purple-300 uppercase">Pago Inmediato con Yape</span>
                  <span class="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-md font-mono">Sin comisiones</span>
                </div>

                <div class="space-y-1">
                  <label class="text-[11px] font-medium text-purple-200 block">Celular Yape:</label>
                  <input 
                    type="tel" 
                    [(ngModel)]="celularYape" 
                    maxlength="9"
                    placeholder="912345678"
                    class="w-full px-3 py-2 rounded-lg bg-black/40 border border-purple-400/30 text-white font-mono text-xs focus:ring-1 focus:ring-purple-400 outline-none"
                  />
                </div>

                <div class="space-y-1">
                  <div class="flex justify-between items-center text-[11px] text-purple-200">
                    <label class="font-medium">Código de Aprobación (6 dígitos):</label>
                    <span class="text-[10px] text-white/50">App Yape ➔ Menú ➔ Código</span>
                  </div>
                  <input 
                    type="text" 
                    [(ngModel)]="otpYape" 
                    maxlength="6"
                    inputmode="numeric"
                    placeholder="123456"
                    class="w-full px-3 py-2 rounded-lg bg-black/40 border border-purple-400/30 text-white font-mono text-center text-lg tracking-widest font-black focus:ring-1 focus:ring-purple-400 outline-none"
                  />
                </div>
                <p class="text-[10px] text-purple-200/70 leading-tight">
                  Al confirmar, tu pago se procesará en tiempo real con Mercado Pago y pasará <strong>DIRECTO a cocina</strong> sin esperas de validación.
                </p>
              </div>

            } @else if (metodoPago() === 'EFECTIVO_CONTRAENTREGA') {
              <div class="p-3.5 rounded-xl bg-black/30 border border-emerald-500/30 space-y-2.5">
                <span class="text-xs font-bold text-emerald-300 uppercase block">Cobro en Efectivo</span>
                
                <div class="space-y-1">
                  <label class="text-[11px] font-medium text-slate-200 block">¿Con cuánto vas a pagar? (Para llevarte vuelto exacto):</label>
                  <div class="relative">
                    <span class="absolute left-3 top-2 text-xs font-bold text-slate-400">S/</span>
                    <input 
                      type="number" 
                      [(ngModel)]="montoPagaCon" 
                      [min]="totalPagar()"
                      step="5"
                      placeholder="{{ totalPagar() }}"
                      class="w-full pl-8 pr-3 py-2 rounded-lg bg-black/40 border border-white/20 text-white font-mono text-sm focus:ring-1 focus:ring-emerald-400 outline-none"
                    />
                  </div>
                </div>

                <div class="flex items-center justify-between p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-xs">
                  <span class="text-emerald-300">Vuelto que recibirás:</span>
                  <span class="font-bold text-sm text-emerald-400 font-mono">
                    {{ calcularVuelto() | currencyPEN }}
                  </span>
                </div>

                <p class="text-[10px] text-slate-300 leading-tight">
                  📞 <strong>Llamada requerida:</strong> El cajero te llamará en un máximo de <strong>15 minutos</strong> para validar tu pedido y vuelto antes de empezar a cocinar.
                </p>
              </div>

            } @else {
              <!-- TARJETA (MERCADO PAGO) -->
              <div class="p-3 rounded-xl bg-black/20 text-xs text-slate-200 space-y-1">
                <p>Serás redirigido a la pasarela segura de <strong>Mercado Pago</strong> para pagar con tarjeta de débito o crédito.</p>
              </div>
            }

          </div>

        </div>

        <!-- Confirm CTA Pill Button -->
        <div class="pt-4 space-y-2 shrink-0 text-center">
          <button 
            type="button" 
            (click)="confirmOrder()"
            [disabled]="isProcessing() || cart.isEmpty()"
            class="w-full py-3.5 sm:py-4 px-6 rounded-full bg-[#f59e0b] hover:bg-[#fbbf24] active:scale-98 text-slate-950 font-display text-lg sm:text-xl tracking-wider uppercase font-black transition duration-200 shadow-2xl shadow-black/60 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            @if (isProcessing()) {
              <span>PROCESANDO PAGO...</span>
            } @else {
              <span>CONFIRMAR PEDIDO</span>
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
              </svg>
            }
          </button>

          <p class="text-[10px] sm:text-xs font-bold text-white/80 uppercase tracking-widest">
            SAN POLLO • CALIDAD Y PAGO 100% SEGURO
          </p>
        </div>

      </div>

    </div>
  `
})
export class CheckoutComponent implements OnInit {
  readonly cart = inject(CartService);
  private ordersService = inject(OrdersService);
  private paymentService = inject(PaymentService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private notify = inject(NotificationService);

  readonly tipoPedido = signal<OrderType>('DELIVERY');
  readonly metodoPago = signal<PaymentMethod>('TARJETA');
  readonly isProcessing = signal<boolean>(false);
  readonly sancionActiva = signal<boolean>(false);
  /** True when the sanction lookup failed: the customer is neither cleared nor blocked here. */
  readonly sancionNoVerificada = signal<boolean>(false);
  /** Order already created for a Yape OTP attempt, kept so a retry pays the SAME order. */
  private ordenYapePendiente: Order | null = null;

  direccion = '';
  celular = '';
  instrucciones = '';

  // Específico Yape OTP
  celularYape = '';
  otpYape = '';

  // Específico Efectivo
  montoPagaCon: number | null = null;

  readonly totalPagar = computed(() => {
    const envio = this.tipoPedido() === 'DELIVERY' ? this.cart.costoEnvio() : 0;
    return Math.round((this.cart.subtotal() + envio) * 100) / 100;
  });

  ngOnInit(): void {
    const user = this.auth.currentUser();
    this.celular = user?.celular || '';
    this.celularYape = this.celular;

    if (this.celular) {
      this.verificarSancionCliente(this.celular);
    }

    this.route.queryParams.subscribe(params => {
      if (params['status'] === 'failure') {
        this.notify.showError(
          'El pago en Mercado Pago no fue completado',
          'Puedes reintentar el pago con tu tarjeta o elegir otro medio.'
        );
      } else if (params['status'] === 'pending') {
        this.notify.showInfo(
          'Pago en proceso de revisión',
          'Mercado Pago está procesando tu pago. Te notificaremos en cuanto se acredite.'
        );
      }
    });
  }

  onCelularChange(nuevoCelular: string): void {
    let limpio = (nuevoCelular || '').replace(/\D/g, '');
    if (limpio.length === 11 && limpio.startsWith('51')) {
      limpio = limpio.substring(2);
    }
    if (limpio.length === 9) {
      this.celularYape = limpio;
      this.verificarSancionCliente(limpio);
    }
  }

  verificarSancionCliente(telefono: string): void {
    const user = this.auth.currentUser();
    this.auth.verificarSancion(telefono, user?.correo).subscribe({
      next: (resp) => {
        this.sancionNoVerificada.set(false);
        // The server enforces the block when the order is created; this only hides the option.
        if (resp.sancionado || resp.bloqueadoEfectivo || resp.bloqueadoTotal) {
          this.sancionActiva.set(true);
          if (this.metodoPago() === 'EFECTIVO_CONTRAENTREGA') {
            this.metodoPago.set('YAPE_OTP');
          }
        } else {
          this.sancionActiva.set(false);
        }
      },
      error: () => {
        // A failed lookup is not a clean record; any block already known stays.
        this.sancionNoVerificada.set(true);
      }
    });
  }

  seleccionarEfectivo(): void {
    if (this.sancionActiva()) {
      this.notify.showError('Pago en efectivo bloqueado', 'Registras un incidente previo por pedido fantasma.');
      return;
    }
    this.metodoPago.set('EFECTIVO_CONTRAENTREGA');
    if (!this.montoPagaCon) {
      this.montoPagaCon = this.totalPagar();
    }
  }

  calcularVuelto(): number {
    const paga = Number(this.montoPagaCon) || 0;
    const total = this.totalPagar();
    return paga > total ? Math.round((paga - total) * 100) / 100 : 0;
  }

  getSubtotalNeto(): number {
    return Math.round((this.cart.subtotal() * 0.82) * 100) / 100;
  }

  getIgv(): number {
    return Math.round((this.cart.subtotal() * 0.18) * 100) / 100;
  }

  /** Backend message first (`error.error` / `error.message`); never the generic HttpErrorResponse text. */
  private mensajeError(err: unknown, porDefecto: string): string {
    const cuerpo = (err as { error?: unknown })?.error;
    if (typeof cuerpo === 'string' && cuerpo.trim()) return cuerpo;
    if (cuerpo && typeof cuerpo === 'object') {
      const c = cuerpo as { error?: unknown; message?: unknown };
      if (typeof c.error === 'string' && c.error.trim()) return c.error;
      if (typeof c.message === 'string' && c.message.trim()) return c.message;
    }
    if (err instanceof HttpErrorResponse) {
      return porDefecto;
    }
    const mensaje = (err as { message?: unknown })?.message;
    return typeof mensaje === 'string' && mensaje.trim() ? mensaje : porDefecto;
  }

  confirmOrder(): void {
    if (this.tipoPedido() === 'DELIVERY' && !this.direccion.trim()) {
      this.notify.showError('Ingresa la dirección de entrega');
      return;
    }

    const celularLimpio = this.celular.replace(/\D/g, '').replace(/^51(?=\d{9}$)/, '');
    if (!/^9\d{8}$/.test(celularLimpio)) {
      this.notify.showError('Ingresa un celular válido', 'Debe tener 9 dígitos y empezar con 9 (ej. 912345678)');
      return;
    }

    if (this.cart.isEmpty()) {
      this.notify.showError('Tu carrito está vacío');
      return;
    }

    if (this.metodoPago() === 'YAPE_OTP') {
      this.procesarYapeOtp(celularLimpio);
      return;
    }

    if (this.metodoPago() === 'TARJETA') {
      this.procesarMercadoPagoTarjeta(celularLimpio);
      return;
    }

    if (this.metodoPago() === 'EFECTIVO_CONTRAENTREGA') {
      this.procesarContraPago(celularLimpio);
    }
  }

  private procesarYapeOtp(celularCliente: string): void {
    const yapeTel = this.celularYape.replace(/\D/g, '');
    if (!/^9\d{8}$/.test(yapeTel)) {
      this.notify.showError('Celular Yape inválido', 'Debe ser un número de 9 dígitos');
      return;
    }

    const otp = (this.otpYape || '').trim();
    if (!/^\d{6}$/.test(otp)) {
      this.notify.showError('Código OTP inválido', 'El código de aprobación de Yape debe tener exactamente 6 dígitos');
      return;
    }

    this.isProcessing.set(true);
    const currentUser = this.auth.currentUser();

    const orderData: Order = {
      id: '0',
      codigoSeguimiento: '',
      cliente: {
        nombre: currentUser?.nombre || 'Cliente San Pollo',
        celular: celularCliente,
        correo: currentUser?.correo,
        direccion: this.tipoPedido() === 'DELIVERY' ? this.direccion : 'Recojo en Tienda San Pollo Principal',
        referencia: this.instrucciones
      },
      items: [...this.cart.items()],
      tipo: this.tipoPedido(),
      estado: 'RECIBIDO',
      metodoPago: 'YAPE_OTP',
      subtotal: this.cart.subtotal(),
      costoEnvio: this.tipoPedido() === 'DELIVERY' ? this.cart.costoEnvio() : 0,
      descuento: 0,
      total: this.totalPagar(),
      notasGenerales: this.instrucciones,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Retry after a rejected OTP: pay the SAME order, never create a second one.
    if (this.ordenYapePendiente) {
      this.pagarYape(this.ordenYapePendiente, yapeTel, otp, currentUser?.correo);
      return;
    }

    this.ordersService.createOrder(orderData).subscribe({
      next: (createdOrder) => {
        this.ordenYapePendiente = createdOrder;
        this.pagarYape(createdOrder, yapeTel, otp, currentUser?.correo);
      },
      error: (err) => {
        this.isProcessing.set(false);
        this.notify.showError('No se pudo registrar la orden', this.mensajeError(err, 'Intenta nuevamente.'));
      }
    });
  }

  private pagarYape(createdOrder: Order, yapeTel: string, otp: string, correo?: string): void {
    const realOrderId = typeof createdOrder.id === 'number'
      ? createdOrder.id
      : parseInt(String(createdOrder.id).replace('ord-', ''), 10) || 1;

    this.paymentService.pagarConYapeOtp(realOrderId, createdOrder.total, yapeTel, otp, correo).subscribe({
      next: (tx) => {
        this.isProcessing.set(false);
        if (tx.estado === 'APROBADO') {
          this.ordenYapePendiente = null;
          this.cart.clearCart();
          this.notify.showSuccess('¡Pago Yape aprobado!', 'Tu pedido ingresó directo a preparación en cocina.');
          this.router.navigate(['/tracking'], { queryParams: { code: createdOrder.codigoSeguimiento } });
        } else {
          // Not approved: keep the cart and the created order so the OTP can be retried.
          this.otpYape = '';
          this.notify.showError('Código Yape no válido', tx.numeroOperacion || 'Verifica el código en tu app e intenta de nuevo.');
        }
      },
      error: (err) => {
        this.isProcessing.set(false);
        this.otpYape = '';
        this.notify.showError('Pago Yape rechazado', this.mensajeError(err, 'Verifica el código e intenta nuevamente.'));
      }
    });
  }

  private procesarMercadoPagoTarjeta(celularCliente: string): void {
    this.isProcessing.set(true);
    const currentUser = this.auth.currentUser();

    const orderData: Order = {
      id: '0',
      codigoSeguimiento: '',
      cliente: {
        nombre: currentUser?.nombre || 'Cliente San Pollo',
        celular: celularCliente,
        correo: currentUser?.correo,
        direccion: this.tipoPedido() === 'DELIVERY' ? this.direccion : 'Recojo en Tienda San Pollo Principal',
        referencia: this.instrucciones
      },
      items: [...this.cart.items()],
      tipo: this.tipoPedido(),
      estado: 'RECIBIDO',
      metodoPago: 'TARJETA',
      subtotal: this.cart.subtotal(),
      costoEnvio: this.tipoPedido() === 'DELIVERY' ? this.cart.costoEnvio() : 0,
      descuento: 0,
      total: this.totalPagar(),
      notasGenerales: this.instrucciones,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.ordersService.createOrder(orderData).subscribe({
      next: (createdOrder) => {
        const realOrderId = typeof createdOrder.id === 'number'
          ? createdOrder.id
          : parseInt(String(createdOrder.id).replace('ord-', ''), 10) || 1;

        this.paymentService.crearPreferenciaMercadoPago(realOrderId, createdOrder.total).subscribe({
          next: (pref) => {
            this.isProcessing.set(false);
            const redirectUrl = pref.sandboxInitPoint || pref.initPoint;
            if (redirectUrl) {
              this.notify.showSuccess('¡Redirigiendo a Mercado Pago...');
              setTimeout(() => {
                window.location.href = redirectUrl;
              }, 800);
            } else {
              this.notify.showError(
                'Mercado Pago no devolvió el enlace de pago',
                'Tu pedido quedó registrado, pero no pudimos iniciar el pago. Intenta de nuevo o elige otro medio.'
              );
            }
          },
          error: (err) => {
            this.isProcessing.set(false);
            this.notify.showError('No se pudo conectar con Mercado Pago', this.mensajeError(err, 'Intenta nuevamente.'));
          }
        });
      },
      error: (err) => {
        this.isProcessing.set(false);
        this.notify.showError('No se pudo registrar la orden', this.mensajeError(err, 'Intenta nuevamente.'));
      }
    });
  }

  private procesarContraPago(celularCliente: string): void {
    if (this.sancionActiva()) {
      this.notify.showError('Pago en efectivo bloqueado', 'Debes pagar con un método digital.');
      return;
    }

    const paga = Number(this.montoPagaCon) || this.totalPagar();
    if (paga < this.totalPagar()) {
      this.notify.showError('Monto de pago insuficiente', `El monto debe ser al menos de S/ ${this.totalPagar().toFixed(2)}`);
      return;
    }

    this.isProcessing.set(true);
    const currentUser = this.auth.currentUser();

    const orderData: Order = {
      id: '0',
      codigoSeguimiento: '',
      cliente: {
        nombre: currentUser?.nombre || 'Cliente San Pollo',
        celular: celularCliente,
        correo: currentUser?.correo,
        direccion: this.tipoPedido() === 'DELIVERY' ? this.direccion : 'Recojo en Tienda San Pollo Principal',
        referencia: this.instrucciones
      },
      items: [...this.cart.items()],
      tipo: this.tipoPedido(),
      estado: 'PENDIENTE_CONFIRMACION',
      metodoPago: 'EFECTIVO_CONTRAENTREGA',
      subtotal: this.cart.subtotal(),
      costoEnvio: this.tipoPedido() === 'DELIVERY' ? this.cart.costoEnvio() : 0,
      descuento: 0,
      total: this.totalPagar(),
      notasGenerales: this.instrucciones,
      montoPagaCon: paga,
      vueltoEstimado: this.calcularVuelto(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.ordersService.createOrder(orderData).subscribe({
      next: (createdOrder) => {
        this.paymentService.iniciarPago(createdOrder.id, createdOrder.total, 'EFECTIVO_CONTRAENTREGA', celularCliente).subscribe({
          next: () => {
            this.cart.clearCart();
            this.isProcessing.set(false);
            this.notify.showSuccess(
              `¡${etiquetaPedido(createdOrder)} registrado!`,
              'Te llamaremos en breve al ' + celularCliente + ' para confirmar tu pedido y vuelto.'
            );
            this.router.navigate(['/tracking'], { queryParams: { code: createdOrder.codigoSeguimiento } });
          },
          error: (err) => {
            // Keep the cart and stay here: the registration did not succeed.
            this.isProcessing.set(false);
            this.notify.showError('No se pudo registrar el pedido contra entrega', this.mensajeError(err, 'Intenta nuevamente.'));
          }
        });
      },
      error: (err) => {
        this.isProcessing.set(false);
        this.notify.showError('No se pudo registrar la orden', this.mensajeError(err, 'Intenta nuevamente.'));
      }
    });
  }
}
