import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CartService } from '../../../core/services/cart.service';
import { OrdersService } from '../../../core/services/orders.service';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { NotificationService } from '../../../core/services/notification.service';
import { Order, PaymentMethod } from '../../../core/models/order.model';
import { ProductsService } from '../../../core/services/products.service';
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
            <span>Delivery</span>
            <span class="font-semibold text-slate-900">{{ cart.costoEnvio() | currencyPEN }}</span>
          </div>

          <!-- TOTAL A PAGAR -->
          <div class="pt-2 border-t border-slate-200 flex items-baseline justify-between">
            <span class="font-bold text-xs sm:text-sm uppercase tracking-widest text-slate-900">
              TOTAL A PAGAR
            </span>
            <span class="font-display text-3xl sm:text-4xl font-black text-polleria-crimson tracking-tight">
              {{ cart.total() | currencyPEN }}
            </span>
          </div>
        </div>

      </div>


      <!-- ================= RIGHT COLUMN: DETALLES DE PAGO ================= -->
      <div class="lg:w-1/2 p-4 sm:p-6 lg:p-8 bg-[#7a0513] text-white flex flex-col justify-between h-full lg:overflow-y-auto shadow-2xl">
        
        <div class="space-y-4">
          
          <!-- Title -->
          <h2 class="font-display text-3xl sm:text-4xl font-black uppercase text-white tracking-wide leading-none">
            DETALLES DE PAGO
          </h2>

          <!-- Card 1: ENTREGA -->
          <div class="p-4 rounded-2xl bg-black/25 border border-white/10 space-y-2.5">
            
            <div class="flex items-center gap-2 text-polleria-gold text-xs font-bold uppercase tracking-wider">
              <svg class="w-4 h-4 text-polleria-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              <span>ENTREGA</span>
            </div>

            <!-- Input Dirección -->
            <input 
              type="text" 
              [(ngModel)]="direccion" 
              placeholder="Av. Larco 1234, Miraflores"
              class="w-full px-3.5 py-2.5 rounded-xl bg-black/30 border border-white/15 text-white placeholder:text-white/50 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-polleria-gold transition"
            />

            <!-- Input Instrucciones Especiales -->
            <input 
              type="text" 
              [(ngModel)]="instrucciones" 
              placeholder="Instrucciones especiales (ej. Timbre 301)"
              class="w-full px-3.5 py-2.5 rounded-xl bg-black/30 border border-white/15 text-white placeholder:text-white/50 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-polleria-gold transition"
            />
          </div>

          <!-- Card 2: MÉTODO DE PAGO -->
          <div class="p-4 rounded-2xl bg-black/25 border border-white/10 space-y-2.5">
            
            <div class="flex items-center gap-2 text-polleria-gold text-xs font-bold uppercase tracking-wider">
              <svg class="w-4 h-4 text-polleria-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
              </svg>
              <span>MÉTODO DE PAGO</span>
            </div>

            <!-- Selector Tabs: Tarjeta vs Efectivo -->
            <div class="grid grid-cols-2 gap-2.5">
              <button 
                type="button"
                (click)="metodoPago.set('TARJETA')"
                class="py-2.5 px-3 rounded-xl border text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer"
                [ngClass]="metodoPago() === 'TARJETA' ? 
                  'border-2 border-polleria-gold bg-black/40 text-white shadow-md' : 
                  'border-white/15 bg-black/20 text-white/70 hover:bg-black/30'"
              >
                <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
                </svg>
                <span>TARJETA</span>
              </button>

              <button 
                type="button"
                (click)="metodoPago.set('EFECTIVO_CONTRAENTREGA')"
                class="py-2.5 px-3 rounded-xl border text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer"
                [ngClass]="metodoPago() === 'EFECTIVO_CONTRAENTREGA' ? 
                  'border-2 border-polleria-gold bg-black/40 text-white shadow-md' : 
                  'border-white/15 bg-black/20 text-white/70 hover:bg-black/30'"
              >
                <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
                </svg>
                <span>EFECTIVO</span>
              </button>
            </div>

            @if (metodoPago() === 'TARJETA') {
              <!-- Input Número de Tarjeta -->
              <div class="space-y-1 pt-0.5">
                <label class="block text-[10px] font-bold uppercase text-white/70 tracking-wider">
                  NÚMERO DE TARJETA
                </label>
                <div class="relative flex items-center">
                  <input 
                    type="text" 
                    [(ngModel)]="numeroTarjeta" 
                    placeholder="•••• •••• •••• ••••"
                    maxlength="19"
                    class="w-full px-3.5 py-2 pr-10 rounded-xl bg-black/30 border border-white/15 text-white placeholder:text-white/40 text-xs sm:text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-polleria-gold transition"
                  />
                  <span class="absolute right-3 text-white/60">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
                    </svg>
                  </span>
                </div>
              </div>

              <!-- Grid Vencimiento y CVV -->
              <div class="grid grid-cols-2 gap-2.5 pt-0.5">
                <div class="space-y-1">
                  <label class="block text-[10px] font-bold uppercase text-white/70 tracking-wider">
                    VENCIMIENTO
                  </label>
                  <input 
                    type="text" 
                    [(ngModel)]="vencimiento" 
                    placeholder="MM/YY"
                    maxlength="5"
                    class="w-full px-3.5 py-2 rounded-xl bg-black/30 border border-white/15 text-white placeholder:text-white/40 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-polleria-gold transition"
                  />
                </div>

                <div class="space-y-1">
                  <label class="block text-[10px] font-bold uppercase text-white/70 tracking-wider">
                    CVV
                  </label>
                  <input 
                    type="password" 
                    [(ngModel)]="cvv" 
                    placeholder="123"
                    maxlength="4"
                    class="w-full px-3.5 py-2 rounded-xl bg-black/30 border border-white/15 text-white placeholder:text-white/40 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-polleria-gold transition"
                  />
                </div>
              </div>
            } @else {
              <div class="p-3 rounded-xl bg-black/20 text-xs text-slate-200">
                Pagas al repartidor en efectivo al recibir tu pedido en la puerta.
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
            PAGO 100% SEGURO
          </p>
        </div>

      </div>

    </div>
  `
})
export class CheckoutComponent implements OnInit {
  readonly cart = inject(CartService);
  private ordersService = inject(OrdersService);
  private productsService = inject(ProductsService);
  private paymentService = inject(PaymentService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private notify = inject(NotificationService);

  readonly metodoPago = signal<PaymentMethod>('TARJETA');
  readonly isProcessing = signal<boolean>(false);

  direccion = 'Av. Larco 1234, Miraflores';
  instrucciones = 'Instrucciones especiales (ej. Timbre 301)';
  numeroTarjeta = '4557 8890 1234 5678';
  vencimiento = '12/28';
  cvv = '882';

  ngOnInit(): void {
    if (this.cart.isEmpty()) {
      const p1 = this.productsService.products().find(p => p.id === '1' || p.id === 'prod-1');
      const p6 = this.productsService.products().find(p => p.id === '6' || p.id === 'prod-6');
      const p8 = this.productsService.products().find(p => p.id === '8' || p.id === 'prod-8');
      if (p1) this.cart.addItem(p1, 1);
      if (p6) this.cart.addItem(p6, 1);
      if (p8) this.cart.addItem(p8, 1);
    }
  }

  getSubtotalNeto(): number {
    return Math.round((this.cart.subtotal() * 0.82) * 100) / 100;
  }

  getIgv(): number {
    return Math.round((this.cart.subtotal() * 0.18) * 100) / 100;
  }

  confirmOrder(): void {
    if (!this.direccion) {
      this.notify.showError('Por favor ingresa la dirección de entrega');
      return;
    }

    if (this.cart.isEmpty()) {
      this.notify.showError('Tu carrito está vacío');
      return;
    }

    this.isProcessing.set(true);

    const currentUser = this.auth.currentUser();
    const clienteNombre = currentUser?.nombre || 'Cliente San Pollo';
    const clienteCelular = currentUser?.celular || '987654321';

    const orderData: Order = {
      id: '0',
      codigoSeguimiento: '',
      cliente: {
        nombre: clienteNombre,
        celular: clienteCelular,
        correo: currentUser?.correo,
        direccion: this.direccion,
        referencia: this.instrucciones
      },
      items: [...this.cart.items()],
      tipo: 'DELIVERY',
      estado: 'EN_PREPARACION',
      metodoPago: this.metodoPago(),
      subtotal: this.cart.subtotal(),
      costoEnvio: this.cart.costoEnvio(),
      descuento: this.cart.descuento(),
      total: this.cart.total(),
      notasGenerales: this.instrucciones,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.ordersService.createOrder(orderData).subscribe({
      next: (createdOrder) => {
        this.paymentService.iniciarPago(createdOrder.id, createdOrder.total, this.metodoPago()).subscribe({
          next: () => {
            this.cart.clearCart();
            this.isProcessing.set(false);
            this.notify.showSuccess(`¡Pedido ${createdOrder.codigoSeguimiento} confirmado y pagado!`);
            this.router.navigate(['/tracking'], { queryParams: { code: createdOrder.codigoSeguimiento } });
          },
          error: () => {
            this.cart.clearCart();
            this.isProcessing.set(false);
            this.router.navigate(['/tracking'], { queryParams: { code: createdOrder.codigoSeguimiento } });
          }
        });
      },
      error: () => {
        this.isProcessing.set(false);
        this.notify.showError('Hubo un problema al procesar el pedido. Intenta nuevamente.');
      }
    });
  }
}
