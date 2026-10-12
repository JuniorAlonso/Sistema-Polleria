import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OrdersService } from './orders.service';
import { Order } from '../models/order.model';

/**
 * Regla de negocio (S3.1): una mutación rechazada por el backend nunca puede
 * llegar al llamador como un resultado válido ni dejar la UI en el estado nuevo.
 */
describe('OrdersService — updateOrderStatus', () => {
  let service: OrdersService;
  let http: HttpTestingController;

  const orden = (estado: Order['estado'] = 'EN_PREPARACION'): Order => ({
    id: '5',
    codigoSeguimiento: 'POL-5',
    cliente: { nombre: 'María', celular: '999888777', direccion: 'Av. Siempre Viva 742' },
    items: [],
    tipo: 'DELIVERY',
    estado,
    metodoPago: 'TARJETA',
    subtotal: 68.5,
    costoEnvio: 0,
    descuento: 0,
    total: 68.5,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(OrdersService);
    http = TestBed.inject(HttpTestingController);

    // El constructor dispara loadMyOrders(): se descarta esa carga inicial.
    http.match(req => req.method === 'GET').forEach(req => req.flush([]));
  });

  afterEach(() => http.verify());

  it('propaga el rechazo del backend en lugar de emitir un resultado nulo', () => {
    service.orders.set([orden()]);

    let emitido: unknown = 'sin-emitir';
    let fallo = false;

    service.updateOrderStatus('5', 'CANCELADO').subscribe({
      next: valor => (emitido = valor),
      error: () => (fallo = true)
    });

    http.expectOne(req => req.method === 'PATCH')
      .flush({ message: 'no autorizado' }, { status: 403, statusText: 'Forbidden' });

    expect(fallo).withContext('el llamador debe enterarse del rechazo').toBeTrue();
    expect(emitido).withContext('null no es un resultado válido').toBe('sin-emitir');
  });

  it('revierte el cambio optimista cuando el backend rechaza la transición', () => {
    service.orders.set([orden('EN_PREPARACION')]);

    service.updateOrderStatus('5', 'CANCELADO').subscribe({ next: () => undefined, error: () => undefined });

    expect(service.orders()[0].estado).withContext('cambio optimista aplicado').toBe('CANCELADO');

    http.expectOne(req => req.method === 'PATCH')
      .flush({ message: 'transición inválida' }, { status: 409, statusText: 'Conflict' });

    expect(service.orders()[0].estado)
      .withContext('si el backend no confirmó, la orden no puede quedar cancelada en la UI')
      .toBe('EN_PREPARACION');
  });

  it('mantiene la actualización cuando el backend confirma', () => {
    service.orders.set([orden()]);

    let actualizado: Order | null = null;
    service.updateOrderStatus('5', 'CANCELADO').subscribe(valor => (actualizado = valor));

    http.expectOne(req => req.method === 'PATCH').flush({
      id: 5,
      tipo: 'DELIVERY',
      estado: 'CANCELADO',
      total: 68.5,
      nombreCliente: 'María',
      telefonoCliente: '999888777',
      items: [],
      creadoEn: '2026-01-01T00:00:00Z'
    });

    expect(actualizado).not.toBeNull();
    expect(service.orders()[0].estado).toBe('CANCELADO');
  });
});
