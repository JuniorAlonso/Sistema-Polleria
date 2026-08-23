import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductsService } from '../../../core/services/products.service';
import { CartService } from '../../../core/services/cart.service';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { NotificationService } from '../../../core/services/notification.service';
import { Product, ProductCategory } from '../../../core/models/product.model';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPENPipe],
  template: `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      
      <!-- Header & Search -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-slate-200">
        <div>
          <span class="text-xs font-extrabold text-brand-600 uppercase tracking-widest">Nuestra Carta</span>
          <h1 class="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-1">
            Pollería & Brasas Tradicionales
          </h1>
          <p class="text-slate-500 text-sm mt-1">
            Selecciona tus platos favoritos para Delivery, Salón o Recojo en tienda.
          </p>
        </div>

        <!-- Search Bar -->
        <div class="w-full md:w-80 relative">
          <input 
            type="text" 
            placeholder="Buscar pollo, combo, bebida..."
            [ngModel]="productsService.searchQuery()"
            (ngModelChange)="productsService.setSearchQuery($event)"
            class="w-full pl-11 pr-4 py-3 bg-white rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm shadow-xs transition"
          />
          <svg class="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
        </div>
      </div>

      <!-- Categories Filter Tabs -->
      <div class="flex items-center gap-2 overflow-x-auto py-6 no-scrollbar">
        @for (cat of productsService.categoriesList; track cat.key) {
          <button 
            type="button"
            (click)="selectCategory(cat.key)"
            class="px-5 py-2.5 rounded-2xl text-sm font-bold whitespace-nowrap transition duration-200 shrink-0 flex items-center gap-2 cursor-pointer"
            [ngClass]="productsService.selectedCategory() === cat.key ? 
              'bg-slate-900 text-white shadow-md' : 
              'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'"
          >
            <span>{{ cat.label }}</span>
          </button>
        }
      </div>

      <!-- Products Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pt-4">
        @for (product of productsService.filteredProducts(); track product.id) {
          <div 
            class="bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-xs hover:shadow-xl transition duration-300 flex flex-col group relative"
            [ngClass]="{ 'opacity-60 grayscale-50': product.agotado }"
          >
            
            <!-- Image & Badges -->
            <div class="relative h-48 bg-slate-100 overflow-hidden">
              <img 
                [src]="product.imagenUrl" 
                [alt]="product.nombre"
                class="w-full h-full object-cover group-hover:scale-105 transition duration-500"
              />

              <!-- Agotado Overlay (RF08) -->
              @if (product.agotado) {
                <div class="absolute inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center">
                  <span class="px-4 py-1.5 rounded-full bg-rose-600 text-white text-xs font-black tracking-wider uppercase shadow-lg">
                    Agotado
                  </span>
                </div>
              } @else if (product.precioDescuento) {
                <span class="absolute top-3 left-3 px-3 py-1 rounded-full bg-rose-500 text-white text-xs font-bold shadow-md">
                  Oferta
                </span>
              }

              @if (product.tiempoEstimadoMin) {
                <span class="absolute bottom-3 right-3 px-2.5 py-0.5 rounded-lg glass-panel text-slate-800 text-[11px] font-bold shadow-xs flex items-center gap-1">
                  <svg class="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>{{ product.tiempoEstimadoMin }}m</span>
                </span>
              }
            </div>

            <!-- Content -->
            <div class="p-5 flex-1 flex flex-col justify-between">
              <div>
                <h3 class="font-bold text-base text-slate-900 group-hover:text-brand-600 transition line-clamp-1">
                  {{ product.nombre }}
                </h3>
                <p class="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                  {{ product.descripcion }}
                </p>
              </div>

              <!-- Price and Actions -->
              <div class="pt-4 border-t border-slate-100 flex items-center justify-between mt-4">
                <div>
                  <span class="text-xs text-slate-400 block font-medium">Precio</span>
                  <div class="flex items-baseline gap-1.5">
                    <span class="text-lg font-black text-slate-900">
                      {{ (product.precioDescuento ?? product.precio) | currencyPEN }}
                    </span>
                    @if (product.precioDescuento) {
                      <span class="text-xs text-slate-400 line-through">
                        {{ product.precio | currencyPEN }}
                      </span>
                    }
                  </div>
                </div>

                @if (!product.agotado) {
                  <button 
                    (click)="openAddModal(product)"
                    class="px-3.5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-md shadow-brand-500/20 active:scale-95 transition flex items-center gap-1 cursor-pointer"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
                    </svg>
                    <span>Agregar</span>
                  </button>
                } @else {
                  <span class="text-xs text-slate-400 font-semibold italic">No disponible</span>
                }
              </div>
            </div>

          </div>
        } @empty {
          <div class="col-span-full py-16 text-center text-slate-400">
            <p class="text-lg font-bold text-slate-600">No se encontraron productos</p>
            <p class="text-sm">Intenta con otra categoría o término de búsqueda.</p>
          </div>
        }
      </div>

    </div>

    <!-- Quick Add Product Modal with Notes -->
    @if (selectedProductForModal()) {
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
        <div class="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-100 animate-slide-up">
          
          <div class="flex justify-between items-start">
            <h3 class="font-extrabold text-xl text-slate-900 leading-snug">
              {{ selectedProductForModal()?.nombre }}
            </h3>
            <button 
              (click)="selectedProductForModal.set(null)"
              class="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              ✕
            </button>
          </div>

          <p class="text-xs text-slate-500">{{ selectedProductForModal()?.descripcion }}</p>

          <!-- Notes input -->
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Instrucciones especiales (Opcional):</label>
            <input 
              type="text" 
              [(ngModel)]="modalNotas"
              placeholder="Ej: Ají extra, papas bien crocantes, etc."
              class="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <!-- Quantity Selector -->
          <div class="flex items-center justify-between pt-2">
            <span class="text-sm font-bold text-slate-700">Cantidad:</span>
            <div class="flex items-center gap-3 bg-slate-100 p-1 rounded-xl">
              <button 
                (click)="modalQty = modalQty > 1 ? modalQty - 1 : 1"
                class="w-8 h-8 rounded-lg bg-white shadow-xs flex items-center justify-center font-bold text-slate-700 hover:bg-slate-50"
              >
                -
              </button>
              <span class="font-extrabold text-base w-6 text-center text-slate-900">{{ modalQty }}</span>
              <button 
                (click)="modalQty = modalQty + 1"
                class="w-8 h-8 rounded-lg bg-white shadow-xs flex items-center justify-center font-bold text-slate-700 hover:bg-slate-50"
              >
                +
              </button>
            </div>
          </div>

          <!-- Confirm button -->
          <div class="pt-4 border-t border-slate-100 flex gap-3">
            <button 
              (click)="selectedProductForModal.set(null)"
              class="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button 
              (click)="confirmAddToCart()"
              class="flex-2 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-extrabold text-xs shadow-lg shadow-brand-500/25 transition"
            >
              Añadir ({{ calculateModalTotal() | currencyPEN }})
            </button>
          </div>

        </div>
      </div>
    }
  `
})
export class MenuComponent {
  readonly productsService = inject(ProductsService);
  readonly cart = inject(CartService);
  private notify = inject(NotificationService);

  readonly selectedProductForModal = signal<Product | null>(null);
  modalQty = 1;
  modalNotas = '';

  selectCategory(key: string): void {
    this.productsService.setCategory(key as ProductCategory | 'TODOS');
  }

  openAddModal(product: Product): void {
    this.selectedProductForModal.set(product);
    this.modalQty = 1;
    this.modalNotas = '';
  }

  calculateModalTotal(): number {
    const p = this.selectedProductForModal();
    if (!p) return 0;
    const price = p.precioDescuento ?? p.precio;
    return price * this.modalQty;
  }

  confirmAddToCart(): void {
    const product = this.selectedProductForModal();
    if (!product) return;

    this.cart.addItem(product, this.modalQty, this.modalNotas);
    this.notify.showSuccess(`${this.modalQty}x ${product.nombre} añadido al pedido`);
    this.selectedProductForModal.set(null);
  }
}
