import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminShellStore } from './admin-shell.store';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ProductsService } from '../../../core/services/products.service';
import { SalonService } from '../../../core/services/salon.service';
import { dtoOrden, mesa, mesaConComanda, productoDto, tokenDeSesion } from '../testing/admin-test-helpers';

/**
 * S4.7 — el admin puede tomar una comanda para una mesa concreta y agregar la segunda
 * ronda a la comanda activa (modal de orden manual compartido entre Órdenes y Mesas).
 */
describe('AdminShellStore — comanda de salón', () => {
  let store: AdminShellStore;
  let http: HttpTestingController;
  let notify: NotificationService;
  let salon: SalonService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    TestBed.inject(AuthService).token.set(tokenDeSesion());
    store = TestBed.inject(AdminShellStore);
    http = TestBed.inject(HttpTestingController);
    notify = TestBed.inject(NotificationService);
    salon = TestBed.inject(SalonService);

    spyOn(notify, 'showSuccess');
    spyOn(notify, 'showError');
    spyOn(notify, 'showInfo');
    spyOn(notify, 'showWarning');

    // La carta se necesita para poder elegir un producto en el modal.
    TestBed.inject(ProductsService).loadProducts();
    http.match(r => r.method === 'GET' && r.url.includes('/productos'))
      .forEach(r => r.flush([productoDto]));
  });

  afterEach(() => {
    salon.detenerSincronizacion();
    http.match(r => r.method === 'GET').forEach(r => r.flush([]));
    http.verify();
  });

  function flushRecargas(): void {
    http.match(r => r.method === 'GET' && (r.url.endsWith('/mesas') || r.url.endsWith('/ordenes')))
      .forEach(r => r.flush([]));
  }

  it('el alta manual de salón exige la mesa y la envía como mesaId (S4.7)', () => {
    const m = mesa();
    salon.mesas.set([m]);

    store.abrirTomarComandaMesa(m);
    expect(store.manualOrder.modo).toBe('CREAR');
    expect(store.manualOrder.tipo).toBe('SALON');
    expect(store.manualOrder.mesaId)
      .withContext('la mesa se elige en el inspector, no se asume la 1')
      .toBe(3);

    store.manualOrder.cantidad = 2;
    store.crearOrdenManual();

    const post = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/ordenes'));
    expect(post.request.body.tipo).toBe('SALON');
    expect(post.request.body.mesaId).toBe(3);
    expect(post.request.body.nombreCliente).toBe('Mesa 03');
    expect(post.request.body.items[0].productoId).toBe(1);
    expect(post.request.body.items[0].cantidad).toBe(2);

    post.flush(dtoOrden({ id: 10, estado: 'RECIBIDO' }));
    flushRecargas();

    expect(store.showCreateOrderModal).toBeFalse();
    expect(notify.showSuccess).toHaveBeenCalled();
  });

  it('agrega platos a la comanda activa desde el inspector, sin abrir otra (S4.7)', () => {
    const m = mesaConComanda();
    salon.mesas.set([m]);

    store.abrirAgregarPlatosMesa(m);
    expect(store.manualOrder.modo).toBe('AGREGAR');
    expect(store.manualOrder.ordenId).toBe('7');

    store.crearOrdenManual();

    const post = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/ordenes/7/items'));
    expect(post.request.body.items[0].productoId).toBe(1);
    http.expectNone(r => r.method === 'POST' && r.url.endsWith('/ordenes'));

    post.flush(dtoOrden({ total: 110 }));
    flushRecargas();

    expect(notify.showSuccess).toHaveBeenCalled();
  });
});
