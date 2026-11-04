import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AdminOrdenesPage } from './admin-ordenes.page';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { SalonService } from '../../../../core/services/salon.service';
import { OrdersService } from '../../../../core/services/orders.service';
import { Order, OrderStatus } from '../../../../core/models/order.model';
import { tokenDeSesion } from '../../testing/admin-test-helpers';

function orden(id: string, estado: OrderStatus, over: Partial<Order> = {}): Order {
  return {
    id,
    codigoSeguimiento: `POL-${id}`,
    cliente: { nombre: 'María', celular: '999888777', direccion: 'Av. Lima 1' },
    items: [],
    tipo: 'DELIVERY',
    estado,
    subtotal: 40,
    costoEnvio: 0,
    descuento: 0,
    total: 40,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...over
  };
}

/** S1/S3/S8/S9 — the admin board shows gated states and only changes with the backend response. */
describe('AdminOrdenesPage — flujo real de pedidos', () => {
  let fixture: ComponentFixture<AdminOrdenesPage>;
  let component: AdminOrdenesPage;
  let http: HttpTestingController;
  let orders: OrdersService;
  let notify: NotificationService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [AdminOrdenesPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });
    TestBed.inject(AuthService).token.set(tokenDeSesion());
    fixture = TestBed.createComponent(AdminOrdenesPage);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    orders = TestBed.inject(OrdersService);
    notify = TestBed.inject(NotificationService);
    spyOn(notify, 'showSuccess');
    spyOn(notify, 'showError');
    spyOn(notify, 'showInfo');
    spyOn(notify, 'showWarning');
    fixture.detectChanges();
    http.match(r => r.method === 'GET').forEach(r => r.flush([]));
  });

  afterEach(() => {
    TestBed.inject(SalonService).detenerSincronizacion();
    fixture.destroy();
    http.match(r => r.method === 'GET').forEach(r => r.flush([]));
    http.verify();
  });

  it('muestra el aviso cuando falla la carga de órdenes (P1)', () => {
    orders.hasError.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent as string)
      .toContain('Sin conexión con el servicio de pedidos');
  });

  it('muestra las columnas del tablero con el filtro TODAS', () => {
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    for (const col of ['ATENCIÓN', 'NUEVAS ORDENES', 'PREPARANDOSE', 'EN CAMINO', 'COMPLETADO', 'INCIDENCIAS']) {
      expect(texto).toContain(col);
    }
  });

  it('shows pending, door, ghost and cancelled orders outside the normal columns', () => {
    orders.orders.set([
      orden('1', 'PENDIENTE_PAGO'),
      orden('2', 'PENDIENTE_CONFIRMACION'),
      orden('3', 'EN_PUERTA'),
      orden('4', 'PEDIDO_FANTASMA', { motivoFantasma: 'No contestó' }),
      orden('5', 'CANCELADO'),
      orden('6', 'PAGADO')
    ]);
    fixture.detectChanges();

    expect(component.attentionOrders().map(o => o.id)).toEqual(['1', '2', '3']);
    expect(component.incidentOrders().map(o => o.id)).toEqual(['4', '5']);
    expect(component.newOrders().map(o => o.id)).toEqual(['6']);
    expect(fixture.nativeElement.textContent as string).toContain('No contestó');
  });

  it('disables proof verification and explains why when there is no capture', () => {
    orders.orders.set([orden('1', 'PENDIENTE_PAGO')]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const verify = Array.from(host.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Verificar comprobante')) as HTMLButtonElement;
    expect(verify.disabled).toBeTrue();
    expect(host.querySelector('[data-testid="proof-hint"]')?.textContent)
      .toContain('aún no adjuntó un comprobante');
  });

  it('confirms the call through the real endpoint and updates only from the response', () => {
    orders.orders.set([orden('2', 'PENDIENTE_CONFIRMACION')]);
    component.confirmarLlamada(orders.orders()[0]);

    const req = http.expectOne(r => r.url.endsWith('/ordenes/2/confirmar-llamada'));
    expect(req.request.method).toBe('POST');
    expect(orders.orders()[0].estado).withContext('no optimistic change').toBe('PENDIENTE_CONFIRMACION');

    req.flush({ id: 2, tipo: 'DELIVERY', estado: 'RECIBIDO', total: 40, items: [], creadoEn: '2026-01-01T00:00:00Z' });
    expect(orders.orders()[0].estado).toBe('PAGADO');
  });

  it('does not declare a ghost order before the waiting time and shows the remaining time', () => {
    const reciente = orden('3', 'EN_PUERTA', { enPuertaAt: new Date().toISOString() });
    orders.orders.set([reciente]);
    fixture.detectChanges();

    component.declararFantasma(reciente);
    http.expectNone(r => r.url.includes('pedido-fantasma'));
    expect(notify.showWarning).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-testid="ghost-hint"]').textContent)
      .toContain('Disponible en');
  });

  it('declares the ghost order once 30 minutes at the door have passed', () => {
    const vieja = orden('3', 'EN_PUERTA', { enPuertaAt: new Date(Date.now() - 31 * 60_000).toISOString() });
    orders.orders.set([vieja]);

    component.declararFantasma(vieja);
    const req = http.expectOne(r => r.url.endsWith('/ordenes/3/pedido-fantasma'));
    expect(req.request.method).toBe('POST');
    req.flush({ id: 3, tipo: 'DELIVERY', estado: 'PEDIDO_FANTASMA', total: 40, items: [], creadoEn: '2026-01-01T00:00:00Z' });
    expect(orders.orders()[0].estado).toBe('PEDIDO_FANTASMA');
  });

  it('never sends a raw PATCH to move a gated order to preparation', () => {
    const pendiente = orden('1', 'PENDIENTE_PAGO');
    component.advanceOrderStatus(pendiente, 'EN_PREPARACION');

    http.expectNone(r => r.method === 'PATCH');
    expect(notify.showWarning).toHaveBeenCalled();
  });

  it('shows the backend reason when a transition is rejected and leaves the order untouched', () => {
    const pagada = orden('6', 'PAGADO');
    orders.orders.set([pagada]);
    component.advanceOrderStatus(pagada, 'EN_PREPARACION');

    http.expectOne(r => r.method === 'PATCH').flush({ error: 'Transición no permitida' }, { status: 409, statusText: 'Conflict' });
    expect(notify.showError).toHaveBeenCalledWith('Transición no permitida');
    expect(orders.orders()[0].estado).toBe('PAGADO');
  });

  describe('hand-over of a ready pickup order', () => {
    const lista = () => orden('9', 'LISTO_COCINA', { tipo: 'RECOJO_EN_TIENDA' });

    it('asks for the ticket and sends it as codigoTicket POL-<id>', () => {
      orders.orders.set([lista()]);
      spyOn(window, 'prompt').and.returnValue(' pol 9 ');

      component.advanceAfterReady(lista());

      const req = http.expectOne(r => r.method === 'PATCH' && r.url.endsWith('/ordenes/9/estado'));
      expect(req.request.body.estado).toBe('ENTREGADO');
      expect(req.request.body.codigoTicket).toBe('POL-9');
      req.flush({ id: 9, tipo: 'RECOJO', estado: 'ENTREGADO', total: 40, items: [], creadoEn: '2026-01-01T00:00:00Z' });
      expect(notify.showSuccess).toHaveBeenCalled();
    });

    it('does not call the backend when the operator cancels the prompt', () => {
      spyOn(window, 'prompt').and.returnValue(null);
      component.advanceAfterReady(lista());
      http.expectNone(r => r.method === 'PATCH');
    });

    it('rejects a ticket of another order without calling the backend', () => {
      spyOn(window, 'prompt').and.returnValue('POL-10');
      component.advanceAfterReady(lista());
      http.expectNone(r => r.method === 'PATCH');
      expect(notify.showError).toHaveBeenCalledWith('Ticket no coincide', jasmine.stringContaining('POL-9'));
    });

    it('shows the backend ProblemDetail when the order must be collected at the cashier', () => {
      orders.orders.set([lista()]);
      spyOn(window, 'prompt').and.returnValue('POL-9');

      component.advanceAfterReady(lista());

      http.expectOne(r => r.method === 'PATCH').flush(
        { type: 'about:blank', title: 'Conflict', status: 409, detail: 'Cobra el efectivo en caja antes de entregar' },
        { status: 409, statusText: 'Conflict' });
      expect(notify.showError).toHaveBeenCalledWith('Cobra el efectivo en caja antes de entregar');
    });

    it('a salon order is completed without asking for a ticket (previous behavior)', () => {
      const salon = orden('8', 'LISTO_COCINA', { tipo: 'SALON' });
      orders.orders.set([salon]);
      const prompt = spyOn(window, 'prompt');

      component.advanceAfterReady(salon);

      const req = http.expectOne(r => r.method === 'PATCH');
      expect(req.request.body.codigoTicket).toBeUndefined();
      expect(prompt).not.toHaveBeenCalled();
      req.flush({ id: 8, tipo: 'SALON', estado: 'ENTREGADO', total: 40, items: [], creadoEn: '2026-01-01T00:00:00Z' });
    });
  });
});
