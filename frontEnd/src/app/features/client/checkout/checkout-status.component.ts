import { Component, inject, signal, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PaymentService } from '../../../core/services/payment.service';
import { OrdersService } from '../../../core/services/orders.service';
import { CartService } from '../../../core/services/cart.service';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { Observable, Subscription, catchError, interval, map, of } from 'rxjs';

type StatusType = 'SUCCESS' | 'FAILURE' | 'PENDING';

const MAX_INTENTOS_POLLING = 20;

@Component({
  selector: 'app-checkout-status',
  standalone: true,
  imports: [CommonModule, RouterModule, CurrencyPENPipe],
  template: `
    <div class="min-h-screen bg-[#0f1013] text-white flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans selection:bg-polleria-gold selection:text-slate-900">
      
      <!-- Ambient Glow Background -->
      <div class="absolute inset-0 bg-radial-vignette pointer-events-none opacity-60"></div>
      <div 
        class="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[350px] rounded-full blur-3xl pointer-events-none transition-colors duration-500"
        [ngClass]="{
          'bg-emerald-500/10': currentStatus() === 'SUCCESS',
          'bg-rose-500/10': currentStatus() === 'FAILURE',
          'bg-amber-500/10': currentStatus() === 'PENDING'
        }"
      ></div>

      <!-- Main Status Card -->
      <div class="max-w-md w-full bg-[#181a1e]/90 p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-xl relative z-10 text-center space-y-6 animate-scale-up">
        
        <!-- Logo Header -->
        <div class="space-y-1">
          <h2 class="font-display text-2xl font-black text-polleria-gold tracking-widest uppercase">
            EL SAN POLLO
          </h2>
          <p class="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
            Pasarela de Pago Mercado Pago
          </p>
        </div>

        <!-- ================= CASO 1: SUCCESS ================= -->
        @if (currentStatus() === 'SUCCESS') {
          <div class="space-y-5">
            <!-- Icon Badge -->
            <div class="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 animate-bounce">
              <svg class="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
              </svg>
            </div>

            <!-- Titles -->
            <div class="space-y-1.5">
              <h1 class="font-display text-2xl sm:text-3xl font-black text-white uppercase tracking-wide">
                ¡PAGO APROBADO!
              </h1>
              <p class="text-xs text-slate-300">
                Tu pago ha sido procesado exitosamente por Mercado Pago y tu pedido ya está siendo preparado en cocina.
              </p>
            </div>

            <!-- Receipt Info Box -->
            <div class="bg-black/40 rounded-2xl p-4 border border-white/10 text-left space-y-2.5 text-xs font-mono">
              @if (trackingCode()) {
                <div class="flex justify-between items-center pb-2 border-b border-white/10">
                  <span class="text-slate-400 font-sans text-[11px]">Código de Pedido</span>
                  <span class="font-bold text-polleria-gold text-sm tracking-wider">{{ trackingCode() }}</span>
                </div>
              }
              @if (paymentId()) {
                <div class="flex justify-between items-center text-[11px]">
                  <span class="text-slate-400 font-sans">Operación MP</span>
                  <span class="text-white">{{ paymentId() }}</span>
                </div>
              }
              @if (orderTotal()) {
                <div class="flex justify-between items-center text-[11px]">
                  <span class="text-slate-400 font-sans">Monto Total</span>
                  <span class="text-emerald-400 font-bold font-sans text-sm">{{ orderTotal() | currencyPEN }}</span>
                </div>
              }
            </div>

            <!-- Action Buttons -->
            <div class="space-y-2.5 pt-2">
              <a 
                [routerLink]="['/tracking']" 
                [queryParams]="trackingCode() ? { code: trackingCode() } : null"
                class="w-full py-3.5 px-4 rounded-xl bg-polleria-gold hover:bg-amber-400 active:scale-98 text-slate-950 font-display text-sm tracking-wider uppercase font-black transition duration-200 shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>VER SEGUIMIENTO EN VIVO</span>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                </svg>
              </a>

              <p class="text-[11px] text-slate-400">
                Redirigiendo al seguimiento en <span class="font-bold text-polleria-gold">{{ countdown() }}s</span>...
              </p>
            </div>
          </div>
        }

        <!-- ================= CASO 2: FAILURE ================= -->
        @if (currentStatus() === 'FAILURE') {
          <div class="space-y-5">
            <!-- Icon Badge -->
            <div class="w-20 h-20 mx-auto rounded-full bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <svg class="w-10 h-10 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </div>

            <!-- Titles -->
            <div class="space-y-1.5">
              <h1 class="font-display text-2xl sm:text-3xl font-black text-white uppercase tracking-wide">
                PAGO NO COMPLETADO
              </h1>
              <p class="text-xs text-slate-300">
                El pago fue rechazado o cancelado. No se ha realizado ningún cobro a tu tarjeta. Puedes intentar nuevamente con otra tarjeta o elegir pago contraentrega.
              </p>
            </div>

            <!-- Detail Box -->
            <div class="bg-black/40 rounded-2xl p-4 border border-rose-500/20 text-xs text-left space-y-2">
              <div class="flex items-center gap-2 text-rose-300 font-bold uppercase text-[10px]">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span>Motivo sugerido</span>
              </div>
              <p class="text-[11px] text-slate-300 leading-relaxed">
                Fondos insuficientes, datos de seguridad incorrectos o transacción rechazada por el banco emisor.
              </p>
            </div>

            <!-- Action Buttons -->
            <div class="space-y-2.5 pt-2">
              <a 
                routerLink="/checkout" 
                [queryParams]="{ status: 'failure' }"
                class="w-full py-3.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-98 text-white font-display text-sm tracking-wider uppercase font-black transition duration-200 shadow-xl shadow-rose-600/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>REINTENTAR EN CHECKOUT</span>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
              </a>

              <a 
                routerLink="/menu" 
                class="inline-block text-xs font-bold text-slate-400 hover:text-white transition tracking-wider uppercase py-1"
              >
                VOLVER AL MENÚ
              </a>
            </div>
          </div>
        }

        <!-- ================= CASO 3: PENDING ================= -->
        @if (currentStatus() === 'PENDING') {
          <div class="space-y-5">
            <!-- Icon Badge Spinner -->
            <div class="w-20 h-20 mx-auto rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <svg class="w-10 h-10 text-amber-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>

            <!-- Titles -->
            <div class="space-y-1.5">
              <h1 class="font-display text-2xl sm:text-3xl font-black text-white uppercase tracking-wide">
                PAGO EN PROCESO
              </h1>
              <p class="text-xs text-slate-300">
                Mercado Pago está procesando y validando la acreditación de tu dinero. Comprobando estado automáticamente...
              </p>
            </div>

            <!-- Polling Pulse Card -->
            <div class="bg-black/40 rounded-2xl p-4 border border-amber-500/20 text-xs text-left space-y-2 font-mono">
              <div class="flex items-center justify-between text-[11px]">
                <span class="text-slate-400 font-sans">Estado de verificación</span>
                @if (pollingAgotado()) {
                  <span class="text-amber-400 font-bold">Sigue pendiente</span>
                } @else {
                  <span class="inline-flex items-center gap-1.5 text-amber-400 font-bold">
                    <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                    Consultando...
                  </span>
                }
              </div>
              @if (pollingAgotado()) {
                <p class="text-[11px] text-amber-200 font-sans leading-relaxed" role="status">
                  Tu pago todavía no fue confirmado. Revisa el estado de tu pedido en el seguimiento: te avisaremos cuando se acredite.
                </p>
              }
              @if (trackingCode()) {
                <div class="flex justify-between items-center text-[11px] pt-1 border-t border-white/10">
                  <span class="text-slate-400 font-sans">Código de Orden</span>
                  <span class="text-white">{{ trackingCode() }}</span>
                </div>
              }
            </div>

            <!-- Action Buttons -->
            <div class="space-y-2.5 pt-2">
              <a 
                [routerLink]="['/tracking']" 
                [queryParams]="trackingCode() ? { code: trackingCode() } : null"
                class="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-98 text-slate-950 font-display text-sm tracking-wider uppercase font-black transition duration-200 shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>VER SEGUIMIENTO DEL PEDIDO</span>
              </a>

              <a 
                routerLink="/" 
                class="inline-block text-xs font-bold text-slate-400 hover:text-white transition tracking-wider uppercase py-1"
              >
                VOLVER AL INICIO
              </a>
            </div>
          </div>
        }

      </div>
    </div>
  `
})
export class CheckoutStatusComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private paymentService = inject(PaymentService);
  private ordersService = inject(OrdersService);
  private cartService = inject(CartService);
  private platformId = inject(PLATFORM_ID);

  /** Never SUCCESS until the backend confirms the payment. */
  readonly currentStatus = signal<StatusType>('PENDING');
  /** True once polling hit its attempt limit while the payment was still not approved. */
  readonly pollingAgotado = signal<boolean>(false);
  readonly trackingCode = signal<string>('');
  readonly paymentId = signal<string>('');
  readonly orderTotal = signal<number>(0);
  readonly countdown = signal<number>(6);

  private pollingSub?: Subscription;
  private countdownSub?: Subscription;
  private pagoId?: number;

  ngOnInit(): void {
    const url = this.router.url;

    // Detectar estado basado en la ruta y en los query params de Mercado Pago
    this.route.queryParams.subscribe(params => {
      const mpStatus = params['collection_status'] || params['status'];
      const extRef = params['external_reference'];
      const pId = params['payment_id'] || params['collection_id'];

      if (pId) {
        this.paymentId.set(String(pId));
      }

      if (extRef && !isNaN(Number(extRef))) {
        this.pagoId = Number(extRef);
      }

      // The URL / Mercado Pago params are only a hint: the backend decides the final state.
      const pistaFallo = url.includes('/failure') || mpStatus === 'rejected';
      this.currentStatus.set(pistaFallo ? 'FAILURE' : 'PENDING');

      this.resolverDatosPedido();
      this.verificarEstado(pistaFallo);
    });
  }

  /** Asks the backend for the real state; keeps polling while it is not final. */
  private verificarEstado(pistaFallo: boolean): void {
    this.pollingSub?.unsubscribe();
    this.pollingAgotado.set(false);
    this.consultarEstado().subscribe(resultado => {
      this.aplicarResultado(resultado, pistaFallo);
      if (this.currentStatus() === 'PENDING') {
        this.iniciarPollingPendiente();
      }
    });
  }

  private consultarEstado(): Observable<StatusType | null> {
    if (this.pagoId) {
      return this.paymentService.obtener(this.pagoId).pipe(
        map(tx => {
          if (!tx) return null;
          if (tx.estado === 'APROBADO') return 'SUCCESS';
          if (tx.estado === 'RECHAZADO' || tx.estado === 'CANCELADO') return 'FAILURE';
          return 'PENDING';
        }),
        catchError(() => of(null))
      );
    }
    const codigo = this.trackingCode();
    if (!codigo) return of(null);
    return this.ordersService.getOrderByTrackingCode(codigo).pipe(
      map(ord => {
        if (!ord) return null;
        if (ord.estado === 'CANCELADO' || ord.estado === 'PEDIDO_FANTASMA') return 'FAILURE';
        if (ord.estado === 'PENDIENTE_PAGO' || ord.estado === 'PENDIENTE_CONFIRMACION' || ord.estado === 'RECIBIDO') {
          return 'PENDING';
        }
        return 'SUCCESS';
      }),
      catchError(() => of(null))
    );
  }

  private aplicarResultado(resultado: StatusType | null, pistaFallo = false): void {
    if (resultado === 'SUCCESS') {
      this.pollingSub?.unsubscribe();
      if (this.currentStatus() !== 'SUCCESS') {
        this.currentStatus.set('SUCCESS');
        this.cartService.clearCart();
        this.iniciarCountdownRedireccion();
      }
    } else if (resultado === 'FAILURE') {
      this.pollingSub?.unsubscribe();
      this.currentStatus.set('FAILURE');
    } else if (resultado === 'PENDING') {
      this.currentStatus.set('PENDING');
    } else if (!pistaFallo && this.currentStatus() !== 'PENDING') {
      this.currentStatus.set('PENDING');
    }
  }

  ngOnDestroy(): void {
    this.pollingSub?.unsubscribe();
    this.countdownSub?.unsubscribe();
  }

  private resolverDatosPedido(): void {
    // 1. Intentar leer desde localStorage
    if (isPlatformBrowser(this.platformId) && window.localStorage) {
      try {
        const raw = localStorage.getItem('sanpollo_last_order');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.code) this.trackingCode.set(parsed.code);
          if (parsed.total) this.orderTotal.set(parsed.total);
        }
      } catch (e) {
        console.warn('Error leyendo orden de localStorage:', e);
      }
    }

    // 2. Si hay pagoId pero no código, consultar al microservicio de pagos
    if (!this.trackingCode() && this.pagoId) {
      this.paymentService.obtener(this.pagoId).subscribe({
        next: (tx) => {
          if (tx && tx.orderId) {
            this.ordersService.getOrderByTrackingCode(tx.orderId).subscribe({
              next: (ord) => {
                if (ord) {
                  this.trackingCode.set(ord.codigoSeguimiento);
                  this.orderTotal.set(ord.total);
                }
              }
            });
          }
        }
      });
    }
  }

  private iniciarCountdownRedireccion(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.countdownSub = interval(1000).subscribe(() => {
      const actual = this.countdown();
      if (actual <= 1) {
        this.countdownSub?.unsubscribe();
        this.router.navigate(['/tracking'], {
          queryParams: this.trackingCode() ? { code: this.trackingCode() } : undefined
        });
      } else {
        this.countdown.set(actual - 1);
      }
    });
  }

  private iniciarPollingPendiente(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.pollingSub?.unsubscribe();
    let intentos = 0;
    this.pollingSub = interval(3000).subscribe(() => {
      intentos++;
      if (intentos > MAX_INTENTOS_POLLING) {
        this.pollingSub?.unsubscribe();
        this.pollingAgotado.set(true);
        return;
      }
      this.consultarEstado().subscribe(resultado => this.aplicarResultado(resultado));
    });
  }
}
