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

  describe('dispatchDeliveryOrder', () => {
    it('pasa primero por LISTO_COCINA cuando la orden está EN_PREPARACION y luego a EN_REPARTO con repartidorId', () => {
      service.orders.set([orden('EN_PREPARACION')]);

      let resultadoFinal: Order | null = null;
      service.dispatchDeliveryOrder(orden('EN_PREPARACION'), 4).subscribe(res => {
        resultadoFinal = res;
      });

      // Primer request: debe solicitar LISTO
      const req1 = http.expectOne(req => req.method === 'PATCH' && req.body.estado === 'LISTO');
      req1.flush({
        id: 5,
        tipo: 'DELIVERY',
        estado: 'LISTO',
        total: 68.5,
        nombreCliente: 'María',
        telefonoCliente: '999888777',
        items: [],
        creadoEn: '2026-01-01T00:00:00Z'
      });

      // Segundo request: debe solicitar EN_CAMINO con repartidorId = 4
      const req2 = http.expectOne(req => req.method === 'PATCH' && req.body.estado === 'EN_CAMINO' && req.body.repartidorId === 4);
      req2.flush({
        id: 5,
        tipo: 'DELIVERY',
        estado: 'EN_CAMINO',
        repartidorId: 4,
        total: 68.5,
        nombreCliente: 'María',
        telefonoCliente: '999888777',
        items: [],
        creadoEn: '2026-01-01T00:00:00Z'
      });

      expect(resultadoFinal).not.toBeNull();
      expect(service.orders()[0].estado).toBe('EN_REPARTO');
      expect(service.orders()[0].repartidorId).toBe(4);
    });

    it('despacha directamente a EN_REPARTO con repartidorId cuando la orden ya está LISTO_COCINA', () => {
      service.orders.set([orden('LISTO_COCINA')]);

      let resultado: Order | null = null;
      service.dispatchDeliveryOrder(orden('LISTO_COCINA'), 4).subscribe(res => {
        resultado = res;
      });

      const req = http.expectOne(req => req.method === 'PATCH' && req.body.estado === 'EN_CAMINO' && req.body.repartidorId === 4);
      req.flush({
        id: 5,
        tipo: 'DELIVERY',
        estado: 'EN_CAMINO',
        repartidorId: 4,
        total: 68.5,
        nombreCliente: 'María',
        telefonoCliente: '999888777',
        items: [],
        creadoEn: '2026-01-01T00:00:00Z'
      });

      expect(resultado).not.toBeNull();
      expect(service.orders()[0].estado).toBe('EN_REPARTO');
      expect(service.orders()[0].repartidorId).toBe(4);
    });
  });
});

/**
 * S6.5 — lectura puntual de una orden para el modal de mesa del mozo.
 * Es una consulta sin efectos secundarios: no puede alterar las listas compartidas del servicio.
 */
describe('OrdersService — obtenerOrden', () => {
  let service: OrdersService;
  let http: HttpTestingController;

  const dtoOrden = (estado = 'LISTO', total = 98.5) => ({
    id: 7,
    tipo: 'SALON' as const,
    estado,
    total,
    mesaNumero: 3,
    nombreCliente: 'Mesa 03',
    telefonoCliente: '',
    items: [
      { productoId: 1, productoNombre: 'Pollo a la Brasa Entero', cantidad: 1, precioUnitario: 65, subtotal: 65 },
      { productoId: 2, productoNombre: 'Jarra Chicha Morada 1L', cantidad: 1, precioUnitario: 14, subtotal: 14 },
      { productoId: 3, productoNombre: 'Porción Tequeños Criollos', cantidad: 1, precioUnitario: 19.5, subtotal: 19.5 }
    ],
    creadoEn: '2026-01-01T00:00:00Z'
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

  it('hace GET a /ordenes/7 y mapea la respuesta a Order', () => {
    let resultado: Order | null = null;
    service.obtenerOrden('7').subscribe(o => (resultado = o));

    const req = http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/7'));
    req.flush(dtoOrden());

    expect(resultado).not.toBeNull();
    expect(resultado!.id).toBe('7');
    expect(resultado!.tipo).toBe('SALON');
    expect(resultado!.estado).withContext('LISTO del backend equivale a LISTO_COCINA').toBe('LISTO_COCINA');
    expect(resultado!.items.map(i => i.product.nombre)).toEqual([
      'Pollo a la Brasa Entero',
      'Jarra Chicha Morada 1L',
      'Porción Tequeños Criollos'
    ]);
    expect(resultado!.total).toBe(98.5);
  });

  it('propaga el mensaje real del backend cuando la orden no existe', () => {
    const capturado: { mensaje?: string } = {};
    service.obtenerOrden('7').subscribe({ error: err => (capturado.mensaje = err.message) });

    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/7'))
      .flush({ error: 'La orden no existe' }, { status: 404, statusText: 'Not Found' });

    expect(capturado.mensaje).toBe('La orden no existe');
  });

  it('con un id inválido no dispara ninguna petición y falla con un mensaje claro', () => {
    const capturado: { mensaje?: string } = {};
    service.obtenerOrden('no-es-un-id').subscribe({ error: err => (capturado.mensaje = err.message) });

    http.expectNone(r => r.method === 'GET' && r.url.includes('/ordenes'));
    expect(capturado.mensaje).withContext('no se puede pedir GET /ordenes/NaN').toContain('inválido');
  });

  it('no altera orders() ni currentTrackingOrder()', () => {
    const previa: Order = {
      id: '5',
      codigoSeguimiento: 'POL-5',
      cliente: { nombre: 'María', celular: '999888777', direccion: 'Av. Siempre Viva 742' },
      items: [],
      tipo: 'DELIVERY',
      estado: 'EN_PREPARACION',
      metodoPago: 'TARJETA',
      subtotal: 68.5,
      costoEnvio: 0,
      descuento: 0,
      total: 68.5,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    };
    service.orders.set([previa]);
    const trackingAntes = service.currentTrackingOrder();

    service.obtenerOrden('7').subscribe();
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/7')).flush(dtoOrden());

    expect(service.orders().map(o => o.id)).toEqual(['5']);
    expect(service.currentTrackingOrder()).toBe(trackingAntes);
  });
});
