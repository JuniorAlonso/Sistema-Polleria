import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Product, ProductCategory } from '../models/product.model';
import { BackendProductoResponse } from '../models/api-contracts.model';
import { ProductAdapter } from '../adapters/product.adapter';
import { environment } from '../../../environments/environment';
import { catchError, of, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProductsService {
  private http = inject(HttpClient);
  private readonly API_URL = environment.ordersApiUrl || 'http://localhost:8082';

  // La carta es la del backend: sin semillas locales y sin escribir productos por
  // iniciativa del frontend. Si la API falla, la carta queda vacía a la vista.
  private readonly _products = signal<Product[]>([]);
  readonly selectedCategory = signal<ProductCategory | 'TODOS'>('POLLOS_A_LA_BRASA');
  readonly searchQuery = signal<string>('');
  readonly isLoading = signal<boolean>(false);

  readonly products = this._products.asReadonly();

  readonly filteredProducts = computed(() => {
    const category = this.selectedCategory();
    const query = this.searchQuery().toLowerCase().trim();

    return this._products().filter(p => {
      const matchCategory = category === 'TODOS' || p.categoria === category;
      const matchQuery = !query ||
        p.nombre.toLowerCase().includes(query) ||
        p.descripcion.toLowerCase().includes(query);
      return matchCategory && matchQuery;
    });
  });

  readonly featuredProducts = computed(() =>
    this._products().filter(p => p.categoria === 'POLLOS_A_LA_BRASA')
  );

  readonly categoriesList: { key: ProductCategory | 'TODOS'; label: string }[] = [
    { key: 'TODOS', label: 'Todo el Menú' },
    { key: 'POLLOS_A_LA_BRASA', label: 'Pollo a la Brasa' },
    { key: 'COMBOS_FAMILIARES', label: 'Combos Familiares' },
    { key: 'PIQUEOS_Y_BEBIDAS', label: 'Piqueos y Entradas' },
    { key: 'BEBIDAS', label: 'Bebidas' }
  ];

  constructor() {
    this.loadProducts();
  }

  /**
   * RF09: Cargar carta de productos desde orders-service (:8082)
   */
  loadProducts(): void {
    this.isLoading.set(true);
    this.http.get<BackendProductoResponse[]>(`${this.API_URL}/productos?soloDisponibles=false`).pipe(
      tap(backendList => {
        this.isLoading.set(false);
        this._products.set(
          Array.isArray(backendList) ? ProductAdapter.toProductList(backendList) : []
        );
      }),
      catchError(() => {
        this.isLoading.set(false);
        // Si la API no responde, la carta queda vacía: no se inventan platos.
        this._products.set([]);
        return of(null);
      })
    ).subscribe();
  }

  setCategory(cat: ProductCategory | 'TODOS'): void {
    this.selectedCategory.set(cat);
  }

  setSearchQuery(query: string): void {
    this.searchQuery.set(query);
    if (query && query.trim().length > 0) {
      this.selectedCategory.set('TODOS');
    }
  }

  /**
   * RF10: Toggle Disponibilidad / Agotado conectando a PATCH /productos/{id}/disponibilidad
   */
  toggleAgotado(productId: string): void {
    const cleanId = this.extractNumericId(productId);
    const cartaAnterior = this._products();

    // Optimistic UI update
    this._products.update(products =>
      products.map(p => p.id === productId ? { ...p, agotado: !p.agotado } : p)
    );

    if (cleanId > 0) {
      this.http.patch<BackendProductoResponse>(`${this.API_URL}/productos/${cleanId}/disponibilidad`, {}).pipe(
        tap(res => {
          if (res && res.id) {
            const updated = ProductAdapter.toProduct(res);
            this._products.update(products =>
              products.map(p => p.id === productId || p.id === String(res.id) ? updated : p)
            );
          }
        }),
        catchError(() => {
          // El backend no confirmó el cambio: la carta vuelve al estado real.
          this._products.set(cartaAnterior);
          return of(null);
        })
      ).subscribe();
    }
  }

  /**
   * RF08: Crear Producto (Admin)
   */
  createProduct(product: Omit<Product, 'id'>): void {
    const backendReq = ProductAdapter.toBackendRequest(product);

    this.http.post<BackendProductoResponse>(`${this.API_URL}/productos`, backendReq).pipe(
      tap(res => {
        if (res && res.id) {
          const created = ProductAdapter.toProduct(res);
          this._products.update(prev => [created, ...prev]);
        }
      }),
      catchError(() => {
        // Un alta rechazada por el backend no se muestra en la carta.
        return of(null);
      })
    ).subscribe();
  }

  /**
   * RF08: Eliminar Producto (Admin)
   */
  deleteProduct(productId: string): void {
    const cleanId = this.extractNumericId(productId);
    const cartaAnterior = this._products();
    this._products.update(products => products.filter(p => p.id !== productId));

    if (cleanId > 0) {
      this.http.delete<void>(`${this.API_URL}/productos/${cleanId}`).pipe(
        catchError(() => {
          // El plato sigue en la base de datos: vuelve a la carta.
          this._products.set(cartaAnterior);
          return of(null);
        })
      ).subscribe();
    }
  }

  private extractNumericId(id: string): number {
    const clean = id.replace('prod-', '');
    return parseInt(clean, 10) || 0;
  }
}
