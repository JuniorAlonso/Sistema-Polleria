import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AdminMesasPage } from './admin-mesas.page';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { SalonService } from '../../../../core/services/salon.service';
import { mesaConComanda, tokenDeSesion } from '../../testing/admin-test-helpers';

/**
 * S4.7/S4.8 — el admin puede cobrar la comanda de una mesa; liberar una mesa con comanda
 * activa se bloquea en la UI (el backend también responde 409).
 */
describe('AdminMesasPage — comanda de salón', () => {
  let fixture: ComponentFixture<AdminMesasPage>;
  let component: AdminMesasPage;
  let http: HttpTestingController;
  let notify: NotificationService;
  let salon: SalonService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    TestBed.configureTestingModule({
      imports: [AdminMesasPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });

    TestBed.inject(AuthService).token.set(tokenDeSesion());
    fixture = TestBed.createComponent(AdminMesasPage);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    notify = TestBed.inject(NotificationService);
    salon = TestBed.inject(SalonService);

    spyOn(notify, 'showSuccess');
    spyOn(notify, 'showError');
    spyOn(notify, 'showInfo');
    spyOn(notify, 'showWarning');

    fixture.detectChanges();
    http.match(r => r.method === 'GET').forEach(r => r.flush([]));
  });

  afterEach(() => {
    salon.detenerSincronizacion();
    fixture.destroy();
    http.verify();
  });

  function flushRecargas(): void {
    http.match(r => r.method === 'GET' && (r.url.endsWith('/mesas') || r.url.endsWith('/ordenes')))
      .forEach(r => r.flush([]));
  }

  it('no libera ni pasa a limpieza una mesa con comanda activa (S4.8)', () => {
    const m = mesaConComanda();

    component.cambiarEstadoMesaDirecto(m, 'LIBRE');
    http.expectNone(r => r.method === 'PUT' && r.url.includes('/mesas/3/estado'));
    expect(notify.showWarning).toHaveBeenCalled();

    component.cambiarEstadoMesaDirecto(m, 'EN_LIMPIEZA');
    http.expectNone(r => r.method === 'PUT' && r.url.includes('/mesas/3/estado'));
    expect((notify.showWarning as jasmine.Spy).calls.count())
      .withContext('ambos intentos deben avisar y no disparar la petición')
      .toBe(2);
  });

  it('cobra la comanda LISTO y deja que el backend libere la mesa (S4.7)', () => {
    const m = mesaConComanda('LISTO');

    component.cobrarComandaMesa(m);

    const patch = http.expectOne(r => r.method === 'PATCH' && r.url.endsWith('/ordenes/7/estado'));
    expect(patch.request.body.estado).toBe('ENTREGADO');
    patch.flush({
      id: 7, tipo: 'SALON', estado: 'ENTREGADO', total: 65, mesaNumero: 3,
      nombreCliente: 'Mesa 03', telefonoCliente: '', items: [], creadoEn: '2026-01-01T00:00:00Z'
    });
    flushRecargas();

    expect(notify.showSuccess).toHaveBeenCalled();
    http.expectNone(r => r.method === 'PUT' && r.url.includes('/mesas/3/estado'));
  });

  it('no cobra una comanda que cocina todavía no marcó LISTO', () => {
    const m = mesaConComanda('EN_PREPARACION');

    component.cobrarComandaMesa(m);

    http.expectNone(r => r.method === 'PATCH');
    expect(notify.showWarning).toHaveBeenCalled();
    expect((notify.showWarning as jasmine.Spy).calls.mostRecent().args.join(' '))
      .toContain('LISTO');
  });

  it('marca en el croquis la mesa lista para servir y la servida (S3.5)', () => {
    salon.mesas.set([mesaConComanda('LISTO')]);
    fixture.detectChanges();

    let texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Listo para servir');

    salon.mesas.set([mesaConComanda('LISTO', '2026-01-01T00:05:00Z')]);
    fixture.detectChanges();

    texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Servida');
    expect(texto).not.toContain('Listo para servir');
  });

  it('el inspector muestra la línea de tiempo de la comanda (S3.5)', () => {
    component.selectedMesa.set(mesaConComanda('LISTO'));
    fixture.detectChanges();

    let texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Creada hace');
    expect(texto).toContain('Pendiente de servir');

    component.selectedMesa.set(mesaConComanda('LISTO', '2026-01-01T00:05:00Z'));
    fixture.detectChanges();

    texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Servida');
  });
});
