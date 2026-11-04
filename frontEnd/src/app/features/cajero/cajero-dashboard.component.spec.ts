import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { CajeroDashboardComponent } from './cajero-dashboard.component';
import { OrdersService } from '../../core/services/orders.service';
import { FinanceService } from '../../core/services/finance.service';
import { Order } from '../../core/models/order.model';
import { PaymentTransaction } from '../../core/models/payment.model';
import { PaymentService } from '../../core/services/payment.service';
import { NotificationService } from '../../core/services/notification.service';
import { of, throwError } from 'rxjs';

describe('CajeroDashboardComponent', () => {
  let component: CajeroDashboardComponent;
  let fixture: ComponentFixture<CajeroDashboardComponent>;
  let ordersService: OrdersService;
  let financeService: FinanceService;

  const mockOrder: Order = {
    id: '101',
    codigoSeguimiento: 'POL-101',
    cliente: {
      nombre: 'Juan Perez',
      celular: '987654321',
      mesaNumero: 4
    },
    items: [
      {
        product: {
          id: 'prod-1',
          nombre: '1/2 Pollo a la Brasa',
          descripcion: 'Con papas y ensalada',
          precio: 45.0,
          categoria: 'POLLOS_A_LA_BRASA',
          imagenUrl: '',
          agotado: false
        },
        cantidad: 1,
        subtotal: 45.0
      }
    ],
    tipo: 'SALON',
    estado: 'LISTO',
    subtotal: 45.0,
    costoEnvio: 0,
    descuento: 0,
    total: 45.0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CajeroDashboardComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CajeroDashboardComponent);
    component = fixture.componentInstance;
    ordersService = TestBed.inject(OrdersService);
    financeService = TestBed.inject(FinanceService);
    fixture.detectChanges();
  });

  it('debe crearse correctamente el componente de cajero', () => {
    expect(component).toBeTruthy();
  });

  it('debe iniciar en la pestaña POS por defecto', () => {
    expect(component.activeTab()).toBe('POS');
  });

  it('debe seleccionar una comanda para cobro y calcular vuelto exacto inicial', () => {
    component.seleccionarOrdenParaCobro(mockOrder);

    expect(component.ordenSeleccionada()).toEqual(mockOrder);
    expect(component.metodoCobroSeleccionado()).toBe('EFECTIVO');
    expect(component.efectivoRecibidoInput).toBe(45.0);
    expect(component.vueltoCalculado()).toBe(0);
    expect(component.esCobroValido()).toBeTrue();
  });

  it('debe calcular vuelto positivo cuando el efectivo recibido es mayor', () => {
    component.seleccionarOrdenParaCobro(mockOrder);
    component.efectivoRecibidoInput = 50.0;

    expect(component.vueltoCalculado()).toBe(5.0);
    expect(component.esCobroValido()).toBeTrue();
  });

  it('debe invalidar cobro en efectivo si el monto recibido es menor', () => {
    component.seleccionarOrdenParaCobro(mockOrder);
    component.efectivoRecibidoInput = 30.0;

    expect(component.vueltoCalculado()).withContext('change is never negative').toBe(0);
    expect(component.esCobroValido()).toBeFalse();
  });

  it('debe requerir referencia cuando el método es TARJETA', () => {
    component.seleccionarOrdenParaCobro(mockOrder);
    component.metodoCobroSeleccionado.set('TARJETA');
    component.referenciaPagoInput = '';

    expect(component.esCobroValido()).toBeFalse();

    component.referenciaPagoInput = 'POS-123456';
    expect(component.esCobroValido()).toBeTrue();
  });

  it('debe cambiar de pestañas entre POS, ARQUEO e HISTORIAL', () => {
    component.activeTab.set('ARQUEO');
    expect(component.activeTab()).toBe('ARQUEO');

    component.activeTab.set('HISTORIAL');
    expect(component.activeTab()).toBe('HISTORIAL');
  });

  describe('S1: bandeja de capturas', () => {
    const porPagar = (id: string, canalOrigen?: Order['canalOrigen']): Order =>
      ({ ...mockOrder, id, codigoSeguimiento: `POL-${id}`, tipo: 'DELIVERY', estado: 'PENDIENTE_PAGO', canalOrigen });

    it('lista solo pedidos de WhatsApp o con captura; un pago web en pasarela no aparece', () => {
      ordersService.orders.set([porPagar('1', 'WEB'), porPagar('2', 'WHATSAPP'), porPagar('3', 'WEB'), porPagar('4')]);
      component.pagosPorVerificar.set([
        { id: 9, ordenId: 3, monto: 45, estado: 'PENDIENTE', comprobanteUrl: 'https://img/3.jpg' }
      ]);

      expect(component.capturasPendientes().map(c => c.orden.id)).toEqual(['2', '3']);
    });
  });

  describe('S7/S13: entrega de recojo', () => {
    let notify: jasmine.SpyObj<NotificationService>;
    let paymentService: PaymentService;

    const recojo = (extra: Partial<Order> = {}): Order => ({
      ...mockOrder,
      id: '12',
      codigoSeguimiento: 'POL-12',
      numeroCliente: 7,
      tipo: 'RECOJO_EN_TIENDA',
      estado: 'LISTO_COCINA',
      total: 30,
      ...extra
    });

    beforeEach(() => {
      notify = TestBed.inject(NotificationService) as jasmine.SpyObj<NotificationService>;
      spyOn(notify, 'showError');
      spyOn(notify, 'showSuccess');
      paymentService = TestBed.inject(PaymentService);
    });

    it('rechaza el número de cliente como ticket: solo vale el código POL-<id>', () => {
      const update = spyOn(ordersService, 'updateOrderStatus');

      component.entregarRecojo({ orden: recojo(), codigoTicket: '7', efectivoRecibido: 0 });

      expect(update).not.toHaveBeenCalled();
      expect(notify.showError).toHaveBeenCalledWith('Ticket no coincide', jasmine.any(String));
    });

    it('envía el ticket al backend al entregar un recojo ya pagado', () => {
      const update = spyOn(ordersService, 'updateOrderStatus').and.returnValue(of(recojo({ estado: 'COMPLETADO' })));

      component.entregarRecojo({ orden: recojo(), codigoTicket: ' pol-12 ', efectivoRecibido: 0 });

      expect(update).toHaveBeenCalledWith('12', 'COMPLETADO', undefined, 'POL-12');
    });

    it('envía el ticket al backend al cobrar un recojo ContraPago', () => {
      const cobro = spyOn(paymentService, 'registrarCobroEfectivo').and.returnValue(of({} as PaymentTransaction));

      component.entregarRecojo({ orden: recojo({ requiereCobroEfectivo: true }), codigoTicket: '12', efectivoRecibido: 50 });

      expect(cobro).toHaveBeenCalledWith('12', 30, 50, 20, 'POL-12');
    });

    it('S13: avisa al cajero si el ingreso en caja falla después de cobrar', () => {
      spyOn(paymentService, 'registrarCobroEfectivo').and.returnValue(of({} as PaymentTransaction));
      financeService.cajaActual.set({ estado: 'ABIERTA' } as never);
      spyOn(financeService, 'registrarMovimiento').and.returnValue(throwError(() => new Error('caja caída')));

      component.entregarRecojo({ orden: recojo({ requiereCobroEfectivo: true }), codigoTicket: 'POL-12', efectivoRecibido: 30 });

      expect(financeService.registrarMovimiento).toHaveBeenCalled();
      expect(notify.showError).toHaveBeenCalledWith(
        'No se registró el ingreso en caja',
        jasmine.stringMatching(/manualmente/));
    });
  });
});
