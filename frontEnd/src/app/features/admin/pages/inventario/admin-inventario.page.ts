import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ProductsService } from '../../../../core/services/products.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { Product } from '../../../../core/models/product.model';
import { ProductsTableComponent } from '../../components/inventario/products-table.component';
import { ProductCreateModalComponent, ProductCreateValues } from '../../components/inventario/product-create-modal.component';

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
        [initial]="newProductInitial"
        (closed)="showCreateProductModal = false"
        (saved)="guardarNuevoProducto($event)"
      />
    }
  `
})
export class AdminInventarioPage implements OnInit {
  readonly productsService = inject(ProductsService);
  readonly notify = inject(NotificationService);

  ngOnInit(): void {
    // Each order takes units out of the stock: reload so the admin never edits a stale count.
    this.productsService.loadProducts();
  }

  alternarDisponibilidad(productId: Product['id']): void {
    this.productsService.toggleAgotado(productId, error => error === null
      ? this.notify.showSuccess('Disponibilidad actualizada')
      : this.notify.showError('No se pudo cambiar la disponibilidad', error));
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
      error: (err: HttpErrorResponse) => {
        const validacion = err.error?.errors ? Object.values(err.error.errors).join('. ') : null;
        this.notify.showError('No se pudo actualizar el stock',
          validacion || err.error?.error || 'Intenta nuevamente.');
      }
    });
  }

  // Modal para creación de productos
  showCreateProductModal = false;

  readonly newProductInitial: Omit<Product, 'id'> = {
    nombre: '',
    descripcion: '',
    precio: 0,
    categoria: 'POLLOS_A_LA_BRASA',
    imagenUrl: '',
    agotado: false
  };

  guardarNuevoProducto(values: ProductCreateValues): void {
    const { product, imageFile } = values;
    if (!product.nombre || product.precio <= 0) {
      this.notify.showError('Por favor ingresa nombre y precio válido');
      return;
    }

    this.productsService.createProduct(product).subscribe({
      next: created => {
        if (imageFile && created?.id) {
          this.productsService.uploadProductImage(created.id, imageFile).subscribe({
            error: () => this.notify.showError('Plato creado, pero no se pudo subir la imagen')
          });
        }
        this.notify.showSuccess(`Plato "${product.nombre}" creado exitosamente`);
        this.showCreateProductModal = false;
      },
      error: () => this.notify.showError('No se pudo crear el plato')
    });
  }
}
