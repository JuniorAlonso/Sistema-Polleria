import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductsService } from '../../../../core/services/products.service';
import { InventoryService } from '../../../../core/services/inventory.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { Product } from '../../../../core/models/product.model';
import { MotivoMerma } from '../../../../core/models/inventory.model';
import { AdminShellStore } from '../../state/admin-shell.store';
import { InventorySubtabsComponent } from '../../components/inventario/inventory-subtabs.component';
import { ProductsTableComponent } from '../../components/inventario/products-table.component';
import { SuppliesTableComponent } from '../../components/inventario/supplies-table.component';
import { WasteTableComponent } from '../../components/inventario/waste-table.component';
import { InventoryAlertsComponent } from '../../components/inventario/inventory-alerts.component';
import { ProductCreateModalComponent } from '../../components/inventario/product-create-modal.component';
import { SupplyDispatchModalComponent } from '../../components/inventario/supply-dispatch-modal.component';
import { WasteRegisterModalComponent } from '../../components/inventario/waste-register-modal.component';

/** Contenedor (smart) de la pestaña INVENTARIO & CARTA: carta, insumos, mermas y alertas. */
@Component({
  selector: 'app-admin-inventario-page',
  standalone: true,
  imports: [
    CommonModule,
    InventorySubtabsComponent,
    ProductsTableComponent,
    SuppliesTableComponent,
    WasteTableComponent,
    InventoryAlertsComponent,
    ProductCreateModalComponent,
    SupplyDispatchModalComponent,
    WasteRegisterModalComponent
  ],
  host: { class: 'contents' },
  template: `
    <main class="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">

      <app-inventory-subtabs
        [inventarioSubTab]="store.inventarioSubTab()"
        (subTabChange)="store.inventarioSubTab.set($event)"
      />

      <!-- SUB-VIEW 1: CARTA & PLATOS -->
      @if (store.inventarioSubTab() === 'CARTA') {
        <app-products-table
          [products]="productsService.products()"
          (createRequested)="showCreateProductModal = true"
          (availabilityToggled)="alternarDisponibilidad($event)"
          (productDeleted)="eliminarProducto($event)"
        />
      }

      <!-- SUB-VIEW 2: INSUMOS & DESPACHO -->
      @if (store.inventarioSubTab() === 'INSUMOS') {
        <app-supplies-table
          [insumos]="inventoryService.insumos()"
          (dispatchRequested)="abrirModalDespacho()"
        />
      }

      <!-- SUB-VIEW 3: MERMAS DIARIAS -->
      @if (store.inventarioSubTab() === 'MERMAS') {
        <app-waste-table
          [mermas]="inventoryService.mermas()"
          [insumos]="inventoryService.insumos()"
          (registerRequested)="abrirModalMerma()"
        />
      }

      <!-- SUB-VIEW 4: PREDICCIÓN & MÉTRICAS -->
      @if (store.inventarioSubTab() === 'PREDICCION') {
        <app-inventory-alerts
          [rentabilidad]="inventoryService.rentabilidad()"
          [alertas]="inventoryService.alertas()"
        />
      }

    </main>

    <!-- Modal: crear producto -->
    @if (showCreateProductModal) {
      <app-product-create-modal
        [initial]="newProduct"
        (closed)="showCreateProductModal = false"
        (saved)="newProduct = $event; guardarNuevoProducto()"
      />
    }

    <!-- Modal: despacho de insumo a cocina -->
    @if (showDespachoModal) {
      <app-supply-dispatch-modal
        [initial]="despachoForm"
        [insumos]="inventoryService.insumos()"
        (closed)="showDespachoModal = false"
        (confirmed)="despachoForm = $event; confirmarDespacho()"
      />
    }

    <!-- Modal: registrar merma -->
    @if (showMermaModal) {
      <app-waste-register-modal
        [initial]="mermaForm"
        [insumos]="inventoryService.insumos()"
        (closed)="showMermaModal = false"
        (confirmed)="mermaForm = $event; confirmarMerma()"
      />
    }
  `
})
export class AdminInventarioPage implements OnInit {
  readonly productsService = inject(ProductsService);
  readonly inventoryService = inject(InventoryService);
  readonly notify = inject(NotificationService);
  readonly store = inject(AdminShellStore);

  ngOnInit(): void {
    this.inventoryService.cargarInsumos();
    this.inventoryService.cargarMermas();
    this.inventoryService.cargarAlertas();
  }

  alternarDisponibilidad(productId: Product['id']): void {
    this.productsService.toggleAgotado(productId);
    this.notify.showSuccess('Disponibilidad actualizada');
  }

  eliminarProducto(productId: Product['id']): void {
    this.productsService.deleteProduct(productId);
    this.notify.showInfo('Plato eliminado de la carta');
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

  // Modal de Despacho de Insumo (Fase 6)
  showDespachoModal = false;
  despachoForm = {
    insumoId: 1,
    cantidad: 10,
    estacion: 'HORNO'
  };

  // Modal de Registro de Merma (Fase 6)
  showMermaModal = false;
  mermaForm = {
    insumoId: 1,
    cantidad: 1,
    motivo: 'VENCIMIENTO' as MotivoMerma,
    justificacion: ''
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

  abrirModalDespacho(): void {
    const insumos = this.inventoryService.insumos();
    if (insumos.length > 0) {
      this.despachoForm.insumoId = insumos[0].id;
    }
    this.despachoForm.cantidad = 5;
    this.despachoForm.estacion = 'HORNO';
    this.showDespachoModal = true;
  }

  confirmarDespacho(): void {
    if (this.despachoForm.cantidad <= 0) {
      this.notify.showWarning('Ingresa una cantidad mayor a 0');
      return;
    }
    this.inventoryService.despacharACocina({
      insumoId: Number(this.despachoForm.insumoId),
      cantidad: Number(this.despachoForm.cantidad),
      estacionDestino: this.despachoForm.estacion
    }).subscribe({
      next: () => {
        this.notify.showSuccess(`Despacho de ${this.despachoForm.cantidad} unidades enviado a ${this.despachoForm.estacion}`);
        this.showDespachoModal = false;
      },
      error: () => {
        this.notify.showError(`No se pudo registrar el despacho a ${this.despachoForm.estacion}`);
      }
    });
  }

  abrirModalMerma(): void {
    const insumos = this.inventoryService.insumos();
    if (insumos.length > 0) {
      this.mermaForm.insumoId = insumos[0].id;
    }
    this.mermaForm.cantidad = 1;
    this.mermaForm.motivo = 'VENCIMIENTO';
    this.mermaForm.justificacion = '';
    this.showMermaModal = true;
  }

  confirmarMerma(): void {
    if (this.mermaForm.cantidad <= 0) {
      this.notify.showWarning('Ingresa una cantidad válida de merma');
      return;
    }
    this.inventoryService.registrarMerma({
      insumoId: Number(this.mermaForm.insumoId),
      cantidad: Number(this.mermaForm.cantidad),
      motivo: this.mermaForm.motivo,
      justificacion: this.mermaForm.justificacion || undefined
    }).subscribe({
      next: () => {
        this.notify.showSuccess('Merma registrada en bitácora de inventario');
        this.showMermaModal = false;
      },
      error: () => {
        this.notify.showError('No se pudo registrar la merma');
      }
    });
  }
}
