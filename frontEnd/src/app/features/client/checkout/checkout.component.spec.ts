import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CheckoutComponent } from './checkout.component';
import { CartService } from '../../../core/services/cart.service';
import { OrdersService } from '../../../core/services/orders.service';
import { PaymentService } from '../../../core/services/payment.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Order } from '../../../core/models/order.model';
import { PaymentTransaction } from '../../../core/models/payment.model';

describe('CheckoutComponent', () => {
  let component: CheckoutComponent;
  let fixture: ComponentFixture<CheckoutComponent>;
  let cart: CartService;
  let orders: jasmine.SpyObj<OrdersService>;
  let payments: jasmine.SpyObj<PaymentService>;
  let auth: { currentUser: () => unknown; verificarSancion: jasmine.Spy };
  let notify: jasmine.SpyObj<NotificationService>;
  let navigate: jasmine.Spy;

  const creada = { id: '55', codigoSeguimiento: 'POL-55', total: 20 } as Order;
  const tx = (estado: PaymentTransaction['estado'], numeroOperacion?: string): PaymentTransaction => ({
    id: '1', orderId: '55', metodo: 'YAPE_OTP', monto: 20, estado, numeroOperacion, fechaTransaccion: ''
  });
  const http400 = (cuerpo: unknown) => new HttpErrorResponse({ status: 400, error: cuerpo, statusText: 'Bad Request' });

  beforeEach(async () => {
    orders = jasmine.createSpyObj<OrdersService>('OrdersService', ['createOrder', 'registerClientOrder']);
    orders.createOrder.and.returnValue(of(creada));
    payments = jasmine.createSpyObj<PaymentService>('PaymentService', ['pagarConYapeOtp', 'iniciarPago', 'crearPreferenciaMercadoPago']);
    notify = jasmine.createSpyObj<NotificationService>('NotificationService', ['showError', 'showSuccess', 'showInfo']);
    auth = {
      currentUser: () => ({ nombre: 'Ana', celular: '912345678', correo: 'a@b.com' }),
      verificarSancion: jasmine.createSpy('verificarSancion').and.returnValue(
        of({ sancionado: false, bloqueadoEfectivo: false, bloqueadoTotal: false }))
    };

    await TestBed.configureTestingModule({
      imports: [CheckoutComponent],
      providers: [
        { provide: OrdersService, useValue: orders },
        { provide: PaymentService, useValue: payments },
        { provide: AuthService, useValue: auth },
        { provide: NotificationService, useValue: notify },
        provideRouter([])
      ]
    }).compileComponents();

    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    cart = TestBed.inject(CartService);
    cart.items.set([{
      product: { id: 'p1', nombre: 'Pollo', descripcion: '', precio: 20, categoria: 'POLLOS_A_LA_BRASA', imagenUrl: '', agotado: false } as never,
      cantidad: 1,
      subtotal: 20
    }]);

    fixture = TestBed.createComponent(CheckoutComponent);
    component = fixture.componentInstance;
    component.tipoPedido.set('RECOJO_EN_TIENDA');
    component.celular = '912345678';
    component.celularYape = '912345678';
    fixture.detectChanges();
  });

  describe('Yape OTP', () => {
    beforeEach(() => {
      component.metodoPago.set('YAPE_OTP');
      component.otpYape = '123456';
    });

    it('keeps the cart and does not navigate when the OTP is rejected, then retries the SAME order', () => {
      payments.pagarConYapeOtp.and.returnValues(of(tx('RECHAZADO', 'Código vencido')), of(tx('APROBADO')));

      component.confirmOrder();
      expect(cart.isEmpty()).toBeFalse();
      expect(navigate).not.toHaveBeenCalled();
      expect(notify.showError).toHaveBeenCalledWith('Código Yape no válido', 'Código vencido');
      expect(component.isProcessing()).toBeFalse();

      component.otpYape = '654321';
      component.confirmOrder();

      expect(orders.createOrder).toHaveBeenCalledTimes(1);
      expect(payments.pagarConYapeOtp).toHaveBeenCalledTimes(2);
      expect(payments.pagarConYapeOtp.calls.mostRecent().args[0]).toBe(55);
      expect(cart.isEmpty()).toBeTrue();
      expect(navigate).toHaveBeenCalledWith(['/tracking'], { queryParams: { code: 'POL-55' } });
    });

    it('S1: creates the Yape OTP order waiting for payment, never RECIBIDO', () => {
      payments.pagarConYapeOtp.and.returnValue(of(tx('APROBADO')));

      component.confirmOrder();

      expect((orders.createOrder.calls.mostRecent().args[0] as Order).estado).toBe('PENDIENTE_PAGO');
    });

    it('shows the backend message of an HTTP error and keeps the cart', () => {
      payments.pagarConYapeOtp.and.returnValue(throwError(() => http400({ error: 'OTP vencido, genera otro' })));

      component.confirmOrder();

      expect(notify.showError).toHaveBeenCalledWith('Pago Yape rechazado', 'OTP vencido, genera otro');
      expect(cart.isEmpty()).toBeFalse();
      expect(navigate).not.toHaveBeenCalled();
    });

    it('shows the ProblemDetail detail sent by payments-service', () => {
      payments.pagarConYapeOtp.and.returnValue(throwError(() => http400({
        type: 'about:blank', title: 'Bad Request', status: 400, detail: 'La orden ya no espera pago'
      })));

      component.confirmOrder();

      expect(notify.showError).toHaveBeenCalledWith('Pago Yape rechazado', 'La orden ya no espera pago');
    });

    it('marks the locally registered order as in preparation once Yape approves, before navigating', () => {
      payments.pagarConYapeOtp.and.returnValue(of(tx('APROBADO')));
      navigate.and.callFake(() => {
        expect(orders.registerClientOrder).toHaveBeenCalledWith(jasmine.objectContaining({ id: '55', estado: 'EN_PREPARACION' }));
        return Promise.resolve(true);
      });

      component.confirmOrder();

      expect(navigate).toHaveBeenCalled();
    });

    it('does not touch the registered order when the OTP is rejected', () => {
      payments.pagarConYapeOtp.and.returnValue(of(tx('RECHAZADO')));
      component.confirmOrder();
      expect(orders.registerClientOrder).not.toHaveBeenCalled();
    });
  });

  describe('contra pago', () => {
    beforeEach(() => component.metodoPago.set('EFECTIVO_CONTRAENTREGA'));

    it('the order already exists when iniciarPago fails: reports it registered, clears the cart and navigates', () => {
      payments.iniciarPago.and.returnValue(throwError(() => http400({ message: 'Ya existe un pago' })));

      component.confirmOrder();

      expect(notify.showError).not.toHaveBeenCalled();
      expect(notify.showSuccess).toHaveBeenCalled();
      expect(cart.isEmpty()).toBeTrue();
      expect(navigate).toHaveBeenCalledWith(['/tracking'], { queryParams: { code: 'POL-55' } });
      expect(component.isProcessing()).toBeFalse();
    });

    it('a guest never calls iniciarPago (POST /pagos requires a session) and still gets the tracking page', () => {
      auth.currentUser = () => null;

      component.confirmOrder();

      expect(orders.createOrder).toHaveBeenCalledTimes(1);
      expect(payments.iniciarPago).not.toHaveBeenCalled();
      expect(notify.showError).not.toHaveBeenCalled();
      expect(cart.isEmpty()).toBeTrue();
      expect(navigate).toHaveBeenCalledWith(['/tracking'], { queryParams: { code: 'POL-55' } });
    });

    it('clears the cart and navigates after iniciarPago succeeds', () => {
      payments.iniciarPago.and.returnValue(of(tx('PENDIENTE')));

      component.confirmOrder();

      expect(cart.isEmpty()).toBeTrue();
      expect(navigate).toHaveBeenCalledWith(['/tracking'], { queryParams: { code: 'POL-55' } });
    });

    it('a pickup order tells the customer the ticket POL-<id> in the success toast', () => {
      auth.currentUser = () => null;
      component.confirmOrder();
      expect(notify.showSuccess.calls.mostRecent().args[1]).toContain('POL-55');
    });

    it('a delivery order does not mention a pickup ticket', () => {
      auth.currentUser = () => null;
      component.tipoPedido.set('DELIVERY');
      component.direccion = 'Av. Lima 1';
      component.confirmOrder();
      expect(notify.showSuccess.calls.mostRecent().args[1]).not.toContain('ticket');
    });
  });

  describe('Mercado Pago', () => {
    const sinUrl = { preferenceId: 'x', initPoint: '', sandboxInitPoint: '', pagoId: 1, ordenId: 55 };

    it('a retry after a preference failure requests the preference for the SAME order', () => {
      component.metodoPago.set('TARJETA');
      payments.crearPreferenciaMercadoPago.and.returnValues(
        throwError(() => http400({ detail: 'Mercado Pago no disponible' })),
        of(sinUrl)
      );

      component.confirmOrder();
      expect(notify.showError).toHaveBeenCalledWith('No se pudo conectar con Mercado Pago', 'Mercado Pago no disponible');

      component.confirmOrder();

      expect(orders.createOrder).toHaveBeenCalledTimes(1);
      expect(payments.crearPreferenciaMercadoPago).toHaveBeenCalledTimes(2);
      expect(payments.crearPreferenciaMercadoPago.calls.mostRecent().args).toEqual([55, 20]);
    });

    it('a retry with no redirect url also reuses the SAME order', () => {
      component.metodoPago.set('TARJETA');
      payments.crearPreferenciaMercadoPago.and.returnValue(of(sinUrl));

      component.confirmOrder();
      component.confirmOrder();

      expect(orders.createOrder).toHaveBeenCalledTimes(1);
    });

    it('S1: creates the card order waiting for payment, never RECIBIDO', () => {
      component.metodoPago.set('TARJETA');
      payments.crearPreferenciaMercadoPago.and.returnValue(of({
        preferenceId: 'x', initPoint: '', sandboxInitPoint: '', pagoId: 1, ordenId: 55
      }));

      component.confirmOrder();

      expect(orders.createOrder).toHaveBeenCalledTimes(1);
      expect((orders.createOrder.calls.mostRecent().args[0] as Order).estado).toBe('PENDIENTE_PAGO');
      expect(payments.crearPreferenciaMercadoPago).toHaveBeenCalledWith(55, 20);
    });

    it('shows an error when the preference has no redirect url', () => {
      component.metodoPago.set('TARJETA');
      payments.crearPreferenciaMercadoPago.and.returnValue(of({
        preferenceId: 'x', initPoint: '', sandboxInitPoint: '', pagoId: 1, ordenId: 55
      }));

      component.confirmOrder();

      expect(notify.showError).toHaveBeenCalled();
      expect(component.isProcessing()).toBeFalse();
    });
  });

  describe('sanction check', () => {
    it('hides cash payment when the customer is sanctioned', () => {
      auth.verificarSancion.and.returnValue(of({ sancionado: true, bloqueadoEfectivo: true, bloqueadoTotal: false }));
      component.verificarSancionCliente('912345678');
      expect(component.sancionActiva()).toBeTrue();
      expect(component.sancionNoVerificada()).toBeFalse();
    });

    it('shows a neutral notice, without claiming the customer is clear, when the check fails', () => {
      auth.verificarSancion.and.returnValue(throwError(() => new Error('down')));
      component.verificarSancionCliente('912345678');
      expect(component.sancionNoVerificada()).toBeTrue();
      expect(component.sancionActiva()).toBeFalse();
    });

    it('keeps a known block when a later check fails', () => {
      auth.verificarSancion.and.returnValue(of({ sancionado: false, bloqueadoEfectivo: true, bloqueadoTotal: false }));
      component.verificarSancionCliente('912345678');
      auth.verificarSancion.and.returnValue(throwError(() => new Error('down')));
      component.verificarSancionCliente('912345678');
      expect(component.sancionActiva()).toBeTrue();
    });
  });
});
