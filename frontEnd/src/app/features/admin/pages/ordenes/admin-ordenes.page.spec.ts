import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AdminOrdenesPage } from './admin-ordenes.page';
import { AuthService } from '../../../../core/services/auth.service';
import { OrdersService } from '../../../../core/services/orders.service';
import { SalonService } from '../../../../core/services/salon.service';
import { tokenDeSesion } from '../../testing/admin-test-helpers';

describe('AdminOrdenesPage', () => {
  let fixture: ComponentFixture<AdminOrdenesPage>;
  let http: HttpTestingController;
  let orders: OrdersService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    TestBed.configureTestingModule({
      imports: [AdminOrdenesPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });

    TestBed.inject(AuthService).token.set(tokenDeSesion());
    fixture = TestBed.createComponent(AdminOrdenesPage);
    http = TestBed.inject(HttpTestingController);
    orders = TestBed.inject(OrdersService);

    fixture.detectChanges();
    http.match(r => r.method === 'GET').forEach(r => r.flush([]));
  });

  afterEach(() => {
    TestBed.inject(SalonService).detenerSincronizacion();
    fixture.destroy();
    http.verify();
  });

  it('muestra el aviso cuando falla la carga de órdenes (P1)', () => {
    orders.hasError.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent as string)
      .toContain('Sin conexión con el servicio de pedidos');
  });

  it('muestra las cuatro columnas del tablero con el filtro TODAS', () => {
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('NUEVAS ORDENES');
    expect(texto).toContain('PREPARANDOSE');
    expect(texto).toContain('EN CAMINO');
    expect(texto).toContain('COMPLETADO');
  });
});
