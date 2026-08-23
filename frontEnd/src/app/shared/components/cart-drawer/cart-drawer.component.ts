import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { CartService } from '../../../core/services/cart.service';
import { CurrencyPENPipe } from '../../pipes/currency-pen.pipe';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-cart-drawer',
  standalone: true,
  imports: [CommonModule, RouterModule, CurrencyPENPipe],
  template: `
    <!-- Backdrop -->
    @if (cart.isCartOpen()) {
      <div 
        class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 transition-opacity duration-300 animate-fade-in"
        (click)="cart.toggleCartDrawer(false)"
      ></div>
    }

    <!-- Slide-over Drawer Panel -->
    <div 
      class="fixed inset-y-0 right-0 max-w-full flex pl-10 z-50 pointer-events-none transition-transform duration-300 ease-in-out"
      [ngClass]="cart.isCartOpen() ? 'translate-x-0' : 'translate-x-full'"
    >
      <div class="w-screen max-w-md bg-white shadow-2xl flex flex-col pointer-events-auto border-l border-slate-200">
        
        <!-- Header -->
        <div class="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
              </svg>
            </div>
            <div>
              <h2 class="font-bold text-lg leading-tight">Tu Pedido</h2>
              <p class="text-xs text-slate-400">{{ cart.totalItems() }} productos seleccionados</p>
            </div>
          </div>

          <button 
            type="button" 
            (click)="cart.toggleCartDrawer(false)"
            class="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Body / Items list -->
        <div class="flex-1 overflow-y-auto p-5 space-y-4">
          @if (cart.isEmpty()) {
            <div class="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <div class="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
                </svg>
              </div>
              <h3 class="font-bold text-slate-700 text-base mb-1">Tu carrito está vacío</h3>
              <p class="text-xs max-w-xs text-slate-500 mb-6">
                Añade un delicioso pollo a la brasa, combos o guarniciones para empezar.
              </p>
              <button 
                (click)="cart.toggleCartDrawer(false); router.navigate(['/menu'])"
                class="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-xl transition shadow-md shadow-brand-500/20"
              >
                Ver la Carta
              </button>
            </div>
          } @else {
            @for (item of cart.items(); track item.product.id) {
              <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex gap-3 group hover:border-brand-300 transition">
                <img 
                  [src]="item.product.imagenUrl" 
                  [alt]="item.product.nombre"
                  class="w-20 h-20 rounded-xl object-cover shrink-0 border border-slate-200"
                />

                <div class="flex-1 flex flex-col justify-between">
                  <div>
                    <div class="flex justify-between items-start gap-1">
                      <h4 class="font-bold text-sm text-slate-900 leading-snug line-clamp-1">
                        {{ item.product.nombre }}
                      </h4>
                      <button 
                        (click)="cart.removeItem(item.product.id)"
                        class="text-slate-400 hover:text-rose-500 transition p-0.5 cursor-pointer"
                        title="Eliminar"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </div>

                    @if (item.notas) {
                      <p class="text-xs text-slate-500 italic mt-0.5 line-clamp-1">
                        Nota: {{ item.notas }}
                      </p>
                    }
                  </div>

                  <div class="flex justify-between items-center mt-2">
                    <span class="font-extrabold text-sm text-brand-600">
                      {{ item.subtotal | currencyPEN }}
                    </span>

                    <!-- Quantity controls -->
                    <div class="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-0.5 shadow-xs">
                      <button 
                        (click)="cart.updateQuantity(item.product.id, -1)"
                        class="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:bg-slate-100 transition font-bold"
                      >
                        -
                      </button>
                      <span class="w-6 text-center text-xs font-bold text-slate-800">
                        {{ item.cantidad }}
                      </span>
                      <button 
                        (click)="cart.updateQuantity(item.product.id, 1)"
                        class="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:bg-slate-100 transition font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            }
          }
        </div>

        <!-- Footer / Checkout calculations -->
        @if (!cart.isEmpty()) {
          <div class="p-5 bg-slate-50 border-t border-slate-200 space-y-3">
            <div class="space-y-1.5 text-sm">
              <div class="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span class="font-medium text-slate-800">{{ cart.subtotal() | currencyPEN }}</span>
              </div>
              <div class="flex justify-between text-slate-500">
                <span>Delivery</span>
                <span class="font-medium text-slate-800">{{ cart.costoEnvio() | currencyPEN }}</span>
              </div>
              <div class="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                <span class="font-bold text-slate-900">Total a Pagar</span>
                <span class="text-xl font-extrabold text-brand-600">{{ cart.total() | currencyPEN }}</span>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2 pt-2">
              <button 
                type="button"
                (click)="clearCartConfirm()"
                class="py-3 px-3 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100 transition text-center"
              >
                Vaciar
              </button>

              <button 
                type="button"
                (click)="proceedToCheckout()"
                class="py-3 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs transition shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2"
              >
                <span>Pedir Ahora</span>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                </svg>
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class CartDrawerComponent {
  readonly cart = inject(CartService);
  readonly router = inject(Router);
  private notify = inject(NotificationService);

  async clearCartConfirm(): Promise<void> {
    const ok = await this.notify.confirmDialog({
      title: '¿Vaciar carrito?',
      text: 'Se eliminarán todos los productos seleccionados de tu pedido.',
      confirmButtonText: 'Sí, vaciar',
      icon: 'warning'
    });

    if (ok) {
      this.cart.clearCart();
      this.notify.showInfo('Carrito vaciado');
    }
  }

  proceedToCheckout(): void {
    this.cart.toggleCartDrawer(false);
    this.router.navigate(['/checkout']);
  }
}
