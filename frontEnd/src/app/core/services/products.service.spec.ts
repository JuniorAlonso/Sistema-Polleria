import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProductsService } from './products.service';
import { Product } from '../models/product.model';

/**
 * Regla de negocio (S3.1 y S3.2): el frontend no inventa la carta ni escribe semillas
 * en la base de datos del negocio.
 */
describe('ProductsService — sin carta simulada', () => {
  let service: ProductsService;
  let http: HttpTestingController;

  const esGet = (req: { method: string }) => req.method === 'GET';
  const esPost = (req: { method: string }) => req.method === 'POST';

  const productoAdmin: Product = {
    id: '0',
    nombre: 'Chicha Morada 1L',
    descripcion: 'Jarra casera',
    precio: 14,
    imagenUrl: '',
    categoria: 'BEBIDAS',
    agotado: false,
    tiempoEstimadoMin: 5
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    // El constructor dispara loadProducts(): la petición inicial se resuelve en cada test.
    service = TestBed.inject(ProductsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('deja la carta vacía cuando el backend responde con la carta vacía, sin sembrar productos', () => {
    http.expectOne(esGet).flush([]);

    expect(service.products())
      .withContext('la carta debe reflejar el backend, no una lista local')
      .toEqual([]);
    http.expectNone(esPost);
  });

  it('deja la carta vacía cuando la API de productos falla', () => {
    http.expectOne(esGet).flush({ message: 'orders-service caído' },
      { status: 500, statusText: 'Server Error' });

    expect(service.products())
      .withContext('sin respuesta del backend no hay carta que mostrar')
      .toEqual([]);
    http.expectNone(esPost);
  });

  it('mantiene el mapeo de la carta real cuando el backend responde', () => {
    http.expectOne(esGet).flush([{
      id: 9,
      nombre: 'Chicha Morada 1L',
      descripcion: 'Jarra casera',
      precio: 14,
      categoria: 'BEBIDAS',
      imagenUrl: '',
      disponible: true
    }]);

    expect(service.products().length).toBe(1);
    expect(service.products()[0].nombre).toBe('Chicha Morada 1L');
    expect(service.products()[0].agotado).toBeFalse();
  });

  it('no agrega un producto local cuando el alta es rechazada', () => {
    http.expectOne(esGet).flush([]);

    service.createProduct(productoAdmin);
    http.expectOne(esPost).flush({ message: 'precio inválido' },
      { status: 400, statusText: 'Bad Request' });

    expect(service.products())
      .withContext('un producto rechazado por el backend no debe aparecer en la carta')
      .toEqual([]);
  });

  it('revierte la disponibilidad marcada de forma optimista si el backend falla', () => {
    http.expectOne(esGet).flush([{
      id: 9,
      nombre: 'Chicha Morada 1L',
      descripcion: 'Jarra casera',
      precio: 14,
      categoria: 'BEBIDAS',
      imagenUrl: '',
      disponible: true
    }]);

    expect(service.products()[0].agotado).toBeFalse();

    service.toggleAgotado(service.products()[0].id);
    http.expectOne(req => req.method === 'PATCH').flush({ message: 'no autorizado' },
      { status: 403, statusText: 'Forbidden' });

    expect(service.products()[0].agotado)
      .withContext('si el backend no confirmó, el plato no puede quedar agotado en la UI')
      .toBeFalse();
  });

  it('restaura el producto eliminado de forma optimista si el backend falla', () => {
    http.expectOne(esGet).flush([{
      id: 9,
      nombre: 'Chicha Morada 1L',
      descripcion: 'Jarra casera',
      precio: 14,
      categoria: 'BEBIDAS',
      imagenUrl: '',
      disponible: true
    }]);

    service.deleteProduct(service.products()[0].id);
    http.expectOne(req => req.method === 'DELETE').flush({ message: 'en uso' },
      { status: 409, statusText: 'Conflict' });

    expect(service.products().length)
      .withContext('un plato que sigue en la base de datos no puede desaparecer de la carta')
      .toBe(1);
  });
});
