import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CartService } from '../../../core/services/cart.service';

type ResultType = 'success' | 'failure' | 'pending';

@Component({
  selector: 'app-checkout-result',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-white px-4">
      <div class="max-w-sm w-full text-center space-y-6">

        @if (type === 'success') {
          <div class="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <svg class="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <div>
            <h1 class="text-2xl font-black text-slate-900 uppercase tracking-wide">¡Pago aprobado!</h1>
            <p class="text-slate-500 text-sm mt-1">Tu pedido está confirmado y en preparación.</p>
          </div>
          <button
            (click)="irATracking()"
            class="w-full py-3 rounded-full bg-[#7a0513] text-white font-bold text-sm uppercase tracking-wider hover:bg-[#a81125] transition"
          >
            Ver estado del pedido
          </button>
        }

        @if (type === 'pending') {
          <div class="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
            <svg class="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div>
            <h1 class="text-2xl font-black text-slate-900 uppercase tracking-wide">Pago pendiente</h1>
            <p class="text-slate-500 text-sm mt-1">Mercado Pago está procesando tu pago. Te avisaremos por WhatsApp cuando se confirme.</p>
          </div>
          <button
            (click)="irATracking()"
            class="w-full py-3 rounded-full bg-[#7a0513] text-white font-bold text-sm uppercase tracking-wider hover:bg-[#a81125] transition"
          >
            Ver estado del pedido
          </button>
          <a routerLink="/menu" class="block text-xs text-slate-400 hover:text-slate-600 transition">Volver al menú</a>
        }

        @if (type === 'failure') {
          <div class="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            <svg class="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </div>
          <div>
            <h1 class="text-2xl font-black text-slate-900 uppercase tracking-wide">Pago rechazado</h1>
            <p class="text-slate-500 text-sm mt-1">El pago no fue aprobado. Puedes intentar con otro método.</p>
          </div>
          <a
            routerLink="/checkout"
            class="block w-full py-3 rounded-full bg-[#7a0513] text-white font-bold text-sm uppercase tracking-wider text-center hover:bg-[#a81125] transition"
          >
            Reintentar pago
          </a>
          <a routerLink="/menu" class="block text-xs text-slate-400 hover:text-slate-600 transition">Volver al menú</a>
        }

      </div>
    </div>
  `
})
export class CheckoutResultComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cart = inject(CartService);

  type: ResultType = 'success';

  ngOnInit(): void {
    const segment = this.route.snapshot.url[1]?.path as ResultType;
    this.type = segment ?? 'success';

    if (this.type === 'success') {
      this.cart.clearCart();
    }
  }

  irATracking(): void {
    const code = sessionStorage.getItem('mp_codigo_seguimiento');
    sessionStorage.removeItem('mp_codigo_seguimiento');
    sessionStorage.removeItem('mp_orden_id');

    if (code) {
      this.router.navigate(['/tracking'], { queryParams: { code } });
    } else {
      this.router.navigate(['/tracking']);
    }
  }
}
