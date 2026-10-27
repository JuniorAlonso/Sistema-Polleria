import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { CajeroDashboardComponent } from './cajero-dashboard.component';
import { OrdersService } from '../../core/services/orders.service';
import { FinanceService } from '../../core/services/finance.service';
import { Order } from '../../core/models/order.model';

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
});
