import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RepartidorDeliveryComponent } from './repartidor-delivery.component';
import { OrdersService } from '../../core/services/orders.service';
import { AuthService } from '../../core/services/auth.service';
import { Order } from '../../core/models/order.model';

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

  it('al tomar un pedido envía el userId del token como repartidorId', () => {
    ordersService.orders.set([orden({ id: '1', estado: 'LISTO_COCINA' })]);
    fixture.detectChanges();

    const boton = botonTomarPedido(fixture);
    expect(boton).withContext('debe existir el botón «Tomar Pedido»').not.toBeNull();
    expect(boton!.disabled).toBeFalse();

    boton!.click();
    fixture.detectChanges();

    const req = http.expectOne(r => r.method === 'PATCH' && r.url.includes('/ordenes/1/estado'));
    expect(req.request.body)
      .withContext('nunca se envía EN_CAMINO sin repartidorId')
      .toEqual({ estado: 'EN_CAMINO', repartidorId: MI_ID });

    req.flush({
      id: 1,
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
  });

  it('mantiene «Entregar y Cobrar» para mis entregas activas (comportamiento previo)', () => {
    ordersService.orders.set([orden({ id: '2', estado: 'EN_REPARTO', repartidorId: MI_ID })]);
    fixture.detectChanges();

    const boton = (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[])
      .find(b => (b.textContent || '').includes('Entregar y Cobrar'));
    expect(boton).withContext('el botón de cobro debe seguir disponible en mis entregas').not.toBeUndefined();

    boton!.click();
    fixture.detectChanges();

    expect(component.selectedOrderModal()?.id).toBe('2');
  });
});
