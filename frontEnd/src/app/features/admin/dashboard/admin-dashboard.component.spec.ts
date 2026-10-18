import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SalonService } from '../../../core/services/salon.service';
import { MesaSalon } from '../../../core/models/table.model';

/** Token de 3 partes: los servicios solo comprueban que exista para habilitar /mesas. */
function tokenDeSesion(): string {
  const b64 = btoa(JSON.stringify({ userId: 7 }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `cabecera.${b64}.firma-falsa`;
}

const productoDto = {
  id: 1,
  nombre: 'Pollo a la Brasa Entero',
  descripcion: '',
  precio: 65,
  categoria: 'POLLO_ENTERO',
  imagenUrl: '',
  disponible: true
};

function mesa(over: Partial<MesaSalon> = {}): MesaSalon {
  return {
    id: 3,
    numero: 3,
    capacidad: 4,
    estado: 'LIBRE',
    posicionX: 1,
    posicionY: 1,
    zona: 'SALON_PRINCIPAL',
    ...over
  };
}

function mesaConComanda(estadoComanda = 'LISTO'): MesaSalon {
  return mesa({
    estado: 'OCUPADA',
    ordenActiva: {
      ordenId: 7,
      mozoId: 7,
      total: 45.5,
      estadoOrden: estadoComanda,
      tiempoEsperaMinutos: 5
    }
  });
}

function dtoOrden(over: { id?: number; estado?: string; total?: number } = {}) {
  return {
    id: over.id ?? 7,
    tipo: 'SALON',
    estado: over.estado ?? 'RECIBIDO',
    total: over.total ?? 65,
    mesaNumero: 3,
    nombreCliente: 'Mesa 03',
    telefonoCliente: '',
    items: [],
    creadoEn: '2026-01-01T00:00:00Z'
  };
}

/**
 * S4.7/S4.8 — el admin puede tomar una comanda para una mesa concreta, agregar la segunda
 * ronda a la comanda activa y cobrarla; liberar una mesa con comanda activa se bloquea en la UI
 * (el backend también responde 409).
 */
describe('AdminDashboardComponent — comanda de salón', () => {
  let fixture: ComponentFixture<AdminDashboardComponent>;
  let component: AdminDashboardComponent;
  let http: HttpTestingController;
  let notify: NotificationService;
  let salon: SalonService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });

    TestBed.inject(AuthService).token.set(tokenDeSesion());
    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    notify = TestBed.inject(NotificationService);
    salon = TestBed.inject(SalonService);

    spyOn(notify, 'showSuccess');
    spyOn(notify, 'showError');
    spyOn(notify, 'showInfo');
    spyOn(notify, 'showWarning');

    fixture.detectChanges();

    // La carta se necesita para poder elegir un producto en el modal.
    http.match(r => r.method === 'GET' && r.url.includes('/productos'))
      .forEach(r => r.flush([productoDto]));
    // Resto de cargas iniciales del dashboard.
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

  it('el alta manual de salón exige la mesa y la envía como mesaId (S4.7)', () => {
    const m = mesa();
    salon.mesas.set([m]);

    component.abrirTomarComandaMesa(m);
    expect(component.manualOrder.modo).toBe('CREAR');
    expect(component.manualOrder.tipo).toBe('SALON');
    expect(component.manualOrder.mesaId)
      .withContext('la mesa se elige en el inspector, no se asume la 1')
      .toBe(3);

    component.manualOrder.cantidad = 2;
    component.crearOrdenManual();

    const post = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/ordenes'));
    expect(post.request.body.tipo).toBe('SALON');
    expect(post.request.body.mesaId).toBe(3);
    expect(post.request.body.nombreCliente).toBe('Mesa 03');
    expect(post.request.body.items[0].productoId).toBe(1);
    expect(post.request.body.items[0].cantidad).toBe(2);

    post.flush(dtoOrden({ id: 10, estado: 'RECIBIDO' }));
    flushRecargas();

    expect(component.showCreateOrderModal).toBeFalse();
    expect(notify.showSuccess).toHaveBeenCalled();
  });

  it('agrega platos a la comanda activa desde el inspector, sin abrir otra (S4.7)', () => {
    const m = mesaConComanda();
    salon.mesas.set([m]);

    component.abrirAgregarPlatosMesa(m);
    expect(component.manualOrder.modo).toBe('AGREGAR');
    expect(component.manualOrder.ordenId).toBe('7');

    component.crearOrdenManual();

    const post = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/ordenes/7/items'));
    expect(post.request.body.items[0].productoId).toBe(1);
    http.expectNone(r => r.method === 'POST' && r.url.endsWith('/ordenes'));

    post.flush(dtoOrden({ total: 110 }));
    flushRecargas();

    expect(notify.showSuccess).toHaveBeenCalled();
  });

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
    patch.flush(dtoOrden({ estado: 'ENTREGADO' }));
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
});
