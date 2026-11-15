import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Product, CartItem } from '../models/product.model';

export interface CartSyncResult {
  cambiosPrecio: string[];
  agotadosEliminados: string[];
  cantidadesAjustadas: string[];
  huboCambios: boolean;
}

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
   * Agregar producto al carrito respetando el stock disponible cuando existe.
   */
  addItem(product: Product, cantidad: number = 1, notas: string = ''): void {
    if (product.agotado) return;
    if (typeof product.stock === 'number' && product.stock <= 0) return;

    this.items.update(currentItems => {
      const existingIndex = currentItems.findIndex(i => i.product.id === product.id);
      const effectivePrice = product.precioDescuento ?? product.precio;
      const maxStock = typeof product.stock === 'number' && product.stock > 0 ? product.stock : null;

      if (existingIndex > -1) {
        const updated = [...currentItems];
        const current = updated[existingIndex];
        const rawCantidad = current.cantidad + cantidad;
        const newCantidad = maxStock !== null ? Math.min(rawCantidad, maxStock) : rawCantidad;
        updated[existingIndex] = {
          ...current,
          product,
          cantidad: newCantidad,
          notas: notas || current.notas,
          subtotal: effectivePrice * newCantidad
        };
        return updated;
      } else {
        const initialCantidad = maxStock !== null ? Math.min(cantidad, maxStock) : cantidad;
        if (initialCantidad <= 0) return currentItems;
        const newItem: CartItem = {
          product,
          cantidad: initialCantidad,
          notas,
          subtotal: effectivePrice * initialCantidad
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
            const rawQty = item.cantidad + delta;
            const maxStock = typeof item.product.stock === 'number' && item.product.stock > 0
              ? item.product.stock
              : null;
            const newQty = maxStock !== null ? Math.min(rawQty, maxStock) : rawQty;
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

  /**
   * Reconcilia precios, disponibilidad y stock del carrito con el catálogo actual del backend (FE-07).
   */
  sincronizarConProductos(productos: Product[]): CartSyncResult {
    const result: CartSyncResult = {
      cambiosPrecio: [],
      agotadosEliminados: [],
      cantidadesAjustadas: [],
      huboCambios: false
    };
    if (!Array.isArray(productos) || productos.length === 0 || this.items().length === 0) {
      return result;
    }

    const byId = new Map<string, Product>(productos.map(p => [String(p.id), p]));
    const updated: CartItem[] = [];

    for (const item of this.items()) {
      const fresh = byId.get(String(item.product.id));
      if (!fresh || fresh.agotado || (typeof fresh.stock === 'number' && fresh.stock <= 0)) {
        result.agotadosEliminados.push(item.product.nombre);
        result.huboCambios = true;
        continue;
      }

      const oldPrice = item.product.precioDescuento ?? item.product.precio;
      const newPrice = fresh.precioDescuento ?? fresh.precio;
      if (Math.abs(oldPrice - newPrice) > 0.009) {
        result.cambiosPrecio.push(`${fresh.nombre}: S/ ${oldPrice.toFixed(2)} -> S/ ${newPrice.toFixed(2)}`);
        result.huboCambios = true;
      }

      let cantidad = item.cantidad;
      if (typeof fresh.stock === 'number' && cantidad > fresh.stock) {
        cantidad = fresh.stock;
        result.cantidadesAjustadas.push(`${fresh.nombre}: ajustado a ${cantidad}`);
        result.huboCambios = true;
      }

      updated.push({
        ...item,
        product: fresh,
        cantidad,
        subtotal: Math.round(newPrice * cantidad * 100) / 100
      });
    }

    if (result.huboCambios) {
      this.items.set(updated);
      this.saveCart();
    }
    return result;
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
