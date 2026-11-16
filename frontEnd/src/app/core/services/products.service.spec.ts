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

  it('avisa el rechazo del backend al activar un plato sin stock', () => {
    http.expectOne(esGet).flush([{
      id: 9, nombre: 'Chicha Morada 1L', descripcion: '', precio: 14,
      categoria: 'BEBIDAS', imagenUrl: '', disponible: false, stock: 0
    }]);

    let resultado: string | null | undefined;
    service.toggleAgotado(service.products()[0].id, error => resultado = error);
    http.expectOne(req => req.method === 'PATCH').flush(
      { error: "'Chicha Morada 1L' no tiene stock: repón unidades antes de activarlo.", status: 400 },
      { status: 400, statusText: 'Bad Request' });

    expect(resultado).toBe("'Chicha Morada 1L' no tiene stock: repón unidades antes de activarlo.");
    expect(service.products()[0].agotado).toBeTrue();
  });

  it('confirma el cambio de disponibilidad recién cuando el backend responde', () => {
    http.expectOne(esGet).flush([{
      id: 9, nombre: 'Chicha Morada 1L', descripcion: '', precio: 14,
      categoria: 'BEBIDAS', imagenUrl: '', disponible: true
    }]);

    let resultado: string | null | undefined;
    service.toggleAgotado(service.products()[0].id, error => resultado = error);
    expect(resultado).withContext('sin respuesta todavía no hay confirmación').toBeUndefined();

    http.expectOne(req => req.method === 'PATCH').flush({
      id: 9, nombre: 'Chicha Morada 1L', descripcion: '', precio: 14,
      categoria: 'BEBIDAS', imagenUrl: '', disponible: false
    });

    expect(resultado).toBeNull();
    expect(service.products()[0].agotado).toBeTrue();
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

  describe('Concurrencia y Mutaciones en Vuelo (H-03)', () => {
    const platoA = {
      id: 1,
      nombre: 'Pollo a la Brasa 1/4',
      descripcion: '',
      precio: 22,
      categoria: 'POLLOS_A_LA_BRASA',
      imagenUrl: '',
      disponible: true,
      stock: 10
    };

    const platoB = {
      id: 2,
      nombre: 'Inca Kola 1.5L',
      descripcion: '',
      precio: 13,
      categoria: 'BEBIDAS',
      imagenUrl: '',
      disponible: true,
      stock: 20
    };

    beforeEach(() => {
      // Estado inicial con dos productos disponibles
      http.expectOne(esGet).flush([platoA, platoB]);
      expect(service.products().length).toBe(2);
      expect(service.products()[0].agotado).toBeFalse();
      expect(service.products()[1].agotado).toBeFalse();
    });

    it('A. GET iniciado → toggle exitoso → respuesta GET antigua: conserva el resultado del toggle', () => {
      // 1. Iniciar un GET (p. ej. por polling) que queda pendiente
      service.loadProducts();
      const reqGetPendiente = http.expectOne(esGet);

      // 2. Ejecutar toggle del producto 1 (marcarlo como agotado)
      service.toggleAgotado('1');
      expect(service.products().find(p => p.id === '1')?.agotado).toBeTrue();

      // 3. Responder exitosamente la mutación PATCH
      const reqPatch = http.expectOne(req => req.method === 'PATCH' && req.url.endsWith('/productos/1/disponibilidad'));
      reqPatch.flush({ ...platoA, disponible: false });
      expect(service.products().find(p => p.id === '1')?.agotado).toBeTrue();

      // 4. Responder después el GET antiguo que traía disponible=true
      reqGetPendiente.flush([platoA, platoB]);

      // El producto 1 DEBE conservar agotado=true (no sobreescrito por el GET antiguo)
      const finalProd1 = service.products().find(p => p.id === '1');
      expect(finalProd1?.agotado).toBeTrue();
      expect(service.products().find(p => p.id === '2')?.agotado).toBeFalse();
    });

    it('B. GET iniciado → toggle fallido → respuesta GET: rollback coherente sin lista obsoleta', () => {
      // 1. Iniciar GET pendiente
      service.loadProducts();
      const reqGetPendiente = http.expectOne(esGet);

      // 2. Toggle optimista
      service.toggleAgotado('1');
      expect(service.products().find(p => p.id === '1')?.agotado).toBeTrue();

      // 3. La mutación falla en backend (p. ej. error 400 sin stock)
      const reqPatch = http.expectOne(req => req.method === 'PATCH' && req.url.endsWith('/productos/1/disponibilidad'));
      reqPatch.flush({ error: 'Sin stock' }, { status: 400, statusText: 'Bad Request' });

      // Rollback individual: vuelve a disponible=true (agotado=false)
      expect(service.products().find(p => p.id === '1')?.agotado).toBeFalse();

      // 4. El GET pendiente responde con datos de backend
      reqGetPendiente.flush([platoA, platoB]);

      expect(service.products().find(p => p.id === '1')?.agotado).toBeFalse();
      expect(service.products().find(p => p.id === '2')?.agotado).toBeFalse();
    });

    it('C. Toggle de producto A mientras se actualiza producto B: la actualización de B no se pierde', () => {
      // Iniciar toggle sobre A ('1')
      service.toggleAgotado('1');
      const reqPatchA = http.expectOne(req => req.method === 'PATCH' && req.url.endsWith('/productos/1/disponibilidad'));

      // Simular respuesta exitosa de A
      reqPatchA.flush({ ...platoA, disponible: false });

      // Siguiente GET refresca B
      service.loadProducts();
      const reqGet = http.expectOne(esGet);
      reqGet.flush([
        { ...platoA, disponible: false },
        { ...platoB, precio: 15 } // B cambió de precio
      ]);

      expect(service.products().find(p => p.id === '1')?.agotado).toBeTrue();
      expect(service.products().find(p => p.id === '2')?.precio).toBe(15);
    });

    it('D. Dos productos distintos con mutaciones simultáneas: no interfieren entre sí', () => {
      // Toggle de producto 1
      service.toggleAgotado('1');
      // Toggle de producto 2
      service.toggleAgotado('2');

      expect(service.products().find(p => p.id === '1')?.agotado).toBeTrue();
      expect(service.products().find(p => p.id === '2')?.agotado).toBeTrue();

      const patchA = http.expectOne(req => req.method === 'PATCH' && req.url.endsWith('/productos/1/disponibilidad'));
      const patchB = http.expectOne(req => req.method === 'PATCH' && req.url.endsWith('/productos/2/disponibilidad'));

      // Un GET intermedio no debe pisar ninguna de las dos mutaciones en vuelo
      service.loadProducts();
      const reqGet = http.expectOne(esGet);
      reqGet.flush([platoA, platoB]); // GET traía ambos disponibles

      expect(service.products().find(p => p.id === '1')?.agotado).toBeTrue();
      expect(service.products().find(p => p.id === '2')?.agotado).toBeTrue();

      // Resolver ambas mutaciones
      patchA.flush({ ...platoA, disponible: false });
      patchB.flush({ ...platoB, disponible: false });

      expect(service.products().find(p => p.id === '1')?.agotado).toBeTrue();
      expect(service.products().find(p => p.id === '2')?.agotado).toBeTrue();
    });

    it('E. Error HTTP 400/403/500: la interfaz se recupera y las guardas se liberan', () => {
      for (const errStatus of [400, 403, 500]) {
        let errorCapturado: string | null = null;
        service.toggleAgotado('1', err => errorCapturado = err);
        expect(service.products().find(p => p.id === '1')?.agotado).toBeTrue();

        const reqPatch = http.expectOne(req => req.method === 'PATCH' && req.url.endsWith('/productos/1/disponibilidad'));
        reqPatch.flush({ message: `Fallo ${errStatus}` }, { status: errStatus, statusText: 'Error' });

        // Estado revertido limpiamente
        expect(service.products().find(p => p.id === '1')?.agotado).toBeFalse();
        expect(errorCapturado).toBeTruthy();

        // Guarda liberada: un nuevo GET puede actualizar sin quedar bloqueado
        service.loadProducts();
        const reqGet = http.expectOne(esGet);
        reqGet.flush([platoA, platoB]);
        expect(service.products().find(p => p.id === '1')?.agotado).toBeFalse();
      }
    });
  });
});
