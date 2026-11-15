import { ProductAdapter } from './product.adapter';
import { environment } from '../../../environments/environment';

describe('ProductAdapter.toProduct — image URLs', () => {
  const base = (environment.ordersApiUrl || 'http://localhost:8082').replace(/\/$/, '');
  const dto = (imagenUrl?: string) =>
    ({ id: 1, nombre: 'Pollo', precio: 50, categoria: 'POLLOS_A_LA_BRASA', imagenUrl } as never);

  it('serves images uploaded to orders-service from the orders API', () => {
    expect(ProductAdapter.toProduct(dto('/productos/1/imagen')).imagenUrl).toBe(`${base}/productos/1/imagen`);
  });

  it('keeps frontend asset paths of existing products untouched', () => {
    expect(ProductAdapter.toProduct(dto('/assets/images/hero-panoramic.jpg')).imagenUrl)
      .toBe('/assets/images/hero-panoramic.jpg');
  });

  it('keeps absolute URLs untouched', () => {
    expect(ProductAdapter.toProduct(dto('https://cdn.example.com/p.jpg')).imagenUrl).toBe('https://cdn.example.com/p.jpg');
  });
});
