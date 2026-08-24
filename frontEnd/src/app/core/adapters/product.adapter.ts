import {
  BackendCategoria,
  BackendProductoRequest,
  BackendProductoResponse
} from '../models/api-contracts.model';
import { Product, ProductCategory } from '../models/product.model';

export class ProductAdapter {
  private static readonly DEFAULT_IMAGES: Record<string, string> = {
    POLLOS_A_LA_BRASA: '/assets/images/hero-panoramic.jpg',
    COMBOS_FAMILIARES: '/assets/images/login-hero.jpg',
    PIQUEOS_Y_BEBIDAS: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=800&q=80',
    BEBIDAS: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80',
    GUARNICIONES: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=800&q=80',
    POSTRES: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=800&q=80',
    DEFAULT: '/assets/images/hero-panoramic.jpg'
  };

  /**
   * Mapea categorías del backend a las categorías del frontend
   */
  static toProductCategory(backendCat: BackendCategoria | string): ProductCategory {
    if (!backendCat) return 'POLLOS_A_LA_BRASA';
    const cat = backendCat.toUpperCase();

    switch (cat) {
      case 'POLLO_ENTERO':
      case 'MEDIO_POLLO':
      case 'CUARTO_POLLO':
      case 'POLLOS_A_LA_BRASA':
        return 'POLLOS_A_LA_BRASA';

      case 'COMBO':
      case 'COMBOS_FAMILIARES':
        return 'COMBOS_FAMILIARES';

      case 'PROMOCION':
      case 'COMBOS_Y_PROMOCIONES':
        return 'COMBOS_Y_PROMOCIONES';

      case 'PARRILLA':
      case 'PIQUEOS_Y_BEBIDAS':
        return 'PIQUEOS_Y_BEBIDAS';

      case 'BEBIDA':
      case 'BEBIDAS':
        return 'BEBIDAS';

      case 'GUARNICION':
      case 'GUARNICIONES':
      case 'SALSAS_Y_EXTRAS':
        return 'GUARNICIONES';

      case 'POSTRE':
      case 'POSTRES':
        return 'POSTRES';

      default:
        return 'POLLOS_A_LA_BRASA';
    }
  }

  /**
   * Mapea categoría del frontend a la categoría del backend
   */
  static toBackendCategoria(cat: ProductCategory | string): BackendCategoria {
    if (!cat) return 'POLLO_ENTERO';
    switch (cat) {
      case 'POLLOS_A_LA_BRASA':
        return 'POLLO_ENTERO';
      case 'COMBOS_FAMILIARES':
        return 'COMBO';
      case 'COMBOS_Y_PROMOCIONES':
        return 'PROMOCION';
      case 'PIQUEOS_Y_BEBIDAS':
        return 'PARRILLA';
      case 'BEBIDAS':
        return 'BEBIDA';
      case 'GUARNICIONES':
      case 'SALSAS_Y_EXTRAS':
        return 'GUARNICION';
      case 'POSTRES':
        return 'POSTRE';
      default:
        return 'POLLO_ENTERO';
    }
  }

  /**
   * Transforma un ProductoResponse del backend a Product del frontend
   */
  static toProduct(dto: BackendProductoResponse): Product {
    if (!dto) {
      throw new Error('Producto DTO nulo o inválido');
    }

    const categoria = this.toProductCategory(dto.categoria);
    const precioNumerico = typeof dto.precio === 'number' ? dto.precio : parseFloat(String(dto.precio)) || 0;

    let imagen = dto.imagenUrl?.trim();
    if (!imagen) {
      imagen = this.DEFAULT_IMAGES[categoria] || this.DEFAULT_IMAGES['DEFAULT'];
    }

    return {
      id: String(dto.id),
      nombre: dto.nombre || 'Producto sin nombre',
      descripcion: dto.descripcion || '',
      precio: precioNumerico,
      imagenUrl: imagen,
      categoria: categoria,
      agotado: dto.disponible === false,
      destacado: categoria === 'POLLOS_A_LA_BRASA' || categoria === 'COMBOS_FAMILIARES',
      tiempoEstimadoMin: categoria === 'POLLOS_A_LA_BRASA' ? 20 : 15
    };
  }

  /**
   * Transforma una lista del backend de forma segura
   */
  static toProductList(dtos: BackendProductoResponse[]): Product[] {
    if (!Array.isArray(dtos)) return [];
    return dtos
      .filter(d => d && typeof d === 'object' && d.id !== undefined)
      .map(d => this.toProduct(d));
  }

  /**
   * Transforma un objeto del frontend a request de creación/actualización para el backend
   */
  static toBackendRequest(p: Partial<Product>): BackendProductoRequest {
    return {
      nombre: p.nombre || '',
      descripcion: p.descripcion || '',
      precio: typeof p.precio === 'number' ? p.precio : parseFloat(String(p.precio)) || 0,
      categoria: this.toBackendCategoria(p.categoria || 'POLLOS_A_LA_BRASA'),
      imagenUrl: p.imagenUrl,
      disponible: p.agotado !== undefined ? !p.agotado : true
    };
  }
}
