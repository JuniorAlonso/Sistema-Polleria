import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MozoSalonComponent, MesaSalon } from './mozo-salon.component';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';

/** Token de 3 partes: a SalonService solo le importa que exista para habilitar /mesas. */
function tokenDeSesion(): string {
  const b64 = btoa(JSON.stringify({ userId: 7 }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `cabecera.${b64}.firma-falsa`;
}

function mesa(over: Partial<MesaSalon> = {}): MesaSalon {
  return {
    id: 3,
    nombre: 'Mesa 03',
    zona: 'SALON_PRINCIPAL',
    capacidad: 4,
    estado: 'OCUPADA',
    posicionX: 1,
    posicionY: 1,
    totalConsumo: 0,
    ordenId: '7',
    ...over
  };
}

function dtoOrden(over: { id?: number; estado?: string; total?: number; items?: unknown[] } = {}) {
  return {
    id: over.id ?? 7,
    tipo: 'SALON',
    estado: over.estado ?? 'LISTO',
    total: over.total ?? 45.5,
    mesaNumero: 3,
    nombreCliente: 'Mesa 03',
    telefonoCliente: '',
    items: over.items ?? [
      { productoId: 1, productoNombre: 'Chaufa de Pollo', cantidad: 1, precioUnitario: 32.5, subtotal: 32.5 },
      { productoId: 2, productoNombre: 'Inca Kola 1.5L', cantidad: 1, precioUnitario: 13, subtotal: 13 }
    ],
    creadoEn: '2026-01-01T00:00:00Z'
  };
}

/**
 * S6.4/S6.5 — el cobro de una mesa con comanda activa cierra la orden (el backend libera la mesa)
 * y el modal muestra la comanda real en lugar de platos y totales hardcodeados.
 */
describe('MozoSalonComponent — cobro de mesa y comanda real', () => {
  let fixture: ComponentFixture<MozoSalonComponent>;
  let component: MozoSalonComponent;
  let http: HttpTestingController;
  let notify: NotificationService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [MozoSalonComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });

    // La sesión se activa antes de crear el componente para que SalonService pida /mesas.
    TestBed.inject(AuthService).token.set(tokenDeSesion());
    fixture = TestBed.createComponent(MozoSalonComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    notify = TestBed.inject(NotificationService);

    spyOn(notify, 'showSuccess');
    spyOn(notify, 'showError');
    spyOn(notify, 'showInfo');
    spyOn(notify, 'showWarning');

    fixture.detectChanges();

    // Descarta las peticiones iniciales (zonas, mesas, productos).
    http.match(req => req.method === 'GET').forEach(req => req.flush([]));
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
  });

  function flushMesasReload(): void {
    http.match(r => r.method === 'GET' && r.url.endsWith('/mesas')).forEach(r => r.flush([]));
  }

  it('cobrar una mesa con comanda activa cierra la orden (S6.4)', () => {
    component.seleccionarMesa(mesa());

    // S6.5: al abrir el modal se lee la comanda real del backend.
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/7')).flush(dtoOrden());

    component.cobrarMesaModal();

    const patch = http.expectOne(r => r.method === 'PATCH' && r.url.endsWith('/ordenes/7/estado'));
    expect(patch.request.body.estado)
      .withContext('COMPLETADO del frontend se traduce al ENTREGADO del backend')
      .toBe('ENTREGADO');

    // El cobro no debe liberar la mesa por separado: lo hace el backend al entregar la orden.
    http.expectNone(r => r.method === 'PUT' && r.url.includes('/mesas/3/estado'));

    patch.flush({
      id: 7,
      tipo: 'SALON',
      estado: 'ENTREGADO',
      total: 45.5,
      mesaNumero: 3,
      nombreCliente: 'Mesa 03',
      telefonoCliente: '',
      items: [],
      creadoEn: '2026-01-01T00:00:00Z'
    });
    flushMesasReload();

    expect(component.selectedMesaModal()).toBeNull();
    const exito = notify.showSuccess as jasmine.Spy;
    expect(exito).toHaveBeenCalled();
    expect(exito.calls.mostRecent().args.join(' '))
      .withContext('el éxito no puede prometer una Pre-Cuenta que el sistema no emite')
      .not.toContain('Pre-Cuenta');
  });

  it('un rechazo del backend no anuncia éxito y muestra el motivo real (S6.4)', () => {
    component.seleccionarMesa(mesa());
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/7')).flush(dtoOrden());

    component.cobrarMesaModal();

    http.expectOne(r => r.method === 'PATCH' && r.url.endsWith('/ordenes/7/estado'))
      .flush({ error: 'Solo se puede entregar una orden en estado LISTO' }, { status: 409, statusText: 'Conflict' });

    expect(notify.showSuccess).not.toHaveBeenCalled();
    const error = notify.showError as jasmine.Spy;
    expect(error).toHaveBeenCalled();
    expect(error.calls.mostRecent().args.join(' '))
      .toContain('Solo se puede entregar una orden en estado LISTO');
  });

  it('cobrar una mesa sin comanda activa mantiene la liberación directa de la mesa (comportamiento previo)', () => {
    component.seleccionarMesa(mesa({ ordenId: undefined }));

    // Sin comanda activa no se consulta ninguna orden.
    http.expectNone(r => r.method === 'GET' && r.url.includes('/ordenes/7'));

    component.cobrarMesaModal();

    const put = http.expectOne(r => r.method === 'PUT' && r.url.endsWith('/mesas/3/estado'));
    expect(put.request.body.estado).toBe('LIBRE');
    put.flush({ id: 3, numero: 3, capacidad: 4, estado: 'LIBRE', posicionX: 1, posicionY: 1 });

    expect(component.selectedMesaModal()).toBeNull();
    expect(notify.showSuccess).toHaveBeenCalled();
  });

  it('sin comanda activa el modal lo indica y no inventa platos ni totales (S6.5)', () => {
    component.seleccionarMesa(mesa({ ordenId: undefined }));
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Sin comanda activa');
    expect(texto).withContext('el total hardcodeado debe desaparecer').not.toContain('98.50');
    expect(texto).not.toContain('Tequeños Criollos');
  });

  it('el modal muestra los ítems y el total reales de la comanda (S6.5)', () => {
    component.seleccionarMesa(mesa());
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/7')).flush(dtoOrden());
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Chaufa de Pollo');
    expect(texto).toContain('Inca Kola 1.5L');
    expect(texto).toContain('45.50');
    expect(texto).withContext('ningún importe hardcodeado puede quedar').not.toContain('98.50');
  });

  it('muestra el estado de la comanda (Cocinando / Listo)', () => {
    component.seleccionarMesa(mesa());
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/7'))
      .flush(dtoOrden({ estado: 'EN_PREPARACION' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cocinando');

    component.seleccionarMesa(mesa({ id: 4, nombre: 'Mesa 04', ordenId: '8' }));
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/8'))
      .flush(dtoOrden({ id: 8, estado: 'LISTO' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Listo');
  });

  it('si la comanda no se puede leer, el modal lo dice y no muestra un total inventado (S6.5)', () => {
    component.seleccionarMesa(mesa());
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/7'))
      .flush({ error: 'Orden no encontrada' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Orden no encontrada');
    expect(texto).not.toContain('98.50');
    expect(texto).not.toContain('Total a Cobrar');
  });

  it('al cerrar el modal limpia la comanda de la mesa anterior (S6.5)', () => {
    component.seleccionarMesa(mesa());
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/7')).flush(dtoOrden());
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Chaufa de Pollo');

    const botonCerrar = fixture.nativeElement.querySelector('button[aria-label="Cerrar"]') as HTMLButtonElement;
    expect(botonCerrar).withContext('el modal debe poder cerrarse').not.toBeNull();
    botonCerrar.click();
    fixture.detectChanges();

    expect(component.selectedMesaModal()).toBeNull();

    // Una mesa nueva sin orden no hereda la comanda anterior.
    component.seleccionarMesa(mesa({ id: 5, nombre: 'Mesa 05', ordenId: undefined }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Sin comanda activa');
    expect(fixture.nativeElement.textContent).not.toContain('Chaufa de Pollo');
  });
});
