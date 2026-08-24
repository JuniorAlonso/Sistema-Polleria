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

  // Semillas fallback con los 10 productos locales
  private readonly fallbackSeedProducts: Product[] = [
    {
      id: '1',
      nombre: '1 Pollo a la Brasa Tradicional',
      descripcion: '1 Pollo a la brasa jugoso, porción familiar de papas fritas crujientes y ensalada fresca con vinagreta de la casa.',
      precio: 65.00,
      imagenUrl: '/assets/images/hero-panoramic.jpg',
      categoria: 'POLLOS_A_LA_BRASA',
      agotado: false,
      tiempoEstimadoMin: 20
    },
    {
      id: '2',
      nombre: 'Medio Pollo a la Brasa',
      descripcion: '1/2 Pollo a la brasa con papas fritas crujientes, ensalada clásica y salsas peruanas artesanales.',
      precio: 36.00,
      imagenUrl: '/assets/images/medio-pollo.jpg',
      categoria: 'POLLOS_A_LA_BRASA',
      agotado: false,
      tiempoEstimadoMin: 15
    },
    {
      id: '3',
      nombre: '1/4 de Pollo a la Brasa Personal',
      descripcion: '1/4 Pollo a la brasa (pecho o pierna), papas fritas doradas y ensalada fresca individual.',
      precio: 21.00,
      imagenUrl: '/assets/images/cuarto-pollo.jpg',
      categoria: 'POLLOS_A_LA_BRASA',
      agotado: false,
      tiempoEstimadoMin: 10
    },
    {
      id: '4',
      nombre: 'Combo Banquete San Pollo (1 y 1/2 Pollo)',
      descripcion: '1 Pollo y medio a la brasa, papas fritas gigantes, ensalada familiar y salsas especiales.',
      precio: 92.00,
      imagenUrl: '/assets/images/combo-uno-y-medio.jpg',
      categoria: 'COMBOS_FAMILIARES',
      agotado: false,
      tiempoEstimadoMin: 30
    },
    {
      id: '5',
      nombre: 'Combo Urbano Máximo Familiar',
      descripcion: '1 Pollo a la brasa + Porción extra de papas crujientes + Ensalada mixta + Jarra de chicha 1L.',
      precio: 78.00,
      imagenUrl: '/assets/images/combo-urbano-maximo.jpg',
      categoria: 'COMBOS_FAMILIARES',
      agotado: false,
      tiempoEstimadoMin: 25
    },
    {
      id: '6',
      nombre: 'Mostrito San Pollo a la Leña',
      descripcion: '1/4 de pollo a la brasa acompañado de arroz chaufa al wok, papas fritas y cremas de la casa.',
      precio: 26.50,
      imagenUrl: '/assets/images/login-hero.jpg',
      categoria: 'COMBOS_FAMILIARES',
      agotado: false,
      tiempoEstimadoMin: 15
    },
    {
      id: '7',
      nombre: 'Anticuchos de Corazón a la Parrilla (2 palos)',
      descripcion: 'Tiernos corazones marinados con ají panca y especias secretas, papa dorada y choclo tierno.',
      precio: 28.00,
      imagenUrl: '/assets/images/anticuchos-parrilleros.jpg',
      categoria: 'PIQUEOS_Y_BEBIDAS',
      agotado: false,
      tiempoEstimadoMin: 15
    },
    {
      id: '8',
      nombre: 'Tequeños Criollos con Guacamole (8 uds)',
      descripcion: 'Tequeños dorados rellenos de queso andino y pollo a la brasa con abundante guacamole casero.',
      precio: 19.50,
      imagenUrl: '/assets/images/tequenos-guacamole.jpg',
      categoria: 'PIQUEOS_Y_BEBIDAS',
      agotado: false,
      tiempoEstimadoMin: 12
    },
    {
      id: '9',
      nombre: 'Salchipapa Especial Artesanal',
      descripcion: 'Papas fritas amarillas, salchicha frankfurter premium ahumada, huevo frito montado y salsa huancaína.',
      precio: 22.00,
      imagenUrl: '/assets/images/salchipapa-artesanal.jpg',
      categoria: 'PIQUEOS_Y_BEBIDAS',
      agotado: false,
      tiempoEstimadoMin: 12
    },
    {
      id: '10',
      nombre: 'Jarra de Chicha Morada Casera (1L)',
      descripcion: 'Receta tradicional elaborada con maíz morado, piña, membrillo, manzana, canela y clavo de olor.',
      precio: 14.00,
      imagenUrl: '/assets/images/chicha-morada.jpg',
      categoria: 'BEBIDAS',
      agotado: false,
      tiempoEstimadoMin: 5
    }
  ];

  // State Signals
  private readonly _products = signal<Product[]>(this.fallbackSeedProducts);
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
        if (Array.isArray(backendList) && backendList.length > 0) {
          const parsed = ProductAdapter.toProductList(backendList);
          this._products.set(parsed);
        } else {
          // Si la base de datos está vacía, sincronizamos automáticamente las semillas
          this.seedInitialProducts();
        }
      }),
      catchError(() => {
        this.isLoading.set(false);
        // Mantiene fallback sin romper el frontend
        return of(this.fallbackSeedProducts);
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
        catchError(() => of(null))
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
        // Fallback local si falla la llamada
        const localProduct: Product = {
          ...product,
          id: String(Date.now())
        };
        this._products.update(prev => [localProduct, ...prev]);
        return of(null);
      })
    ).subscribe();
  }

  /**
   * RF08: Eliminar Producto (Admin)
   */
  deleteProduct(productId: string): void {
    const cleanId = this.extractNumericId(productId);
    this._products.update(products => products.filter(p => p.id !== productId));

    if (cleanId > 0) {
      this.http.delete<void>(`${this.API_URL}/productos/${cleanId}`).pipe(
        catchError(() => of(null))
      ).subscribe();
    }
  }

  private extractNumericId(id: string): number {
    const clean = id.replace('prod-', '');
    return parseInt(clean, 10) || 0;
  }

  private seedInitialProducts(): void {
    // Si la BD remota está vacía, intentamos poblar con las semillas
    for (const seed of this.fallbackSeedProducts) {
      const req = ProductAdapter.toBackendRequest(seed);
      this.http.post<BackendProductoResponse>(`${this.API_URL}/productos`, req).subscribe({
        next: (res) => {
          if (res && res.id) {
            const parsed = ProductAdapter.toProduct(res);
            this._products.update(prev => {
              const withoutFallback = prev.filter(p => p.id !== seed.id && p.nombre !== parsed.nombre);
              return [...withoutFallback, parsed];
            });
          }
        },
        error: () => {}
      });
    }
  }
}
