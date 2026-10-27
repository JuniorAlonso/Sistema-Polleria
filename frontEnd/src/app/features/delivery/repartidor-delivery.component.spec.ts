import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RepartidorDeliveryComponent } from './repartidor-delivery.component';
import { OrdersService } from '../../core/services/orders.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { User } from '../../core/models/user.model';
import { Order } from '../../core/models/order.model';

function usuarioRepartidor(userId: number): User {
  return { id: String(userId), nombre: 'Moto', correo: 'moto@sanpollo.pe', celular: '999999999', rol: 'REPARTIDOR' };
}

/** Token con la forma real (header.payload.signature) y el claim `userId` que firma el backend. */
function tokenConUserId(userId: number): string {
  const base64url = btoa(JSON.stringify({ userId }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `cabecera.${base64url}.firma-falsa`;
}

function orden(over: Partial<Order> & { id: string }): Order {
  return {
    codigoSeguimiento: `POL-${over.id}`,
    cliente: { nombre: 'Cliente', celular: '999999999', direccion: 'Av. Ica 1' },
    items: [],
    tipo: 'DELIVERY',
    estado: 'LISTO_COCINA',
    metodoPago: 'EFECTIVO_CONTRAENTREGA',
    requiereCobroEfectivo: true,
    subtotal: 50,
    costoEnvio: 0,
    descuento: 0,
    total: 50,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...over
  } as Order;
}

function botonTomarPedido(fixture: ComponentFixture<RepartidorDeliveryComponent>): HTMLButtonElement | null {
  const botones = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
  return botones.find(b => (b.textContent || '').includes('Tomar Pedido')) ?? null;
}

/** Botón de la sección nueva «Pedidos disponibles para entregar» (minúscula, distinto del de las cards). */
function botonTomarDisponible(fixture: ComponentFixture<RepartidorDeliveryComponent>): HTMLButtonElement | null {
  const botones = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
  return botones.find(b => (b.textContent || '').includes('Tomar pedido')) ?? null;
}

/**
 * S6.6/S6.7 — la bandeja del motorizado es una cola compartida:
 * disponibles sin asignar, mis entregas activas e historial propio, todo filtrado por el
 * `userId` del JWT.
 */
describe('RepartidorDeliveryComponent — cola compartida del motorizado', () => {
  const MI_ID = 7;

  let fixture: ComponentFixture<RepartidorDeliveryComponent>;
  let component: RepartidorDeliveryComponent;
  let http: HttpTestingController;
  let ordersService: OrdersService;
  let auth: AuthService;
  let notify: NotificationService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [RepartidorDeliveryComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });

    fixture = TestBed.createComponent(RepartidorDeliveryComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    ordersService = TestBed.inject(OrdersService);
    auth = TestBed.inject(AuthService);
    notify = TestBed.inject(NotificationService);

    auth.token.set(tokenConUserId(MI_ID));
    fixture.detectChanges();

    // Descarta las peticiones iniciales del sondeo (loadActiveOrders).
    http.match(req => req.method === 'GET').forEach(req => req.flush([]));
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
  });

  it('construye las tres listas desde el userId del token', () => {
    ordersService.orders.set([
      orden({ id: '1', estado: 'LISTO_COCINA' }),
      orden({ id: '2', estado: 'EN_REPARTO', repartidorId: MI_ID }),
      orden({ id: '4', estado: 'COMPLETADO', repartidorId: MI_ID })
    ]);
    fixture.detectChanges();

    expect(component.miIdMotorizado()).toBe(MI_ID);
    expect(component.readyForPickupOrders().map(o => o.id))
      .withContext('disponibles: LISTO sin repartidor')
      .toEqual(['1']);
    expect(component.misEntregasActivas().map(o => o.id))
      .withContext('mis entregas: EN_REPARTO con mi id')
      .toEqual(['2']);
    expect(component.completedDeliveryOrders().map(o => o.id))
      .withContext('historial: COMPLETADO con mi id')
      .toEqual(['4']);
    expect(component.activeDeliveryOrders().map(o => o.id))
      .withContext('TODAS = disponibles + mis entregas')
      .toEqual(['1', '2']);
  });

  it('reescribe los subfiltros sobre las listas de la cola compartida', () => {
    ordersService.orders.set([
      orden({ id: '1', estado: 'LISTO_COCINA' }),
      orden({ id: '2', estado: 'EN_REPARTO', repartidorId: MI_ID })
    ]);
    fixture.detectChanges();

    component.subFilter.set('POR_RECOGER');
    expect(component.filteredActiveDeliveryOrders().map(o => o.id)).toEqual(['1']);

    component.subFilter.set('EN_RUTA');
    expect(component.filteredActiveDeliveryOrders().map(o => o.id)).toEqual(['2']);

    component.subFilter.set('TODAS');
    expect(component.filteredActiveDeliveryOrders().map(o => o.id)).toEqual(['1', '2']);
  });

  it('un pedido LISTO asignado a otro motorizado no aparece en ninguna lista (S6.7)', () => {
    ordersService.orders.set([
      orden({ id: '1', estado: 'LISTO_COCINA' }),
      orden({ id: '2', estado: 'EN_REPARTO', repartidorId: MI_ID }),
      orden({ id: '3', estado: 'LISTO_COCINA', repartidorId: 9 }),
      orden({ id: '4', estado: 'COMPLETADO', repartidorId: MI_ID }),
      orden({ id: '5', estado: 'COMPLETADO', repartidorId: 9 }),
      orden({ id: '6', estado: 'EN_REPARTO', repartidorId: 9 })
    ]);
    fixture.detectChanges();

    const visibles = [
      ...component.readyForPickupOrders(),
      ...component.misEntregasActivas(),
      ...component.completedDeliveryOrders()
    ].map(o => o.id);

    expect(visibles).not.toContain('3');
    expect(visibles).not.toContain('5');
    expect(visibles).not.toContain('6');
  });

  it('incluye en mis entregas un pedido LISTO ya asignado a mí y permite tomarlo', () => {
    ordersService.orders.set([orden({ id: '7', estado: 'LISTO_COCINA', repartidorId: MI_ID })]);
    fixture.detectChanges();

    expect(component.misEntregasActivas().map(o => o.id))
      .withContext('el admin ya me lo asignó: debe verse aunque siga LISTO')
      .toEqual(['7']);
    expect(component.readyForPickupOrders().map(o => o.id))
      .withContext('un pedido ya asignado a mí no es un disponible de la cola')
      .toEqual([]);

    const boton = botonTomarPedido(fixture);
    expect(boton).withContext('debe poder tomarse con el mismo botón').not.toBeNull();
    expect(boton!.disabled).toBeFalse();

    boton!.click();
    fixture.detectChanges();

    const req = http.expectOne(r => r.method === 'PATCH' && r.url.includes('/ordenes/7/estado'));
    expect(req.request.body)
      .withContext('un pedido asignado a mí se envía con mi repartidorId')
      .toEqual({ estado: 'EN_CAMINO', repartidorId: MI_ID });

    req.flush({
      id: 7,
      tipo: 'DELIVERY',
      estado: 'EN_CAMINO',
      repartidorId: MI_ID,
      total: 50,
      nombreCliente: 'Cliente',
      telefonoCliente: '999999999',
      items: [],
      creadoEn: '2026-01-01T00:00:00Z'
    });
  });

  it('al tomar un pedido sin dueño usa el reclamo atómico (POST /reclamo)', () => {
    ordersService.orders.set([orden({ id: '1', estado: 'LISTO_COCINA' })]);
    fixture.detectChanges();

    const boton = botonTomarPedido(fixture);
    expect(boton).withContext('debe existir el botón «Tomar Pedido»').not.toBeNull();
    expect(boton!.disabled).toBeFalse();

    boton!.click();
    fixture.detectChanges();

    const req = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/ordenes/1/reclamo'));
    expect(req.request.body)
      .withContext('el repartidor lo asigna el backend con el token, no el cuerpo')
      .toEqual({});

    req.flush({
      id: 1,
      tipo: 'DELIVERY',
      estado: 'LISTO',
      repartidorId: MI_ID,
      total: 50,
      nombreCliente: 'Cliente',
      telefonoCliente: '999999999',
      items: [],
      creadoEn: '2026-01-01T00:00:00Z'
    });

    // El pedido reclamado se refresca con el sondeo de la pantalla, sin optimismo local.
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/disponibles')).flush([]);
    http.match(r => r.method === 'GET' && r.url.endsWith('/ordenes')).forEach(r => r.flush([]));
  });

  it('sin identidad en el token avisa en pantalla y no envía repartidorId nulo', () => {
    auth.token.set(null);
    ordersService.orders.set([orden({ id: '1', estado: 'LISTO_COCINA' })]);
    fixture.detectChanges();

    expect(component.miIdMotorizado()).toBeNull();
    expect(fixture.nativeElement.textContent)
      .withContext('debe mostrarse un aviso claro de identidad faltante')
      .toContain('No se pudo identificar');

    const boton = botonTomarPedido(fixture);
    expect(boton).withContext('el botón debe seguir visible pero deshabilitado').not.toBeNull();
    expect(boton!.disabled).withContext('«Tomar Pedido» deshabilitado sin identidad').toBeTrue();

    component.tomarPedido(ordersService.orders()[0]);
    fixture.detectChanges();

    http.expectNone(r => r.method === 'PATCH');
    http.expectNone(r => r.method === 'POST' && r.url.includes('/reclamo'));
  });

  it('mantiene «Cobrar y Entregar» para mis entregas activas (comportamiento previo)', () => {
    ordersService.orders.set([orden({ id: '2', estado: 'EN_PUERTA', repartidorId: MI_ID })]);
    fixture.detectChanges();

    const boton = (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[])
      .find(b => (b.textContent || '').includes('Cobrar y Entregar'));
    expect(boton).withContext('el botón de cobro debe seguir disponible en mis entregas').not.toBeUndefined();

    boton!.click();
    fixture.detectChanges();

    expect(component.selectedOrderModal()?.id).toBe('2');
  });

  it('comandas de SALON nunca aparecen en las bandejas del repartidor aunque estén en LISTO_COCINA', () => {
    ordersService.orders.set([
      orden({ id: '10', tipo: 'SALON', estado: 'LISTO_COCINA' }),
      orden({ id: '11', tipo: 'DELIVERY', estado: 'LISTO_COCINA' })
    ]);
    fixture.detectChanges();

    const disponibles = component.readyForPickupOrders().map(o => o.id);
    expect(disponibles).not.toContain('10');
    expect(disponibles).toContain('11');

    const activas = component.filteredActiveDeliveryOrders().map(o => o.id);
    expect(activas).not.toContain('10');
    expect(activas).toContain('11');
  });

  it('si se intenta tomar un pedido de SALON, es rechazado y no dispara PATCH', () => {
    const ordenSalon = orden({ id: '10', tipo: 'SALON', estado: 'LISTO_COCINA' });
    component.tomarPedido(ordenSalon);
    fixture.detectChanges();

    const patchRequests = http.match(r => r.method === 'PATCH');
    expect(patchRequests.length).withContext('no debe dispararse ninguna llamada PATCH').toBe(0);
    expect(http.match(r => r.method === 'POST' && r.url.includes('/reclamo')).length)
      .withContext('un pedido de salón no se reclama')
      .toBe(0);
  });

  // ---- S10: sección de pedidos disponibles y reclamo atómico ----

  const dtoDisponible = (
    id: number,
    over: { referencia?: string; repartidorId?: number; direccion?: string } = {}
  ) => ({
    id,
    tipo: 'DELIVERY' as const,
    estado: 'LISTO',
    total: 68.5,
    direccionEntrega: over.direccion ?? 'Calle Las Begonias 123',
    referencia: over.referencia ?? 'Frente al parque',
    repartidorId: over.repartidorId,
    nombreCliente: 'Cliente',
    telefonoCliente: '999888777',
    items: [
      { productoId: 1, productoNombre: 'Pollo a la Brasa', cantidad: 2, precioUnitario: 30, subtotal: 60 }
    ],
    creadoEn: '2026-01-01T00:00:00Z'
  });

  it('solo el rol REPARTIDOR ve la sección «Pedidos disponibles para entregar»', () => {
    ordersService.pedidosDisponibles.set([orden({ id: '11', estado: 'LISTO_COCINA' })]);
    auth.currentUser.set(usuarioRepartidor(MI_ID));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent)
      .withContext('el repartidor sí ve la sección')
      .toContain('Pedidos disponibles para entregar');

    auth.currentUser.set({ ...usuarioRepartidor(1), rol: 'ADMIN' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent)
      .withContext('el ADMIN no ve la sección del repartidor')
      .not.toContain('Pedidos disponibles para entregar');
  });

  it('la lista muestra número, dirección, referencia, total y cantidad de ítems', () => {
    ordersService.pedidosDisponibles.set([
      orden({
        id: '11',
        estado: 'LISTO_COCINA',
        total: 68.5,
        cliente: { nombre: 'Cliente', celular: '999888777', direccion: 'Calle Las Begonias 123', referencia: 'Frente al parque' },
        items: [
          {
            product: { id: '1', nombre: 'Pollo a la Brasa', descripcion: '', precio: 30, imagenUrl: '', categoria: 'POLLOS_A_LA_BRASA', agotado: false },
            cantidad: 2,
            subtotal: 60
          }
        ]
      })
    ]);
    auth.currentUser.set(usuarioRepartidor(MI_ID));
    fixture.detectChanges();

    const seccion = (fixture.nativeElement.querySelector('section') as HTMLElement).textContent || '';
    expect(seccion).toContain('#11');
    expect(seccion).toContain('Calle Las Begonias 123');
    expect(seccion).toContain('Frente al parque');
    expect(seccion).toContain('S/ 68.50');
    expect(seccion).toContain('2 ítems');
  });

  it('al tomar un disponible reclama y refresca con la verdad del backend (sin optimismo local)', () => {
    ordersService.pedidosDisponibles.set([orden({ id: '11', estado: 'LISTO_COCINA' })]);
    auth.currentUser.set(usuarioRepartidor(MI_ID));
    fixture.detectChanges();

    const boton = botonTomarDisponible(fixture);
    expect(boton).withContext('debe existir el botón «Tomar pedido» de la sección').not.toBeNull();

    boton!.click();
    fixture.detectChanges();

    const req = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/ordenes/11/reclamo'));
    expect(ordersService.pedidosDisponibles().map(o => o.id))
      .withContext('sin confirmar del backend el pedido sigue en la lista')
      .toContain('11');

    req.flush(dtoDisponible(11, { repartidorId: MI_ID }));

    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/disponibles')).flush([]);
    http.match(r => r.method === 'GET' && r.url.endsWith('/ordenes'))
      .forEach(r => r.flush([dtoDisponible(11, { repartidorId: MI_ID })]));

    expect(ordersService.pedidosDisponibles().map(o => o.id))
      .withContext('deja de estar disponible')
      .not.toContain('11');
    expect(component.misEntregasActivas().map(o => o.id))
      .withContext('aparece entre los del repartidor')
      .toContain('11');
  });

  it('un 409 muestra el mensaje del backend y refresca la lista', () => {
    spyOn(notify, 'showError');
    ordersService.pedidosDisponibles.set([orden({ id: '11', estado: 'LISTO_COCINA' })]);
    auth.currentUser.set(usuarioRepartidor(MI_ID));
    fixture.detectChanges();

    botonTomarDisponible(fixture)!.click();
    fixture.detectChanges();

    http.expectOne(r => r.method === 'POST' && r.url.endsWith('/ordenes/11/reclamo'))
      .flush({ error: 'El pedido #11 ya fue tomado por un repartidor.' }, { status: 409, statusText: 'Conflict' });

    // La verdad del pedido: lo tiene otro repartidor.
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/11'))
      .flush(dtoDisponible(11, { repartidorId: 9 }));

    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/disponibles')).flush([]);
    http.match(r => r.method === 'GET' && r.url.endsWith('/ordenes')).forEach(r => r.flush([]));

    expect(notify.showError).toHaveBeenCalledWith('El pedido #11 ya fue tomado por un repartidor.');
    expect(component.misEntregasActivas().map(o => o.id))
      .withContext('un pedido de otro no aparece como mío')
      .not.toContain('11');
  });

  it('un 409 por reintento del mismo repartidor lo muestra como suyo, no como un error', () => {
    spyOn(notify, 'showError');
    const exito = spyOn(notify, 'showSuccess');
    ordersService.pedidosDisponibles.set([orden({ id: '11', estado: 'LISTO_COCINA' })]);
    auth.currentUser.set(usuarioRepartidor(MI_ID));
    fixture.detectChanges();

    botonTomarDisponible(fixture)!.click();
    fixture.detectChanges();

    http.expectOne(r => r.method === 'POST' && r.url.endsWith('/ordenes/11/reclamo'))
      .flush({ error: 'El pedido #11 ya fue tomado por un repartidor.' }, { status: 409, statusText: 'Conflict' });

    // El reintento choca con el mismo repartidor: el pedido ya es suyo.
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/11'))
      .flush(dtoDisponible(11, { repartidorId: MI_ID }));

    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/disponibles')).flush([]);
    http.match(r => r.method === 'GET' && r.url.endsWith('/ordenes'))
      .forEach(r => r.flush([dtoDisponible(11, { repartidorId: MI_ID })]));

    expect(notify.showError).withContext('no es un error si el pedido quedó mío').not.toHaveBeenCalled();
    expect(exito).toHaveBeenCalled();
    expect(component.misEntregasActivas().map(o => o.id)).toContain('11');
  });
});
