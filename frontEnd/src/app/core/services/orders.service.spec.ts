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

  it('no cambia el estado local antes de que el backend confirme, y lo conserva si rechaza', () => {
    service.orders.set([orden('EN_PREPARACION')]);

    service.updateOrderStatus('5', 'CANCELADO').subscribe({ next: () => undefined, error: () => undefined });

    expect(service.orders()[0].estado).withContext('sin HTTP 200 no hay cambio local').toBe('EN_PREPARACION');

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

  it('S7: envía el codigoTicket al entregar un pedido de recojo', () => {
    service.updateOrderStatus('12', 'COMPLETADO', undefined, 'POL-12').subscribe({ next: () => undefined, error: () => undefined });

    const req = http.expectOne(r => r.method === 'PATCH' && r.url.endsWith('/ordenes/12/estado'));
    expect(req.request.body.estado).toBe('ENTREGADO');
    expect(req.request.body.codigoTicket).toBe('POL-12');
    req.flush({ message: 'x' }, { status: 400, statusText: 'Bad Request' });
  });

  it('S7: sin ticket (flujo de reparto) no envía codigoTicket (comportamiento previo)', () => {
    service.updateOrderStatus('5', 'EN_REPARTO', 3).subscribe({ next: () => undefined, error: () => undefined });

    const req = http.expectOne(r => r.method === 'PATCH');
    expect(req.request.body.repartidorId).toBe(3);
    expect(req.request.body.codigoTicket).toBeUndefined();
    req.flush({ message: 'x' }, { status: 400, statusText: 'Bad Request' });
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

/**
 * S3.3 / S4.5 — la segunda ronda de platos va a la MISMA comanda (`POST /ordenes/{id}/items`).
 * Un rechazo del backend no puede quedar como si la comanda se hubiera ampliado.
 */
describe('OrdersService — agregarItemsAOrden', () => {
  let service: OrdersService;
  let http: HttpTestingController;

  const comandaPrevia = (): Order => ({
    id: '7',
    codigoSeguimiento: 'POL-7',
    cliente: { nombre: 'Mesa 03', celular: '', mesaNumero: 3 },
    items: [],
    tipo: 'SALON',
    estado: 'EN_PREPARACION',
    metodoPago: 'EFECTIVO_CONTRAENTREGA',
    subtotal: 45.5,
    costoEnvio: 0,
    descuento: 0,
    total: 45.5,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  });

  const dtoComanda = (total: number) => ({
    id: 7,
    tipo: 'SALON' as const,
    estado: 'EN_PREPARACION',
    total,
    mesaNumero: 3,
    nombreCliente: 'Mesa 03',
    telefonoCliente: '',
    items: [
      { productoId: 1, productoNombre: 'Pollo a la Brasa Entero', cantidad: 1, precioUnitario: 45.5, subtotal: 45.5 },
      { productoId: 3, productoNombre: 'Porción Tequeños Criollos', cantidad: 2, precioUnitario: 19.5, subtotal: 39 }
    ],
    creadoEn: '2026-01-01T00:00:00Z'
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(OrdersService);
    http = TestBed.inject(HttpTestingController);
    http.match(req => req.method === 'GET').forEach(req => req.flush([]));
  });

  afterEach(() => http.verify());

  it('hace POST a /ordenes/7/items y actualiza la orden en memoria', () => {
    service.orders.set([comandaPrevia()]);

    let resultado: Order | null = null;
    service.agregarItemsAOrden('7', [{ productoId: '3', cantidad: 2, notas: 'sin ají' }])
      .subscribe(o => (resultado = o));

    const req = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/ordenes/7/items'));
    expect(req.request.body).toEqual({
      items: [{ productoId: 3, cantidad: 2, notas: 'sin ají' }]
    });
    req.flush(dtoComanda(84.5));

    expect(resultado!.total).toBe(84.5);
    expect(service.orders()[0].total).withContext('la misma orden se actualiza en memoria').toBe(84.5);
  });

  it('propaga el rechazo del backend sin tocar la orden en memoria', () => {
    service.orders.set([comandaPrevia()]);
    const capturado: { mensaje?: string } = {};

    service.agregarItemsAOrden('7', [{ productoId: '3', cantidad: 1 }])
      .subscribe({ error: err => (capturado.mensaje = err.message) });

    http.expectOne(r => r.method === 'POST' && r.url.endsWith('/ordenes/7/items'))
      .flush({ error: 'La comanda #7 ya está ENTREGADO y no admite productos nuevos.' },
        { status: 409, statusText: 'Conflict' });

    expect(capturado.mensaje).toContain('ya está ENTREGADO');
    expect(service.orders()[0].total).toBe(45.5);
  });

  it('con un id inválido no dispara la petición y falla con un mensaje claro', () => {
    const capturado: { mensaje?: string } = {};
    service.agregarItemsAOrden('no-es-un-id', [{ productoId: '3', cantidad: 1 }])
      .subscribe({ error: err => (capturado.mensaje = err.message) });

    http.expectNone(r => r.method === 'POST' && r.url.includes('/items'));
    expect(capturado.mensaje).toContain('inválido');
  });
});

/**
 * S3.1 / S3.3 — el mozo confirma que ya sirvió la comanda. Es una marca persistida, no un cambio
 * de estado: la orden sigue LISTO y la mesa se libera recién al cobrar.
 */
describe('OrdersService — marcarServido', () => {
  let service: OrdersService;
  let http: HttpTestingController;

  const comanda = (): Order => ({
    id: '7',
    codigoSeguimiento: 'POL-7',
    cliente: { nombre: 'Mesa 03', celular: '', mesaNumero: 3 },
    items: [],
    tipo: 'SALON',
    estado: 'LISTO_COCINA',
    metodoPago: 'EFECTIVO_CONTRAENTREGA',
    subtotal: 45.5,
    costoEnvio: 0,
    descuento: 0,
    total: 45.5,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  });

  const dtoServida = (servidoEn: string | null) => ({
    id: 7,
    tipo: 'SALON' as const,
    estado: 'LISTO',
    total: 45.5,
    mesaNumero: 3,
    nombreCliente: 'Mesa 03',
    telefonoCliente: '',
    servidoEn,
    servidoPor: servidoEn ? 7 : null,
    items: [],
    creadoEn: '2026-01-01T00:00:00Z'
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(OrdersService);
    http = TestBed.inject(HttpTestingController);
    http.match(req => req.method === 'GET').forEach(req => req.flush([]));
  });

  afterEach(() => http.verify());

  it('hace POST a /ordenes/7/servir y actualiza la orden en memoria', () => {
    service.orders.set([comanda()]);

    let resultado: Order | null = null;
    service.marcarServido('7').subscribe(o => (resultado = o));

    const req = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/ordenes/7/servir'));
    req.flush(dtoServida('2026-01-01T00:05:00Z'));

    expect(resultado!.servidoEn).toBe('2026-01-01T00:05:00Z');
    expect(service.orders()[0].servidoEn)
      .withContext('la marca debe quedar en la lista compartida')
      .toBe('2026-01-01T00:05:00Z');
    expect(resultado!.estado).withContext('servir no cambia el estado').toBe('LISTO_COCINA');
  });

  it('propaga el rechazo del backend sin marcar la orden en memoria', () => {
    service.orders.set([comanda()]);
    const capturado: { mensaje?: string } = {};

    service.marcarServido('7').subscribe({ error: err => (capturado.mensaje = err.message) });

    http.expectOne(r => r.method === 'POST' && r.url.endsWith('/ordenes/7/servir'))
      .flush({ error: 'La comanda #7 todavía no está lista (estado actual: EN_PREPARACION).' },
        { status: 409, statusText: 'Conflict' });

    expect(capturado.mensaje).toContain('todavía no está lista');
    expect(service.orders()[0].servidoEn).toBeUndefined();
  });

  it('con un id inválido no dispara la petición', () => {
    const capturado: { mensaje?: string } = {};
    service.marcarServido('no-es-un-id').subscribe({ error: err => (capturado.mensaje = err.message) });

    http.expectNone(r => r.method === 'POST' && r.url.includes('/servir'));
    expect(capturado.mensaje).toContain('inválido');
  });
});

/**
 * P1 de la auditoría — un fallo de carga no puede parecer “no hay pedidos”.
 * `loadActiveOrders` intenta /ordenes y /ordenes/activos; si ambos fallan, `hasError` se enciende
 * para que admin/cocina muestren el banner de reintento.
 */
describe('OrdersService — hasError', () => {
  let service: OrdersService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(OrdersService);
    http = TestBed.inject(HttpTestingController);
    http.match(req => req.method === 'GET').forEach(req => req.flush([]));
  });

  afterEach(() => http.verify());

  it('se enciende si fallan /ordenes y el fallback /ordenes/activos', () => {
    service.loadActiveOrders();

    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes'))
      .flush({}, { status: 500, statusText: 'Server Error' });
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/activos'))
      .flush({}, { status: 500, statusText: 'Server Error' });

    expect(service.hasError()).withContext('la UI debe poder avisar del fallo').toBeTrue();
  });

  it('se apaga cuando una carga vuelve a funcionar', () => {
    service.hasError.set(true);

    service.loadActiveOrders();
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes')).flush([]);

    expect(service.hasError()).toBeFalse();
  });
});

/**
 * S10 — el repartidor ve los pedidos disponibles y los toma con un reclamo atómico.
 * La lista la provee el backend (no se filtra localmente) y un 409 conserva el mensaje del backend:
 * nunca puede llegar al llamador como un éxito ni dejar el pedido asignado en la UI.
 */
describe('OrdersService — disponibles y reclamo (S10)', () => {
  let service: OrdersService;
  let http: HttpTestingController;

  const dtoDisponible = (id: number, referencia = 'Portón azul') => ({
    id,
    tipo: 'DELIVERY' as const,
    estado: 'LISTO',
    total: 68.5,
    direccionEntrega: 'Av. Ica 1',
    referencia,
    nombreCliente: 'Cliente',
    telefonoCliente: '999888777',
    items: [
      { productoId: 1, productoNombre: 'Pollo a la Brasa', cantidad: 2, precioUnitario: 30, subtotal: 60 }
    ],
    creadoEn: '2026-01-01T00:00:00Z'
  });

  const ordenLocal = (id: string): Order => ({
    id,
    codigoSeguimiento: `POL-${id}`,
    cliente: { nombre: 'Cliente', celular: '999888777', direccion: 'Av. Ica 1' },
    items: [],
    tipo: 'DELIVERY',
    estado: 'LISTO_COCINA',
    metodoPago: 'EFECTIVO_CONTRAENTREGA',
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

  it('lista los disponibles en GET /ordenes/disponibles y respeta el orden del backend', () => {
    let resultado: Order[] | null = null;
    service.listarDisponiblesParaEntrega().subscribe(list => (resultado = list));

    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/disponibles'))
      .flush([dtoDisponible(11), dtoDisponible(12)]);

    expect(resultado!.map(o => o.id)).withContext('el backend ordena por antigüedad: no se reordena').toEqual(['11', '12']);
    expect(resultado![0].cliente.direccion).toBe('Av. Ica 1');
    expect(resultado![0].cliente.referencia).toBe('Portón azul');
    expect(service.pedidosDisponibles().map(o => o.id)).toEqual(['11', '12']);
  });

  it('reclama con POST /ordenes/{id}/reclamo y refleja la respuesta del backend', () => {
    service.orders.set([ordenLocal('11')]);
    service.pedidosDisponibles.set([ordenLocal('11')]);

    let resultado: Order | null = null;
    service.reclamarPedido('11').subscribe(o => (resultado = o));

    const req = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/ordenes/11/reclamo'));
    req.flush({ ...dtoDisponible(11), repartidorId: 7 });

    expect(resultado!.repartidorId).toBe(7);
    expect(service.orders()[0].repartidorId)
      .withContext('la lista compartida refleja lo que confirmó el backend')
      .toBe(7);
    expect(service.pedidosDisponibles().map(o => o.id))
      .withContext('un pedido ya reclamado deja de ofrecerse')
      .not.toContain('11');
  });

  it('propaga el 409 con el mensaje del backend y no reporta éxito', () => {
    service.orders.set([ordenLocal('11')]);

    let emitido: Order | null = null;
    let mensaje = '';
    service.reclamarPedido('11').subscribe({
      next: o => (emitido = o),
      error: (e: Error) => (mensaje = e.message)
    });

    http.expectOne(r => r.method === 'POST' && r.url.endsWith('/ordenes/11/reclamo'))
      .flush({ error: 'El pedido #11 ya fue tomado por un repartidor.' }, { status: 409, statusText: 'Conflict' });

    expect(emitido).withContext('un 409 no puede emitirse como resultado').toBeNull();
    expect(mensaje).withContext('el mensaje es el del backend, tal cual').toBe('El pedido #11 ya fue tomado por un repartidor.');
    expect(service.orders()[0].repartidorId).withContext('sin confirmación no se asigna el pedido').toBeUndefined();
  });

  it('con un id inválido no dispara el POST y falla con un mensaje claro', () => {
    let mensaje = '';
    service.reclamarPedido('no-es-un-id').subscribe({ error: (e: Error) => (mensaje = e.message) });

    http.expectNone(r => r.method === 'POST' && r.url.includes('/reclamo'));
    expect(mensaje).toContain('inválido');
  });
});

describe('OrdersService — createOrder desde un Order del checkout', () => {
  let service: OrdersService;
  let http: HttpTestingController;

  const orderBase = (estado: Order['estado'], extra: Partial<Order> = {}): Order => ({
    id: '0',
    codigoSeguimiento: '',
    cliente: { nombre: 'Ana', celular: '987654321', direccion: 'Av. Grau 123', referencia: 'Portón azul' },
    items: [{ product: { id: 'prod-1' } as Order['items'][number]['product'], cantidad: 1 } as Order['items'][number]],
    tipo: 'DELIVERY',
    estado,
    subtotal: 18,
    costoEnvio: 6,
    descuento: 0,
    total: 24,
    createdAt: '',
    updatedAt: '',
    ...extra
  });

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(OrdersService);
    http = TestBed.inject(HttpTestingController);
    http.match(req => req.method === 'GET').forEach(req => req.flush([]));
  });

  afterEach(() => http.verify());

  it('ContraPago envía estadoInicial PENDIENTE_CONFIRMACION y el monto con el que paga', () => {
    service.createOrder(orderBase('PENDIENTE_CONFIRMACION', { metodoPago: 'EFECTIVO_CONTRAENTREGA', montoPagaCon: 50 })).subscribe();

    const req = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/ordenes'));
    expect(req.request.body.estadoInicial).toBe('PENDIENTE_CONFIRMACION');
    expect(req.request.body.montoPagaCon).toBe(50);
    req.flush({ id: 1, tipo: 'DELIVERY', estado: 'PENDIENTE_CONFIRMACION', total: 24, items: [], creadoEn: '2026-01-01T00:00:00Z' });
  });

  it('un pago con tarjeta (estado local PENDIENTE) no envía estadoInicial: el backend decide (comportamiento previo)', () => {
    service.createOrder(orderBase('RECIBIDO', { metodoPago: 'TARJETA' })).subscribe();

    const req = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/ordenes'));
    expect(req.request.body.estadoInicial).toBeUndefined();
    expect(req.request.body.montoPagaCon).toBeUndefined();
    req.flush({ id: 2, tipo: 'DELIVERY', estado: 'RECIBIDO', total: 24, items: [], creadoEn: '2026-01-01T00:00:00Z' });
  });

  it('S1: una orden web por pagar (tarjeta / Yape OTP) se abre en PENDIENTE_PAGO, nunca en RECIBIDO', () => {
    let creada: Order | null = null;
    service.createOrder(orderBase('PENDIENTE_PAGO', { metodoPago: 'TARJETA' })).subscribe(o => (creada = o));

    const req = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/ordenes'));
    expect(req.request.body.estadoInicial).toBe('PENDIENTE_PAGO');
    req.flush({ id: 3, tipo: 'DELIVERY', estado: 'PENDIENTE_PAGO', total: 24, items: [], creadoEn: '2026-01-01T00:00:00Z' });
    expect(creada).not.toBeNull();
    expect(creada!.estado).withContext('la vista muestra el pedido esperando pago').toBe('PENDIENTE_PAGO');
  });
});
