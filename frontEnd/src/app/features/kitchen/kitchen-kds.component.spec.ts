import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { KitchenKdsComponent } from './kitchen-kds.component';
import { OrdersService } from '../../core/services/orders.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { Order, OrderStatus } from '../../core/models/order.model';
import { Product } from '../../core/models/product.model';

function tokenDeSesion(): string {
  const b64 = btoa(JSON.stringify({ userId: 9 }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `cabecera.${b64}.firma-falsa`;
}

const producto = (id: string, nombre: string): Product => ({
  id,
  nombre,
  descripcion: '',
  precio: 65,
  imagenUrl: '',
  categoria: 'POLLOS_A_LA_BRASA',
  agotado: false
});

function ordenDe(tipo: Order['tipo'], estado: OrderStatus, over: Partial<Order> = {}): Order {
  return {
    id: tipo === 'SALON' ? '7' : '8',
    codigoSeguimiento: tipo === 'SALON' ? 'POL-7' : 'POL-8',
    cliente: {
      nombre: tipo === 'SALON' ? 'Mesa 03' : 'María García',
      celular: '999888777',
      mesaNumero: tipo === 'SALON' ? 3 : undefined,
      direccion: tipo === 'DELIVERY' ? 'Av. Siempre Viva 742' : undefined
    },
    items: [{ product: producto('1', 'Pollo a la Brasa Entero'), cantidad: 1, subtotal: 65 }],
    tipo,
    estado,
    metodoPago: 'TARJETA',
    subtotal: 65,
    costoEnvio: 0,
    descuento: 0,
    total: 65,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...over
  };
}

/**
 * S4.9 — cocina distingue el pedido de salón: muestra la mesa y usa el texto de servir
 * en mesa en lugar del de reparto/motorizado. El delivery conserva su texto.
 */
describe('KitchenKdsComponent — comanda de salón', () => {
  let fixture: ComponentFixture<KitchenKdsComponent>;
  let component: KitchenKdsComponent;
  let http: HttpTestingController;
  let orders: OrdersService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    TestBed.configureTestingModule({
      imports: [KitchenKdsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });

    TestBed.inject(AuthService).token.set(tokenDeSesion());
    fixture = TestBed.createComponent(KitchenKdsComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    orders = TestBed.inject(OrdersService);
    spyOn(TestBed.inject(NotificationService), 'showSuccess');
    spyOn(TestBed.inject(NotificationService), 'showError');

    fixture.detectChanges();
    http.match(r => r.method === 'GET').forEach(r => r.flush([]));
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
  });

  it('muestra la mesa del pedido de salón y el texto de servir en mesa', () => {
    orders.orders.set([ordenDe('SALON', 'LISTO_COCINA')]);
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Mesa 3');
    expect(texto).toContain('el mozo ya puede servirla en mesa');
    expect(texto).not.toContain('motorizado');
  });

  it('el botón de listo de salón no habla de reparto; el de delivery conserva su texto', () => {
    orders.orders.set([
      ordenDe('SALON', 'EN_PREPARACION'),
      ordenDe('DELIVERY', 'EN_PREPARACION')
    ]);
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Listo para servir en mesa');
    expect(texto).toContain('Listo para Reparto / Empacado');
  });

  it('el delivery LISTO sigue mostrando el aviso del motorizado', () => {
    orders.orders.set([ordenDe('DELIVERY', 'LISTO_COCINA')]);
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Esperando que el motorizado retire el pedido');
    expect(texto).not.toContain('servirla en mesa');
  });

  it('ordena las comandas por antigüedad: la más vieja primero (S3.4)', () => {
    orders.orders.set([
      ordenDe('DELIVERY', 'EN_PREPARACION', { createdAt: '2026-01-01T00:10:00Z' }),
      ordenDe('SALON', 'EN_PREPARACION', { createdAt: '2026-01-01T00:00:00Z' })
    ]);
    fixture.detectChanges();

    expect(component.rawKitchenOrders().map(o => o.id))
      .withContext('cocina atiende por orden de llegada')
      .toEqual(['7', '8']);
  });

  it('calcula los minutos de espera y tolera una fecha inválida (S3.4)', () => {
    const haceDiez = new Date(Date.now() - 10 * 60_000).toISOString();

    expect(component.minutosEspera(ordenDe('SALON', 'PAGADO', { createdAt: haceDiez })))
      .toBeGreaterThanOrEqual(9);
    expect(component.minutosEspera(ordenDe('SALON', 'PAGADO', { createdAt: 'no-es-fecha' })))
      .toBe(0);
  });

  it('marca la comanda recién recibida y muestra el tiempo transcurrido (S3.4)', () => {
    orders.orders.set([ordenDe('SALON', 'PAGADO')]);
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Nueva');
    expect(texto).toContain('hace');
    expect(texto).toContain('min');
  });
});
