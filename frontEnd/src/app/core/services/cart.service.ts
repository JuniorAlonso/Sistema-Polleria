import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Product, CartItem } from '../models/product.model';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private platformId = inject(PLATFORM_ID);

  // State Signals
  readonly items = signal<CartItem[]>([]);
  readonly costoEnvio = signal<number>(6.00);
  readonly descuento = signal<number>(0.00);
  readonly isCartOpen = signal<boolean>(false);

  // Computed State (Zero boilerplate derived state)
  readonly totalItems = computed(() =>
    this.items().reduce((sum, item) => sum + item.cantidad, 0)
  );

  readonly subtotal = computed(() =>
    this.items().reduce((sum, item) => sum + item.subtotal, 0)
  );

  readonly total = computed(() => {
    const sub = this.subtotal();
    const envio = sub > 0 ? this.costoEnvio() : 0;
    const desc = this.descuento();
    return Math.max(0, sub + envio - desc);
  });

  readonly isEmpty = computed(() => this.items().length === 0);

  constructor() {
    this.restoreCart();
  }

  private restoreCart(): void {
    if (isPlatformBrowser(this.platformId)) {
      const saved = localStorage.getItem('polleria_cart');
      if (saved) {
        try {
          this.items.set(JSON.parse(saved));
        } catch {
          this.clearCart();
        }
      }
    }
  }

  private saveCart(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('polleria_cart', JSON.stringify(this.items()));
    }
  }

  /**
   * Agregar producto al carrito
   */
  addItem(product: Product, cantidad: number = 1, notas: string = ''): void {
    if (product.agotado) return;

    this.items.update(currentItems => {
      const existingIndex = currentItems.findIndex(i => i.product.id === product.id);
      const effectivePrice = product.precioDescuento ?? product.precio;

      if (existingIndex > -1) {
        const updated = [...currentItems];
        const current = updated[existingIndex];
        const newCantidad = current.cantidad + cantidad;
        updated[existingIndex] = {
          ...current,
          cantidad: newCantidad,
          notas: notas || current.notas,
          subtotal: effectivePrice * newCantidad
        };
        return updated;
      } else {
        const newItem: CartItem = {
          product,
          cantidad,
          notas,
          subtotal: effectivePrice * cantidad
        };
        return [...currentItems, newItem];
      }
    });

    this.saveCart();
  }

  updateQuantity(productId: string, delta: number): void {
    this.items.update(currentItems => {
      return currentItems
        .map(item => {
          if (item.product.id === productId) {
            const newQty = item.cantidad + delta;
            const effectivePrice = item.product.precioDescuento ?? item.product.precio;
            return {
              ...item,
              cantidad: newQty,
              subtotal: effectivePrice * newQty
            };
          }
          return item;
        })
        .filter(item => item.cantidad > 0);
    });

    this.saveCart();
  }

  removeItem(productId: string): void {
    this.items.update(current => current.filter(item => item.product.id !== productId));
    this.saveCart();
  }

  clearCart(): void {
    this.items.set([]);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('polleria_cart');
    }
  }

  toggleCartDrawer(open?: boolean): void {
    this.isCartOpen.set(open !== undefined ? open : !this.isCartOpen());
  }

  setTipoEntrega(isDelivery: boolean): void {
    this.costoEnvio.set(isDelivery ? 6.00 : 0.00);
  }
}
