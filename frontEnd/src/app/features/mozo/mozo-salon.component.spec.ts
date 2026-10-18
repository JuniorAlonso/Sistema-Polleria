import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MozoSalonComponent, MesaSalon } from './mozo-salon.component';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { SalonService } from '../../core/services/salon.service';
import { Product } from '../../core/models/product.model';

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
    // El cobro también refresca el historial del turno desde /ordenes.
    http.match(r => r.method === 'GET' && r.url.endsWith('/ordenes')).forEach(r => r.flush([]));

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

/**
 * S4.5/S4.6 — la ventana del mozo reutiliza la comanda activa de la mesa
 * (`POST /ordenes/{id}/items`), no libera mesas con comanda activa y el historial del turno
 * sale de `/ordenes`, sin totales ni filas hardcodeadas.
 */
describe('MozoSalonComponent — comanda de salón e historial real', () => {
  let fixture: ComponentFixture<MozoSalonComponent>;
  let component: MozoSalonComponent;
  let http: HttpTestingController;
  let notify: NotificationService;
  let salon: SalonService;

  const producto: Product = {
    id: 'prod-1',
    nombre: 'Chaufa de Pollo',
    descripcion: 'Chaufa clásico',
    precio: 32.5,
    imagenUrl: '',
    categoria: 'POLLO_A_LA_BRASA' as Product['categoria'],
    agotado: false
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [MozoSalonComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });

    TestBed.inject(AuthService).token.set(tokenDeSesion());
    fixture = TestBed.createComponent(MozoSalonComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    notify = TestBed.inject(NotificationService);
    salon = TestBed.inject(SalonService);

    spyOn(notify, 'showSuccess');
    spyOn(notify, 'showError');
    spyOn(notify, 'showInfo');
    spyOn(notify, 'showWarning');

    fixture.detectChanges();

    // Peticiones iniciales (zonas, mesas, productos, /ordenes del historial).
    http.match(req => req.method === 'GET').forEach(req => req.flush([]));
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
  });

  /** Mesa 3 del backend: ocupada con la comanda #7, o libre sin comanda. */
  function cargarMesaEnSalon(conComanda: boolean, estado: 'LIBRE' | 'OCUPADA' = 'OCUPADA'): void {
    salon.mesas.set([{
      id: 3,
      numero: 3,
      capacidad: 4,
      estado,
      posicionX: 1,
      posicionY: 1,
      zona: 'SALON_PRINCIPAL',
      ordenActiva: conComanda
        ? { ordenId: 7, mozoId: 7, total: 45.5, estadoOrden: 'LISTO', tiempoEsperaMinutos: 5 }
        : undefined
    }]);
  }

  function flushMesasReload(): void {
    http.match(r => r.method === 'GET' && r.url.endsWith('/mesas')).forEach(r => r.flush([]));
  }

  it('con comanda activa agrega los platos a esa comanda, sin abrir otra (S4.5)', () => {
    cargarMesaEnSalon(true);
    component.selectedMesaForOrder = 3;
    component.comandaItems = [{ producto, cantidad: 2, notas: 'sin ají' }];

    component.enviarComandaACocina();

    const post = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/ordenes/7/items'));
    expect(post.request.body.items)
      .withContext('los platos viajan a la comanda existente con su producto y cantidad')
      .toEqual([{ productoId: 1, cantidad: 2, notas: 'sin ají' }]);

    http.expectNone(r => r.method === 'POST' && r.url.endsWith('/ordenes'));

    post.flush(dtoOrden());
    flushMesasReload();

    const exito = notify.showSuccess as jasmine.Spy;
    expect(exito).toHaveBeenCalled();
    expect(exito.calls.mostRecent().args.join(' ')).toContain('2 platos agregados');
    expect(component.comandaItems.length).toBe(0);
    expect(component.activeTab()).toBe('MESAS');
  });

  it('sin comanda activa abre la comanda de salón con el mesaId elegido (S4.5)', () => {
    cargarMesaEnSalon(false, 'LIBRE');
    component.selectedMesaForOrder = 3;
    component.comandaItems = [{ producto, cantidad: 1, notas: '' }];

    component.enviarComandaACocina();

    const post = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/ordenes'));
    expect(post.request.body.tipo).toBe('SALON');
    expect(post.request.body.mesaId).toBe(3);
    http.expectNone(r => r.url.includes('/items'));

    post.flush(dtoOrden({ estado: 'RECIBIDO' }));
    flushMesasReload();

    expect(notify.showSuccess).toHaveBeenCalled();
    expect(component.activeTab()).toBe('MESAS');
  });

  it('no libera ni pasa a limpieza una mesa con comanda activa (S4.6)', () => {
    component.seleccionarMesa(mesa());
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/7')).flush(dtoOrden());

    component.cambiarEstadoMesa('LIBRE');
    http.expectNone(r => r.method === 'PUT' && r.url.includes('/mesas/3/estado'));
    const advertencia = notify.showWarning as jasmine.Spy;
    expect(advertencia).toHaveBeenCalled();
    expect(advertencia.calls.mostRecent().args.join(' ')).toContain('comanda #7');
    expect(component.selectedMesaModal()).withContext('el modal queda abierto para cobrar').not.toBeNull();

    component.cambiarEstadoMesa('EN_LIMPIEZA');
    http.expectNone(r => r.method === 'PUT' && r.url.includes('/mesas/3/estado'));
    expect(advertencia.calls.count()).toBe(2);
    expect(component.selectedMesaModal()).not.toBeNull();
  });

  it('el historial del turno usa las comandas cerradas reales de /ordenes (S4.6)', () => {
    component.ordersService.loadActiveOrders();
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes'))
      .flush([dtoOrden({ estado: 'ENTREGADO', total: 45.5 })]);

    expect(component.historialSalon().length).toBe(1);
    expect(component.mesasAtendidasHoy()).toBe(1);
    expect(component.totalCobradoTurno()).toBe(45.5);

    component.activeTab.set('HISTORIAL_TURNO');
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Cerrada');
    expect(texto).toContain('Mesa 3');
    expect(texto).toContain('1x Chaufa de Pollo');
    expect(texto).withContext('los totales y métodos de pago simulados deben desaparecer')
      .not.toContain('1,840.50');
    expect(texto).not.toContain('Método Pago');
    expect(texto).not.toContain('Propinas Digitales Estimadas');
  });
});
