import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ProductsService } from '../../../../core/services/products.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { Product } from '../../../../core/models/product.model';
import { ProductsTableComponent } from '../../components/inventario/products-table.component';
import { ProductCreateModalComponent } from '../../components/inventario/product-create-modal.component';

/**
 * Contenedor (smart) de la pestaña INVENTARIO & CARTA. El inventario es el stock de cada plato:
 * orders-service lo descuenta al pedir y rechaza el pedido si no alcanza.
 */
@Component({
  selector: 'app-admin-inventario-page',
  standalone: true,
  imports: [CommonModule, ProductsTableComponent, ProductCreateModalComponent],
  host: { class: 'contents' },
  template: `
    <main class="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">

      <div>
        <h2 class="text-2xl font-bold text-white">Inventario & Carta de Productos</h2>
        <p class="text-xs text-slate-400">Precios, disponibilidad y unidades que quedan de cada plato.</p>
      </div>

      <app-products-table
        [products]="productsService.products()"
        (createRequested)="showCreateProductModal = true"
        (availabilityToggled)="alternarDisponibilidad($event)"
        (productDeleted)="eliminarProducto($event)"
        (stockChanged)="actualizarStock($event.id, $event.stock)"
      />

    </main>

    <!-- Modal: crear producto -->
    @if (showCreateProductModal) {
      <app-product-create-modal
        [initial]="newProduct"
        (closed)="showCreateProductModal = false"
        (saved)="newProduct = $event; guardarNuevoProducto()"
      />
    }
  `
})
export class AdminInventarioPage {
  readonly productsService = inject(ProductsService);
  readonly notify = inject(NotificationService);

  alternarDisponibilidad(productId: Product['id']): void {
    this.productsService.toggleAgotado(productId);
    this.notify.showSuccess('Disponibilidad actualizada');
  }

  eliminarProducto(productId: Product['id']): void {
    this.productsService.deleteProduct(productId);
    this.notify.showInfo('Plato eliminado de la carta');
  }

  actualizarStock(productId: Product['id'], stock: number | null): void {
    this.productsService.updateStock(productId, stock).subscribe({
      next: p => this.notify.showSuccess(
        stock === null ? `"${p.nombre}" ya no lleva control de stock` : `Stock de "${p.nombre}": ${stock}`
      ),
      error: (err: HttpErrorResponse) =>
        this.notify.showError('No se pudo actualizar el stock', err.error?.error || 'Intenta nuevamente.')
    });
  }

  // Modal para creación de productos
  showCreateProductModal = false;
  newProduct: Omit<Product, 'id'> = {
    nombre: '',
    descripcion: '',
    precio: 0,
    categoria: 'POLLOS_A_LA_BRASA',
    imagenUrl: '/assets/images/hero-panoramic.jpg',
    agotado: false,
    tiempoEstimadoMin: 20
  };

  guardarNuevoProducto(): void {
    if (!this.newProduct.nombre || this.newProduct.precio <= 0) {
      this.notify.showError('Por favor ingresa nombre y precio válido');
      return;
    }

    this.productsService.createProduct(this.newProduct);
    this.notify.showSuccess(`Plato "${this.newProduct.nombre}" creado exitosamente`);
    this.showCreateProductModal = false;

    this.newProduct = {
      nombre: '',
      descripcion: '',
      precio: 0,
      categoria: 'POLLOS_A_LA_BRASA',
      imagenUrl: '/assets/images/hero-panoramic.jpg',
      agotado: false,
      tiempoEstimadoMin: 20
    };
  }
}
