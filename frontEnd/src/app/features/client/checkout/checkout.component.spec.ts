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
import { ProductsService } from '../../../core/services/products.service';
import { Order } from '../../../core/models/order.model';
import { PaymentTransaction } from '../../../core/models/payment.model';
import { Product } from '../../../core/models/product.model';

describe('CheckoutComponent', () => {
  let component: CheckoutComponent;
  let fixture: ComponentFixture<CheckoutComponent>;
  let cart: CartService;
  let orders: jasmine.SpyObj<OrdersService>;
  let payments: jasmine.SpyObj<PaymentService>;
  let auth: { currentUser: () => unknown; verificarSancion: jasmine.Spy };
  let notify: jasmine.SpyObj<NotificationService>;
  let products: jasmine.SpyObj<ProductsService>;
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
    products = jasmine.createSpyObj<ProductsService>('ProductsService', ['refrescarProductos']);
    products.refrescarProductos.and.returnValue(of([]));
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
        { provide: ProductsService, useValue: products },
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
    fixture.detectChanges();
  });

  describe('S1: guest at payment', () => {
    beforeEach(() => {
      auth.currentUser = () => null;
      sessionStorage.removeItem('polleria_checkout_borrador');
    });
    afterEach(() => sessionStorage.removeItem('polleria_checkout_borrador'));

    for (const metodo of ['TARJETA', 'EFECTIVO_CONTRAENTREGA'] as const) {
      it(`asks a guest to log in instead of creating the order (${metodo})`, () => {
        component.metodoPago.set(metodo);

        component.confirmOrder();
        fixture.detectChanges();

        expect(component.mostrarModalLogin()).toBeTrue();
        const modal = fixture.nativeElement.querySelector('[data-testid="checkout-login-modal"]');
        expect(modal).withContext('the login invitation must be on screen').not.toBeNull();
        expect(modal.textContent).toContain('Inicia sesión');
        expect(orders.createOrder).not.toHaveBeenCalled();
        expect(payments.crearPreferenciaMercadoPago).not.toHaveBeenCalled();
        expect(cart.isEmpty()).withContext('the cart is not lost').toBeFalse();
        expect(navigate).not.toHaveBeenCalled();
      });
    }

    it('keeps what the guest typed so it is back after logging in', () => {
      component.tipoPedido.set('DELIVERY');
      component.direccion = 'Av. Lima 123';
      component.celular = '987654321';
      component.instrucciones = 'Tocar el timbre';
      component.metodoPago.set('EFECTIVO_CONTRAENTREGA');
      component.montoPagaCon = 50;
      component.confirmOrder();

      auth.currentUser = () => ({ nombre: 'Ana', celular: '912345678', correo: 'a@b.com' });
      const vuelta = TestBed.createComponent(CheckoutComponent);
      vuelta.detectChanges();
      const restaurado = vuelta.componentInstance;

      expect(restaurado.tipoPedido()).toBe('DELIVERY');
      expect(restaurado.direccion).toBe('Av. Lima 123');
      expect(restaurado.celular).toBe('987654321');
      expect(restaurado.instrucciones).toBe('Tocar el timbre');
      expect(restaurado.metodoPago()).toBe('EFECTIVO_CONTRAENTREGA');
      expect(restaurado.montoPagaCon).toBe(50);
      expect(sessionStorage.getItem('polleria_checkout_borrador'))
        .withContext('the draft is used once').toBeNull();
    });

    it('sends the guest to log in or register and back to the checkout', () => {
      component.confirmOrder();

      component.irALogin();
      expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/checkout' } });

      component.irARegistro();
      expect(navigate).toHaveBeenCalledWith(['/registro'], { queryParams: { returnUrl: '/checkout' } });
    });

    it('"seguir revisando" closes the invitation without losing anything', () => {
      component.confirmOrder();

      component.mostrarModalLogin.set(false);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[data-testid="checkout-login-modal"]')).toBeNull();
      expect(cart.isEmpty()).toBeFalse();
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

    it('clears the cart and navigates after iniciarPago succeeds', () => {
      payments.iniciarPago.and.returnValue(of(tx('PENDIENTE')));

      component.confirmOrder();

      expect(cart.isEmpty()).toBeTrue();
      expect(navigate).toHaveBeenCalledWith(['/tracking'], { queryParams: { code: 'POL-55' } });
    });

    it('a pickup order tells the customer the ticket POL-<id> in the success toast', () => {
      payments.iniciarPago.and.returnValue(of(tx('PENDIENTE')));
      component.confirmOrder();
      expect(notify.showSuccess.calls.mostRecent().args[1]).toContain('POL-55');
    });

    it('a delivery order does not mention a pickup ticket', () => {
      payments.iniciarPago.and.returnValue(of(tx('PENDIENTE')));
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
  describe('S10: IGV breakdown (D3.9, prices include IGV)', () => {
    const setTotal = (total: number) => {
      cart.items.set([{
        product: { id: 'p1', nombre: 'Pollo', descripcion: '', precio: total, categoria: 'POLLOS_A_LA_BRASA', imagenUrl: '', agotado: false } as never,
        cantidad: 1,
        subtotal: total
      }]);
    };

    it('derives base = total / 1.18 rounded HALF_UP and igv = total - base, so they add up to the total', () => {
      setTotal(10);
      expect(component.getSubtotalNeto()).toBe(8.47);
      expect(component.getIgv()).toBe(1.53);
      expect(Math.round((component.getSubtotalNeto() + component.getIgv()) * 100) / 100).toBe(10);
    });

    it('shows the same base and IGV in the summary', () => {
      setTotal(10);
      fixture.detectChanges();
      const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(texto).toContain('8.47');
      expect(texto).toContain('1.53');
    });
  });

  describe('FE-06: invalidate pending orders when cart or delivery changes', () => {
    it('creates a new order when delivery type changes before retrying card preference', () => {
      component.metodoPago.set('TARJETA');
      payments.crearPreferenciaMercadoPago.and.returnValue(of({
        preferenceId: 'x', initPoint: '', sandboxInitPoint: '', pagoId: 1, ordenId: 55
      }));

      component.confirmOrder();
      expect(orders.createOrder).toHaveBeenCalledTimes(1);

      component.tipoPedido.set('DELIVERY');
      component.direccion = 'Av. San Martín 123';
      orders.createOrder.and.returnValue(of({ id: '57', codigoSeguimiento: 'POL-57', total: 26 } as Order));
      component.confirmOrder();

      expect(orders.createOrder).toHaveBeenCalledTimes(2);
    });
  });

  describe('FE-07: sync cart with fresh catalog prices and stock on init', () => {
    it('calls refrescarProductos and notifies when prices changed or items sold out', () => {
      const catalogoActualizado: Product[] = [{
        id: 'p1',
        nombre: 'Pollo',
        descripcion: '',
        precio: 24,
        categoria: 'POLLOS_A_LA_BRASA',
        imagenUrl: '',
        agotado: false,
        stock: 5
      }];
      products.refrescarProductos.and.returnValue(of(catalogoActualizado));
      notify.showInfo.calls.reset();

      component.ngOnInit();

      expect(products.refrescarProductos).toHaveBeenCalled();
      expect(cart.items()[0].product.precio).toBe(24);
      expect(notify.showInfo).toHaveBeenCalledWith(
        'Tu carrito se actualizó con la carta vigente',
        jasmine.stringContaining('Pollo: S/ 20.00 -> S/ 24.00')
      );
    });
  });
});
