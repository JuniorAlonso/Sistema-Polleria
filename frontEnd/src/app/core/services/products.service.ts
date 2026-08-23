import { Injectable, signal, computed } from '@angular/core';
import { Product, ProductCategory } from '../models/product.model';

@Injectable({
  providedIn: 'root'
})
export class ProductsService {
  private readonly _products = signal<Product[]>([
    {
      id: 'prod-1',
      nombre: 'Pollo Entero',
      descripcion: '1 Pollo a la brasa jugoso, porción familiar de papas fritas crujientes y ensalada fresca con vinagreta de la casa.',
      precio: 65.00,
      imagenUrl: '/assets/images/hero-panoramic.jpg',
      categoria: 'POLLOS_A_LA_BRASA',
      agotado: false,
      tiempoEstimadoMin: 20
    },
    {
      id: 'prod-2',
      nombre: 'Medio Pollo',
      descripcion: '1/2 Pollo a la brasa, porción personal abundante de papas fritas y ensalada clásica.',
      precio: 35.00,
      imagenUrl: '/assets/images/medio-pollo.jpg',
      categoria: 'POLLOS_A_LA_BRASA',
      agotado: false,
      tiempoEstimadoMin: 15
    },
    {
      id: 'prod-3',
      nombre: '1/4 de Pollo',
      descripcion: '1/4 Pollo a la brasa (pecho o pierna), papas fritas y ensalada. Ideal para el antojo personal.',
      precio: 20.00,
      imagenUrl: '/assets/images/cuarto-pollo.jpg',
      categoria: 'POLLOS_A_LA_BRASA',
      agotado: false,
      tiempoEstimadoMin: 10
    },
    {
      id: 'prod-4',
      nombre: 'Combo Familiar Fuego Criollo',
      descripcion: '1 Pollo a la brasa + 1 Porción doble de Papas Nativas + Ensalada Familiar + Gaseosa 1.5L + 4 Cremas artesanales.',
      precio: 84.90,
      precioDescuento: 74.90,
      imagenUrl: '/assets/images/login-hero.jpg',
      categoria: 'COMBOS_FAMILIARES',
      agotado: false,
      tiempoEstimadoMin: 25
    },
    {
      id: 'prod-5',
      nombre: 'Combo Banquete San Pollo',
      descripcion: '1 Pollo y 1/2 a la brasa + Papas fritas gigantes + Ensalada mixta + Tequeños brasa (6 uds) + Inka Kola 2.25L.',
      precio: 109.00,
      precioDescuento: 98.00,
      imagenUrl: '/assets/images/hero-panoramic.jpg',
      categoria: 'COMBOS_FAMILIARES',
      agotado: false,
      tiempoEstimadoMin: 30
    },
    {
      id: 'prod-6',
      nombre: 'Tequeños Rellenos de Pollo a la Brasa (8 uds)',
      descripcion: 'Crujientes tequeños de wantán rellenos de jugoso pollo a la brasa deshilachado con abundante guacamole.',
      precio: 22.00,
      imagenUrl: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=800&q=80',
      categoria: 'PIQUEOS_Y_BEBIDAS',
      agotado: false,
      tiempoEstimadoMin: 12
    },
    {
      id: 'prod-7',
      nombre: 'Anticuchos de Corazón Criollos (2 palos)',
      descripcion: 'Tiernos anticuchos marinados en ají panca, vinagre y especias, acompañados de papa dorada y choclo tierno.',
      precio: 26.00,
      imagenUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80',
      categoria: 'PIQUEOS_Y_BEBIDAS',
      agotado: false,
      tiempoEstimadoMin: 15
    },
    {
      id: 'prod-8',
      nombre: 'Chicha Morada Artesanal (1 Litro)',
      descripcion: 'Receta tradicional con maíz morado de valle, piña, membrillo, manzana, canela y clavo de olor.',
      precio: 14.00,
      imagenUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80',
      categoria: 'PIQUEOS_Y_BEBIDAS',
      agotado: false,
      tiempoEstimadoMin: 5
    }
  ]);

  readonly selectedCategory = signal<ProductCategory | 'TODOS'>('POLLOS_A_LA_BRASA');
  readonly searchQuery = signal<string>('');

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
    { key: 'POLLOS_A_LA_BRASA', label: 'Pollo a la Brasa' },
    { key: 'COMBOS_FAMILIARES', label: 'Combos Familiares' },
    { key: 'PIQUEOS_Y_BEBIDAS', label: 'Piqueos y Bebidas' },
    { key: 'TODOS', label: 'Ver Todo el Menú' }
  ];

  setCategory(cat: ProductCategory | 'TODOS'): void {
    this.selectedCategory.set(cat);
  }

  setSearchQuery(query: string): void {
    this.searchQuery.set(query);
  }

  toggleAgotado(productId: string): void {
    this._products.update(products => 
      products.map(p => p.id === productId ? { ...p, agotado: !p.agotado } : p)
    );
  }

  createProduct(product: Omit<Product, 'id'>): void {
    const newProduct: Product = {
      ...product,
      id: 'prod-' + Date.now()
    };
    this._products.update(products => [newProduct, ...products]);
  }

  deleteProduct(productId: string): void {
    this._products.update(products => products.filter(p => p.id !== productId));
  }
}
