import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { CheckoutStatusComponent } from './checkout-status.component';
import { PaymentService } from '../../../core/services/payment.service';
import { OrdersService } from '../../../core/services/orders.service';
import { CartService } from '../../../core/services/cart.service';
import { PaymentStatus, PaymentTransaction } from '../../../core/models/payment.model';

describe('CheckoutStatusComponent', () => {
  let payments: jasmine.SpyObj<PaymentService>;
  let cart: jasmine.SpyObj<CartService>;
  let queryParams: BehaviorSubject<Record<string, string>>;

  const tx = (estado: PaymentStatus): PaymentTransaction => ({
    id: '9', orderId: '55', metodo: 'TARJETA', monto: 20, estado, fechaTransaccion: ''
  });

  function crear(params: Record<string, string>) {
    queryParams.next(params);
    const fixture = TestBed.createComponent(CheckoutStatusComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(async () => {
    queryParams = new BehaviorSubject<Record<string, string>>({});
    payments = jasmine.createSpyObj<PaymentService>('PaymentService', ['obtener']);
    cart = jasmine.createSpyObj<CartService>('CartService', ['clearCart']);
    await TestBed.configureTestingModule({
      imports: [CheckoutStatusComponent],
      providers: [
        provideRouter([]),
        { provide: PaymentService, useValue: payments },
        { provide: OrdersService, useValue: { getOrderByTrackingCode: () => of(undefined) } },
        { provide: CartService, useValue: cart },
        { provide: ActivatedRoute, useValue: { get queryParams() { return queryParams; } } }
      ]
    }).compileComponents();
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
  });

  it('does not show SUCCESS nor clear the cart for a bare visit without asking the backend', fakeAsync(() => {
    const c = crear({});
    expect(c.currentStatus()).toBe('PENDING');
    expect(cart.clearCart).not.toHaveBeenCalled();
    discardPeriodicTasks();
  }));

  it('shows SUCCESS and clears the cart only when the backend says APROBADO', fakeAsync(() => {
    payments.obtener.and.returnValue(of(tx('APROBADO')));
    const c = crear({ external_reference: '9', collection_status: 'approved' });
    expect(payments.obtener).toHaveBeenCalledWith(9);
    expect(c.currentStatus()).toBe('SUCCESS');
    expect(cart.clearCart).toHaveBeenCalledTimes(1);
    discardPeriodicTasks();
  }));

  it('stays PENDING when MP says approved but the backend payment is not approved yet', fakeAsync(() => {
    payments.obtener.and.returnValue(of(tx('PENDIENTE')));
    const c = crear({ external_reference: '9', collection_status: 'approved' });
    expect(c.currentStatus()).toBe('PENDING');
    expect(cart.clearCart).not.toHaveBeenCalled();
    discardPeriodicTasks();
  }));

  it('shows FAILURE when the backend says RECHAZADO', fakeAsync(() => {
    payments.obtener.and.returnValue(of(tx('RECHAZADO')));
    const c = crear({ external_reference: '9' });
    expect(c.currentStatus()).toBe('FAILURE');
    expect(cart.clearCart).not.toHaveBeenCalled();
  }));

  it('moves from PENDING to SUCCESS when polling sees APROBADO', fakeAsync(() => {
    let estado: PaymentStatus = 'PENDIENTE';
    payments.obtener.and.callFake(() => of(tx(estado)));
    const c = crear({ external_reference: '9', status: 'pending' });
    expect(c.currentStatus()).toBe('PENDING');
    estado = 'APROBADO';
    tick(3000);
    expect(c.currentStatus()).toBe('SUCCESS');
    expect(cart.clearCart).toHaveBeenCalledTimes(1);
    discardPeriodicTasks();
  }));

  it('flags an explicit still-pending message after the polling attempt limit', fakeAsync(() => {
    payments.obtener.and.returnValue(of(tx('PENDIENTE')));
    const c = crear({ external_reference: '9' });
    tick(3000 * 21);
    expect(c.pollingAgotado()).toBeTrue();
    expect(c.currentStatus()).toBe('PENDING');
    expect(cart.clearCart).not.toHaveBeenCalled();
    discardPeriodicTasks();
  }));
});
