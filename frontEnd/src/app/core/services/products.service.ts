import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Product, ProductCategory } from '../models/product.model';
import { BackendProductoResponse } from '../models/api-contracts.model';
import { ProductAdapter } from '../adapters/product.adapter';
import { environment } from '../../../environments/environment';
import { Observable, catchError, map, of, tap } from 'rxjs';

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

  /**
   * Timestamps de mutaciones locales por producto para proteger contra respuestas GET obsoletas (H-03).
   */
  private readonly ultimasMutacionesPorProducto = new Map<string, number>();

  /**
   * Guarda contra condiciones de carrera (H-03):
   * Registra IDs de productos con mutaciones de disponibilidad en curso para que una
   * respuesta GET antigua o paralela no sobrescriba el estado local más reciente.
   */
  private readonly mutacionesEnVuelo = new Set<string>();

  /** Bandera para evitar peticiones GET de carta concurrentes si una sigue en curso. */
  private cargandoProductos = false;

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
   * RF09: Cargar carta de productos desde orders-service (:8082).
   * Protegido contra sobreescritura de mutaciones en vuelo y GETs antiguos desordenados (H-03).
   */
  loadProducts(): void {
    if (this.cargandoProductos) {
      return;
    }
    this.cargandoProductos = true;
    this.isLoading.set(true);
    const tiempoInicioGet = Date.now();

    this.http.get<BackendProductoResponse[]>(`${this.API_URL}/productos?soloDisponibles=false`).pipe(
      tap(backendList => {
        this.isLoading.set(false);
        this.cargandoProductos = false;
        if (!Array.isArray(backendList)) {
          this._products.set([]);
          return;
        }

        const productosDesdeBackend = ProductAdapter.toProductList(backendList);

        // Si no hay mutaciones en vuelo ni recientes, actualiza la lista completa
        if (this.mutacionesEnVuelo.size === 0 && this.ultimasMutacionesPorProducto.size === 0) {
          this._products.set(productosDesdeBackend);
          return;
        }

        // H-03: Preservar el estado local de productos con mutaciones en vuelo o
        // con mutación confirmada después de haber iniciado este GET.
        const productosActuales = new Map(this._products().map(p => [p.id, p]));
        const fusionados = productosDesdeBackend.map(prodBackend => {
          const enVuelo = this.mutacionesEnVuelo.has(prodBackend.id);
          const timestampMutacion = this.ultimasMutacionesPorProducto.get(prodBackend.id) ?? 0;
          const mutacionMasRecienteQueGet = timestampMutacion >= tiempoInicioGet;

          if (enVuelo || mutacionMasRecienteQueGet) {
            const actual = productosActuales.get(prodBackend.id);
            if (actual) {
              return { ...prodBackend, agotado: actual.agotado };
            }
          }
          return prodBackend;
        });

        this._products.set(fusionados);
      }),
      catchError(() => {
        this.isLoading.set(false);
        this.cargandoProductos = false;
        // Solo vacía la carta si no hay mutaciones en curso
        if (this.mutacionesEnVuelo.size === 0) {
          this._products.set([]);
        }
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
   * RF10: Toggle Disponibilidad / Agotado conectando a PATCH /productos/{id}/disponibilidad.
   * `alTerminar` recibe null si el backend confirmó, o su mensaje si lo rechazó (p. ej. un plato
   * sin stock no se puede activar); en ese caso la carta vuelve al estado real.
   *
   * H-03: Rollback granular por ítem (no destructivo sobre otros productos) y protección con mutacionesEnVuelo.
   */
  toggleAgotado(productId: string, alTerminar?: (error: string | null) => void): void {
    const cleanId = this.extractNumericId(productId);
    const productoOriginal = this._products().find(p => p.id === productId);
    const estadoAgotadoOriginal = productoOriginal ? productoOriginal.agotado : false;

    // Registra la mutación en curso para proteger este producto contra GETs obsoletos
    this.mutacionesEnVuelo.add(productId);

    // Optimistic UI update individualizado sobre el producto
    this._products.update(products =>
      products.map(p => p.id === productId ? { ...p, agotado: !p.agotado } : p)
    );

    if (cleanId > 0) {
      this.http.patch<BackendProductoResponse>(`${this.API_URL}/productos/${cleanId}/disponibilidad`, {}).pipe(
        tap(res => {
          this.mutacionesEnVuelo.delete(productId);
          this.ultimasMutacionesPorProducto.set(productId, Date.now());
          if (res && res.id) {
            const updated = ProductAdapter.toProduct(res);
            this._products.update(products =>
              products.map(p => p.id === productId || p.id === String(res.id) ? updated : p)
            );
          }
          alTerminar?.(null);
        }),
        catchError(err => {
          this.mutacionesEnVuelo.delete(productId);
          this.ultimasMutacionesPorProducto.delete(productId);
          // Rollback granular: solo revierte el producto específico que falló,
          // preservando sin alteraciones a todos los demás productos.
          this._products.update(products =>
            products.map(p => p.id === productId ? { ...p, agotado: estadoAgotadoOriginal } : p)
          );
          const mensaje = err?.error?.error || err?.error?.message;
          alTerminar?.(typeof mensaje === 'string' ? mensaje : 'No se pudo actualizar la disponibilidad.');
          return of(null);
        })
      ).subscribe();
    } else {
      this.mutacionesEnVuelo.delete(productId);
      this.ultimasMutacionesPorProducto.delete(productId);
    }
  }

  /**
   * Fija las unidades que quedan de un plato (PATCH /productos/{id}/stock). null quita el control.
   * Sin actualización optimista: la carta cambia recién cuando el backend confirma.
   */
  updateStock(productId: string, stock: number | null): Observable<Product> {
    const cleanId = this.extractNumericId(productId);
    return this.http.patch<BackendProductoResponse>(`${this.API_URL}/productos/${cleanId}/stock`, { stock }).pipe(
      map(res => ProductAdapter.toProduct(res)),
      tap(updated => this._products.update(products =>
        products.map(p => p.id === productId ? updated : p)
      ))
    );
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
