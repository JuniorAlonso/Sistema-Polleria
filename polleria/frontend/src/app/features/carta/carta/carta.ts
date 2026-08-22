import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NgFor, NgIf, CurrencyPipe, DecimalPipe } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ProductoService } from '../../../core/services/producto';
import { AuthService } from '../../../core/services/auth';
import { Producto, CarritoItem, Categoria } from '../../../core/models/orden.models';
import { ProductoCard } from '../producto-card/producto-card';

interface CategoriaTab {
  nombre: string;
  label: string;
  productos: Producto[];
}

@Component({
  selector: 'app-carta',
  standalone: true,
  imports: [
    NgFor,
    NgIf,
    CurrencyPipe,
    DecimalPipe,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatBadgeModule,
    MatProgressSpinnerModule,
    ProductoCard,
  ],
  templateUrl: './carta.html',
  styles: [`
    .carta-container {
      padding: 16px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .page-title {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 16px;
      color: #e65100;
    }
    .loading-container {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 200px;
    }
    .productos-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 16px;
      padding: 16px 0;
    }
    .empty-category {
      text-align: center;
      padding: 48px;
      color: #9e9e9e;
      font-size: 1rem;
    }
    .cart-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 100;
    }
    .cart-total {
      font-size: 0.75rem;
      margin-left: 4px;
    }
  `],
})
export class CartaComponent implements OnInit {
  private readonly productoService = inject(ProductoService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  loading = signal(true);
  categorias = signal<CategoriaTab[]>([]);
  carrito = signal<CarritoItem[]>([]);

  readonly totalItems = computed(() =>
    this.carrito().reduce((sum, item) => sum + item.cantidad, 0)
  );

  readonly totalPrice = computed(() =>
    this.carrito().reduce((sum, item) => sum + item.producto.precio * item.cantidad, 0)
  );

  readonly isAuthenticated = computed(() => this.auth.isAuthenticated());

  ngOnInit(): void {
    this.cargarProductos();
  }

  cargarProductos(): void {
    this.loading.set(true);
    this.productoService.getCartaDisponible().subscribe({
      next: (productos) => {
        const groups = new Map<string, Producto[]>();
        for (const p of productos) {
          if (!groups.has(p.categoria)) groups.set(p.categoria, []);
          groups.get(p.categoria)!.push(p);
        }
        const tabs: CategoriaTab[] = Array.from(groups.entries()).map(([nombre, prods]) => ({
          nombre,
          label: this.labelCategoria(nombre as Categoria),
          productos: prods,
        }));
        this.categorias.set(tabs);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Error al cargar la carta. Intenta de nuevo.', 'OK', { duration: 3000 });
      },
    });
  }

  agregarAlCarrito(producto: Producto): void {
    this.carrito.update(items => {
      const existingIndex = items.findIndex(i => i.producto.id === producto.id);
      if (existingIndex >= 0) {
        const updated = [...items];
        updated[existingIndex] = {
          ...updated[existingIndex],
          cantidad: updated[existingIndex].cantidad + 1,
        };
        return updated;
      }
      return [...items, { producto, cantidad: 1 }];
    });
    this.snackBar.open(`${producto.nombre} agregado al carrito`, 'OK', { duration: 1500 });
  }

  quitarDelCarrito(productoId: number): void {
    this.carrito.update(items => {
      const existingIndex = items.findIndex(i => i.producto.id === productoId);
      if (existingIndex < 0) return items;
      const updated = [...items];
      if (updated[existingIndex].cantidad > 1) {
        updated[existingIndex] = {
          ...updated[existingIndex],
          cantidad: updated[existingIndex].cantidad - 1,
        };
      } else {
        updated.splice(existingIndex, 1);
      }
      return updated;
    });
  }

  verCarrito(): void {
    if (!this.isAuthenticated()) {
      this.snackBar.open('Debes iniciar sesión para hacer un pedido', 'Ingresar', { duration: 4000 })
        .onAction().subscribe(() => this.router.navigate(['/login']));
      return;
    }
    if (this.carrito().length === 0) {
      this.snackBar.open('El carrito está vacío', 'OK', { duration: 2000 });
      return;
    }
    this.router.navigate(['/pedido'], { state: { carrito: this.carrito() } });
  }

  private labelCategoria(cat: Categoria): string {
    const labels: Record<Categoria, string> = {
      POLLO_ENTERO: 'Pollo Entero',
      MEDIO_POLLO: '1/2 Pollo',
      CUARTO_POLLO: '1/4 Pollo',
      COMBO: 'Combos',
      PARRILLA: 'Parrilla',
      GUARNICION: 'Guarniciones',
      BEBIDA: 'Bebidas',
      POSTRE: 'Postres',
      PROMOCION: 'Promociones',
    };
    return labels[cat] ?? cat;
  }
}
