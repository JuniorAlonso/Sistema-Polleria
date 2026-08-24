export type ProductCategory = 
  | 'POLLOS_A_LA_BRASA'
  | 'COMBOS_FAMILIARES'
  | 'PIQUEOS_Y_BEBIDAS'
  | 'COMBOS_Y_PROMOCIONES'
  | 'GUARNICIONES'
  | 'BEBIDAS'
  | 'POSTRES'
  | 'SALSAS_Y_EXTRAS';

export interface Product {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  precioDescuento?: number;
  imagenUrl: string;
  categoria: ProductCategory;
  agotado: boolean; // RF08: Marcar producto como agotado
  destacado?: boolean;
  tiempoEstimadoMin?: number;
}

export interface CartItem {
  product: Product;
  cantidad: number;
  notas?: string;
  subtotal: number;
}
