import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { OrderTrackingComponent } from './order-tracking.component';
import { OrdersService } from '../../../core/services/orders.service';
import { FeedbackService } from '../../../core/services/feedback.service';
import { PaymentService } from '../../../core/services/payment.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Order, OrderStatus } from '../../../core/models/order.model';

describe('OrderTrackingComponent', () => {
  let component: OrderTrackingComponent;
  let fixture: ComponentFixture<OrderTrackingComponent>;
  let payments: jasmine.SpyObj<PaymentService>;
  let notify: jasmine.SpyObj<NotificationService>;
  const myOrders = signal<Order[]>([]);
  const token = signal<string | null>(null);
  const NOW = Date.parse('2026-05-01T12:00:00Z');
  const minAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

  const orden = (over: Partial<Order>): Order => ({
    id: '7',
    codigoSeguimiento: 'POL-7',
    cliente: { nombre: 'Ana', celular: '912345678' },
    items: [],
    tipo: 'DELIVERY',
    estado: 'PREPARANDO',
    subtotal: 10,
    costoEnvio: 0,
    descuento: 0,
    total: 10,
    createdAt: minAgo(0),
    updatedAt: minAgo(0),
    ...over
  });

  function mostrar(o: Order): void {
    myOrders.set([o]);
    component.currentOrder.set(o);
    component.ahora.set(NOW);
  }

  function archivo(tipo: string, bytes: number): Event {
    const file = new File([new Uint8Array(Math.min(bytes, 10))], 'p', { type: tipo });
    Object.defineProperty(file, 'size', { value: bytes });
    const input = { files: [file], value: 'x' } as unknown as HTMLInputElement;
    return { target: input } as unknown as Event;
  }

  beforeEach(async () => {
    myOrders.set([]);
    token.set(null);
    payments = jasmine.createSpyObj<PaymentService>('PaymentService', ['subirComprobante']);
    notify = jasmine.createSpyObj<NotificationService>('NotificationService', ['showError', 'showSuccess', 'showInfo']);

    await TestBed.configureTestingModule({
      imports: [OrderTrackingComponent],
      providers: [
        provideRouter([]),
        {
          provide: OrdersService,
          useValue: {
            myOrders,
            seguimientoTelefono: signal<string | null>(null),
            loadMyOrders: jasmine.createSpy('loadMyOrders'),
            getOrderByTrackingCode: () => of(undefined),
            registerClientOrder: () => undefined
          }
        },
        {
          provide: FeedbackService,
          useValue: {
            consultarReporteDeOrden: () => of(null),
            obtenerReseniaDeOrden: () => null,
            obtenerReporteDeOrden: () => null
          }
        },
        { provide: AuthService, useValue: { token } },
        { provide: PaymentService, useValue: payments },
        { provide: NotificationService, useValue: notify }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(OrderTrackingComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  describe('cancel button', () => {
    it('is offered to a guest while the order is still active', () => {
      mostrar(orden({ estado: 'PREPARANDO' }));
      expect(component.puedeCancelarPedido()).toBeTrue();
    });

    for (const estado of ['PEDIDO_FANTASMA', 'CANCELADO', 'ENTREGADO', 'COMPLETADO'] as OrderStatus[]) {
      it(`is not offered in the terminal state ${estado}`, () => {
        mostrar(orden({ estado }));
        expect(component.puedeCancelarPedido()).toBeFalse();
      });
    }
  });

  describe('status copy', () => {
    it('PENDIENTE_CONFIRMACION says we will call and shows the remaining minutes of the 15 minute window', () => {
      mostrar(orden({ estado: 'PENDIENTE_CONFIRMACION', createdAt: minAgo(5) }));
      expect(component.getMainTitle()).toContain('LLAMAREMOS');
      expect(component.getCuentaRegresiva()).toBe('Tiempo restante para confirmar: 10 min');
    });

    it('PENDIENTE_PAGO is not presented as confirmed', () => {
      mostrar(orden({ estado: 'PENDIENTE_PAGO', createdAt: minAgo(3) }));
      expect(component.getMainTitle()).not.toContain('CONFIRMADO');
      expect(component.getMainTitle()).toContain('PENDIENTE');
      expect(component.getCuentaRegresiva()).toBe('Tiempo restante para verificar el pago: 12 min');
    });

    it('EN_PUERTA counts down 30 minutes from enPuertaAt', () => {
      mostrar(orden({ estado: 'EN_PUERTA', enPuertaAt: minAgo(10) }));
      expect(component.getMainTitle()).toContain('PUERTA');
      expect(component.getCuentaRegresiva()).toBe('Tu repartidor te espera: 20 min');
    });

    it('pickup LISTO tells the customer to collect it with the ticket within 1 hour', () => {
      mostrar(orden({ estado: 'LISTO_PARA_ENTREGAR', tipo: 'RECOJO_EN_TIENDA', listoAt: minAgo(15) }));
      expect(component.getSubtitle()).toContain('ticket');
      expect(component.getSubtitle()).toContain('1 hora');
      expect(component.getCuentaRegresiva()).toBe('Tiempo para recoger: 45 min');
    });

    it('never claims a fixed 10 - 15 min estimate when the courier is on the way', () => {
      mostrar(orden({ estado: 'EN_CAMINO' }));
      expect(component.getSubtitle()).not.toContain('10 - 15');
      expect(component.getCuentaRegresiva()).toBe('');
    });

    it('PEDIDO_FANTASMA and CANCELADO have their own copy and no progress', () => {
      mostrar(orden({ estado: 'PEDIDO_FANTASMA' }));
      expect(component.getMainTitle()).toBe('PEDIDO NO ENTREGADO');
      expect(component.getProgressWidth()).toBe('0%');
      mostrar(orden({ estado: 'CANCELADO' }));
      expect(component.getMainTitle()).toBe('PEDIDO CANCELADO');
    });
  });

  describe('payment proof upload', () => {
    it('is offered only for the own wallet order in PENDIENTE_PAGO', () => {
      mostrar(orden({ estado: 'PENDIENTE_PAGO', metodoPago: 'YAPE' }));
      expect(component.puedeSubirComprobante()).toBeTrue();

      mostrar(orden({ estado: 'PREPARANDO', metodoPago: 'YAPE' }));
      expect(component.puedeSubirComprobante()).toBeFalse();

      mostrar(orden({ estado: 'PENDIENTE_PAGO', metodoPago: 'TARJETA' }));
      expect(component.puedeSubirComprobante()).toBeFalse();

      component.currentOrder.set(orden({ id: '99', estado: 'PENDIENTE_PAGO' }));
      expect(component.puedeSubirComprobante()).toBeFalse();
    });

    it('rejects files over 5 MB without calling the backend', () => {
      mostrar(orden({ estado: 'PENDIENTE_PAGO' }));
      component.onComprobanteSeleccionado(archivo('image/png', 5 * 1024 * 1024 + 1));
      expect(payments.subirComprobante).not.toHaveBeenCalled();
      expect(component.errorComprobante()).toContain('5 MB');
    });

    it('rejects non image types without calling the backend', () => {
      mostrar(orden({ estado: 'PENDIENTE_PAGO' }));
      component.onComprobanteSeleccionado(archivo('application/pdf', 1000));
      expect(payments.subirComprobante).not.toHaveBeenCalled();
      expect(component.errorComprobante()).toContain('JPG, PNG o WEBP');
    });

    it('uploads and then shows that the proof was received', () => {
      mostrar(orden({ estado: 'PENDIENTE_PAGO' }));
      payments.subirComprobante.and.returnValue(of({ id: 1, ordenId: 7, monto: 10, estado: 'PENDIENTE_VERIFICACION' }));

      component.onComprobanteSeleccionado(archivo('image/jpeg', 2000));

      expect(payments.subirComprobante).toHaveBeenCalledWith('7', jasmine.any(File));
      expect(component.comprobanteRecibido()).toBeTrue();
      expect(component.subiendoComprobante()).toBeFalse();
    });

    it('shows the backend error and does not mark the proof as received', () => {
      mostrar(orden({ estado: 'PENDIENTE_PAGO' }));
      payments.subirComprobante.and.returnValue(throwError(() => new Error('El plazo de 15 minutos venció')));

      component.onComprobanteSeleccionado(archivo('image/webp', 2000));

      expect(component.errorComprobante()).toBe('El plazo de 15 minutos venció');
      expect(component.comprobanteRecibido()).toBeFalse();
      expect(component.subiendoComprobante()).toBeFalse();
    });
  });

  it('renders the proof control for a pending wallet order', () => {
    mostrar(orden({ estado: 'PENDIENTE_PAGO', metodoPago: 'YAPE' }));
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input[type="file"][accept="image/jpeg,image/png,image/webp"]');
    expect(input).not.toBeNull();
  });
});
