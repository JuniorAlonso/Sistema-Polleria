import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Repartidor, RepartidoresService } from './repartidores.service';

/**
 * RF18: el modal de asignación solo puede ofrecer motorizados que existan en auth-service.
 * Si el roster no se puede leer, la UI debe informarlo: nunca inventar un motorizado.
 */
describe('RepartidoresService', () => {
  let service: RepartidoresService;
  let http: HttpTestingController;

  const rider: Repartidor = {
    id: 4,
    nombre: 'Repartidor Motorizado',
    email: 'repartidor.polleria@yopmail.com',
    telefono: '990000004'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(RepartidoresService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('no consulta el roster hasta que la pantalla se lo pide', () => {
    http.expectNone(req => req.url.includes('repartidores'));
    expect(service.repartidores()).toEqual([]);
  });

  it('carga el roster real del auth-service y expone el nombre por id', () => {
    service.cargar();

    const peticion = http.expectOne(
      req => req.method === 'GET' && req.url.endsWith('/auth/admin/repartidores')
    );
    peticion.flush([rider]);

    expect(service.repartidores()).toEqual([rider]);
    expect(service.nombrePorId()[4]).toBe('Repartidor Motorizado');
    expect(service.hasError()).toBeFalse();
  });

  it('ante un rechazo deja el roster vacío y marca el fallo en vez de fabricar motorizados', () => {
    service.cargar();

    http.expectOne(req => req.url.endsWith('/auth/admin/repartidores'))
      .flush({ message: 'no autorizado' }, { status: 403, statusText: 'Forbidden' });

    expect(service.repartidores()).toEqual([]);
    expect(service.hasError()).withContext('el modal debe poder avisar que no pudo cargar')
      .toBeTrue();
  });
});
