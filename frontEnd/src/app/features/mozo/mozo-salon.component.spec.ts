import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MozoSalonComponent, MesaSalon } from './mozo-salon.component';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { SalonService } from '../../core/services/salon.service';
import { Product } from '../../core/models/product.model';
import { TableStatus } from '../../core/models/table.model';

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

function dtoOrden(over: { id?: number; estado?: string; total?: number; servidoEn?: string | null; items?: unknown[] } = {}) {
  return {
    id: over.id ?? 7,
    tipo: 'SALON',
    estado: over.estado ?? 'LISTO',
    total: over.total ?? 45.5,
    mesaNumero: 3,
    nombreCliente: 'Mesa 03',
    telefonoCliente: '',
    servidoEn: over.servidoEn ?? null,
    items: over.items ?? [
      { id: 101, productoId: 1, productoNombre: 'Chaufa de Pollo', cantidad: 1, precioUnitario: 32.5, subtotal: 32.5, ronda: 1 },
      { id: 102, productoId: 2, productoNombre: 'Inca Kola 1.5L', cantidad: 1, precioUnitario: 13, subtotal: 13, ronda: 1 }
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

  it('SOLO EL CAJERO COBRA: solicitar cobro en mesa con comanda lista y servida envía la cuenta a caja pasando la mesa a POR_COBRAR', () => {
    component.seleccionarMesa(mesa({ servidoEn: '2026-01-01T00:05:00Z' }));

    // S6.5: al abrir el modal se lee la comanda real del backend (LISTO y servida).
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/7'))
      .flush(dtoOrden({ estado: 'LISTO', servidoEn: '2026-01-01T00:05:00Z' }));

    component.cobrarMesaModal();

    const put = http.expectOne(r => r.method === 'PUT' && r.url.endsWith('/mesas/3/estado'));
    expect(put.request.body.estado).toBe('POR_COBRAR');
    put.flush({ id: 3, numero: 3, capacidad: 4, estado: 'POR_COBRAR', posicionX: 1, posicionY: 1 });

    // Recarga comanda de la mesa y lista de mesas
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/7'))
      .flush(dtoOrden({ estado: 'LISTO', servidoEn: '2026-01-01T00:05:00Z' }));
    flushMesasReload();

    const exito = notify.showSuccess as jasmine.Spy;
    expect(exito).toHaveBeenCalled();
    expect(exito.calls.mostRecent().args.join(' '))
      .toContain('cuenta enviada a Caja');
  });

  it('un rechazo del backend al enviar la cuenta no anuncia éxito y muestra el motivo real', () => {
    component.seleccionarMesa(mesa({ servidoEn: '2026-01-01T00:05:00Z' }));
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/7'))
      .flush(dtoOrden({ estado: 'LISTO', servidoEn: '2026-01-01T00:05:00Z' }));

    component.cobrarMesaModal();

    http.expectOne(r => r.method === 'PUT' && r.url.endsWith('/mesas/3/estado'))
      .flush({ error: 'La mesa no está operativa' }, { status: 409, statusText: 'Conflict' });
    flushMesasReload();

    expect(notify.showSuccess).not.toHaveBeenCalled();
    const error = notify.showError as jasmine.Spy;
    expect(error).toHaveBeenCalled();
    expect(error.calls.mostRecent().args.join(' '))
      .toContain('La mesa no está operativa');
  });

  it('D1.6: no permite solicitar la cuenta si la comanda no está LISTO o aún no fue servida', () => {
    // Caso 1: EN_PREPARACION
    component.seleccionarMesa(mesa());
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/7'))
      .flush(dtoOrden({ estado: 'EN_PREPARACION', servidoEn: null }));

    component.cobrarMesaModal();
    http.expectNone(r => r.method === 'PUT' && r.url.endsWith('/mesas/3/estado'));
    expect(notify.showWarning).toHaveBeenCalled();

    // Caso 2: LISTO pero sin servidoEn
    (notify.showWarning as jasmine.Spy).calls.reset();
    component.seleccionarMesa(mesa({ servidoEn: null }));
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/7'))
      .flush(dtoOrden({ estado: 'LISTO', servidoEn: null }));

    component.cobrarMesaModal();
    http.expectNone(r => r.method === 'PUT' && r.url.endsWith('/mesas/3/estado'));
    expect(notify.showWarning).toHaveBeenCalled();
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

/**
 * S3.3 — «servir en mesa» es una marca persistida: la alerta se deriva del estado real de la mesa
 * (LISTO y sin servidoEn), se sirve con POST /ordenes/{id}/servir y no vuelve al recargar.
 */
describe('MozoSalonComponent — servido persistido', () => {
  let fixture: ComponentFixture<MozoSalonComponent>;
  let component: MozoSalonComponent;
  let http: HttpTestingController;
  let notify: NotificationService;
  let salon: SalonService;

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

    http.match(req => req.method === 'GET').forEach(req => req.flush([]));
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
  });

  function mesaDelBackend(opts: { estadoOrden?: string; servidoEn?: string | null } = {}) {
    return {
      id: 3,
      numero: 3,
      capacidad: 4,
      estado: 'OCUPADA' as TableStatus,
      posicionX: 1,
      posicionY: 1,
      zona: 'SALON_PRINCIPAL',
      ordenActiva: {
        ordenId: 7,
        mozoId: 7,
        total: 45.5,
        estadoOrden: opts.estadoOrden ?? 'LISTO',
        tiempoEsperaMinutos: 5,
        servidoEn: opts.servidoEn ?? null
      }
    };
  }

  function flushMesasReload(): void {
    http.match(r => r.method === 'GET' && r.url.endsWith('/mesas')).forEach(r => r.flush([]));
  }

  it('la alerta se deriva del estado real de la mesa y desaparece al servirse', () => {
    salon.mesas.set([mesaDelBackend()]);

    expect(component.alertasPendientes().length).toBe(1);
    expect(component.alertasPendientes()[0].ordenId).toBe('7');
    expect(component.mesas()[0].platosListos).toBe(true);

    salon.mesas.set([mesaDelBackend({ servidoEn: '2026-01-01T12:00:00Z' })]);

    expect(component.alertasPendientes().length).toBe(0);
    expect(component.mesas()[0].platosListos).toBe(false);
  });

  it('servir persiste la marca y recarga las mesas SIN pasar automáticamente a POR_COBRAR (D1.1 / D1.6)', () => {
    salon.mesas.set([mesaDelBackend()]);

    component.servirAlerta(component.alertasPendientes()[0]);

    const post = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/ordenes/7/servir'));
    post.flush(dtoOrden({ estado: 'LISTO', servidoEn: '2026-01-01T12:00:00Z' }));

    // D1.6: Servir NO cambia la mesa a POR_COBRAR
    http.expectNone(r => r.method === 'PUT' && r.url.endsWith('/mesas/3/estado'));
    flushMesasReload();

    const exito = notify.showSuccess as jasmine.Spy;
    expect(exito).toHaveBeenCalled();
    expect(exito.calls.allArgs().flat().join(' ')).toContain('comanda servida');
    expect((notify.showError as jasmine.Spy)).not.toHaveBeenCalled();
  });

  it('esMesaParaCobrar no confunde servidoEn con el estado POR_COBRAR de la mesa', () => {
    const mesaServidaPeroOcupada = mesa({ estado: 'OCUPADA', servidoEn: '2026-01-01T12:00:00Z' });
    const mesaPorCobrar = mesa({ estado: 'POR_COBRAR', servidoEn: '2026-01-01T12:00:00Z' });

    expect(component.esMesaParaCobrar(mesaServidaPeroOcupada)).toBeFalse();
    expect(component.esMesaParaCobrar(mesaPorCobrar)).toBeTrue();
  });

  it('un rechazo del backend muestra el motivo y no recarga las mesas', () => {
    salon.mesas.set([mesaDelBackend()]);

    component.servirAlerta(component.alertasPendientes()[0]);

    http.expectOne(r => r.method === 'POST' && r.url.endsWith('/ordenes/7/servir'))
      .flush(
        { error: 'La comanda #7 todavía no está lista (estado actual: EN_PREPARACION).' },
        { status: 409, statusText: 'Conflict' }
      );

    http.expectNone(r => r.method === 'GET' && r.url.endsWith('/mesas'));
    const error = notify.showError as jasmine.Spy;
    expect(error).toHaveBeenCalled();
    expect(error.calls.mostRecent().args.join(' ')).toContain('todavía no está lista');
    expect(notify.showSuccess).not.toHaveBeenCalled();
  });

  it('la pestaña de avisos y el banner global ofrecen «Servir en mesa»', () => {
    salon.mesas.set([mesaDelBackend()]);
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
    expect(banner).withContext('el banner fijo debe verse en todas las pestañas').not.toBeNull();
    expect(banner.textContent).toContain('Comanda lista para servir');
    expect(banner.textContent).toContain('Tu comanda');
    expect(banner.textContent).toContain('Servir en mesa');

    component.activeTab.set('ALERTAS_COCINA');
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Comanda lista para servir');
    expect(texto).toContain('Servir en mesa');
    expect(texto).withContext('la rama local de «servido» ya no existe').not.toContain('Marcar como Servido');

    salon.mesas.set([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No hay platos listos pendientes de servir.');
  });

  it('servir desde el modal persiste y recarga la comanda y las mesas sin pasar a POR_COBRAR', () => {
    component.seleccionarMesa(mesa());
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/7')).flush(dtoOrden({ estado: 'LISTO' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Servir en mesa');

    component.servirMesaSeleccionada();

    const post = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/ordenes/7/servir'));
    post.flush(dtoOrden({ estado: 'LISTO', servidoEn: '2026-01-01T12:00:00Z' }));

    // D1.6: Servir NO envía PUT /mesas/3/estado a POR_COBRAR
    http.expectNone(r => r.method === 'PUT' && r.url.endsWith('/mesas/3/estado'));

    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/7'))
      .flush(dtoOrden({ estado: 'LISTO', servidoEn: '2026-01-01T12:00:00Z' }));
    flushMesasReload();

    expect(notify.showSuccess).toHaveBeenCalled();
    expect(notify.showError).not.toHaveBeenCalled();
  });
});

/**
 * Etapa 2 Plan 1 — Selección explícita de mesa, agrupación por rondas, eliminación individual
 * por itemId y prevención de solicitudes duplicadas.
 */
describe('MozoSalonComponent — Etapa 2 (selección explícita, rondas, eliminar ítem y duplicados)', () => {
  let fixture: ComponentFixture<MozoSalonComponent>;
  let component: MozoSalonComponent;
  let http: HttpTestingController;
  let notify: NotificationService;
  let salon: SalonService;
  let auth: AuthService;

  const productoDisponible: Product = {
    id: 'prod-1',
    nombre: 'Chaufa de Pollo',
    descripcion: 'Chaufa clásico',
    precio: 32.5,
    imagenUrl: '',
    categoria: 'POLLOS_A_LA_BRASA',
    agotado: false
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [MozoSalonComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });

    auth = TestBed.inject(AuthService);
    auth.token.set(tokenDeSesion());
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
    http.match(req => req.method === 'GET').forEach(req => req.flush([]));
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
  });

  it('no preselecciona la Mesa 1 al iniciar y exige selección explícita para enviar comanda', () => {
    salon.mesas.set([
      { id: 1, numero: 1, capacidad: 4, estado: 'LIBRE', posicionX: 1, posicionY: 1, zona: 'SALON_PRINCIPAL' }
    ]);
    expect(component.selectedMesaForOrder).toBeNull();
    expect(component.mesaParaComanda()).toBeUndefined();

    component.comandaItems = [{ producto: productoDisponible, cantidad: 1, notas: '' }];
    component.enviarComandaACocina();

    http.expectNone(r => r.method === 'POST');
    expect(notify.showError).toHaveBeenCalledWith('Seleccioná una mesa válida');
  });

  it('muestra los productos agrupados por ronda e interpreta registros históricos sin ronda como Ronda 1', () => {
    component.seleccionarMesa(mesa());
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/7')).flush(dtoOrden({
      estado: 'EN_PREPARACION',
      items: [
        { id: 501, productoId: 1, productoNombre: 'Pollo Entero', cantidad: 1, precioUnitario: 65, subtotal: 65, ronda: null },
        { id: 502, productoId: 2, productoNombre: 'Tequeños Criollos', cantidad: 1, precioUnitario: 19.5, subtotal: 19.5, ronda: 2 }
      ]
    }));
    fixture.detectChanges();

    const existente = component.comandaExistente();
    expect(existente).not.toBeNull();
    expect(existente!.rondas.length).toBe(2);
    expect(existente!.rondas[0].ronda).toBe(1);
    expect(existente!.rondas[0].items[0].id).toBe(501);
    expect(existente!.rondas[1].ronda).toBe(2);
    expect(existente!.rondas[1].items[0].id).toBe(502);

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Ronda 1');
    expect(texto).toContain('Ronda 2');
  });

  it('D1.8: elimina un ítem individual usando su id real (itemId) cuando la orden está RECIBIDO y actualiza la comanda', () => {
    component.seleccionarMesa(mesa());
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/7')).flush(dtoOrden({
      estado: 'RECIBIDO',
      total: 45.5,
      items: [
        { id: 301, productoId: 1, productoNombre: 'Chaufa de Pollo', cantidad: 1, precioUnitario: 32.5, subtotal: 32.5, ronda: 1 },
        { id: 302, productoId: 2, productoNombre: 'Inca Kola 1.5L', cantidad: 1, precioUnitario: 13, subtotal: 13, ronda: 1 }
      ]
    }));
    fixture.detectChanges();

    // Verifica que el botón Quitar está visible para MOZO en estado RECIBIDO
    const botonesQuitar = fixture.nativeElement.querySelectorAll('button[aria-label="Eliminar ítem"]');
    expect(botonesQuitar.length).toBe(2);

    component.eliminarItemComandaModal(302);

    // Debe invocar DELETE con el itemId 302 (nunca el productoId 2)
    const del = http.expectOne(r => r.method === 'DELETE' && r.url.endsWith('/ordenes/7/items/302'));
    del.flush(dtoOrden({
      estado: 'RECIBIDO',
      total: 32.5,
      items: [
        { id: 301, productoId: 1, productoNombre: 'Chaufa de Pollo', cantidad: 1, precioUnitario: 32.5, subtotal: 32.5, ronda: 1 }
      ]
    }));
    http.match(r => r.method === 'GET' && r.url.endsWith('/mesas')).forEach(r => r.flush([]));
    fixture.detectChanges();

    expect(component.comandaMesa()!.total).toBe(32.5);
    expect(component.comandaMesa()!.items.length).toBe(1);
    expect(component.comandaMesa()!.items[0].id).toBe(301);
    expect(notify.showSuccess).toHaveBeenCalledWith('Producto eliminado de la comanda');
  });

  it('D1.8: si el backend rechaza eliminar con 409 (último ítem) o 403, muestra el motivo y no simula eliminación local', () => {
    component.seleccionarMesa(mesa());
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/7')).flush(dtoOrden({
      estado: 'RECIBIDO',
      total: 32.5,
      items: [
        { id: 301, productoId: 1, productoNombre: 'Chaufa de Pollo', cantidad: 1, precioUnitario: 32.5, subtotal: 32.5, ronda: 1 }
      ]
    }));

    component.eliminarItemComandaModal(301);

    http.expectOne(r => r.method === 'DELETE' && r.url.endsWith('/ordenes/7/items/301'))
      .flush(
        { error: 'No se puede dejar la comanda #7 sin productos.' },
        { status: 409, statusText: 'Conflict' }
      );

    expect(component.comandaMesa()!.items.length).toBe(1);
    expect(component.comandaMesa()!.total).toBe(32.5);
    const errorSpy = notify.showError as jasmine.Spy;
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy.calls.mostRecent().args.join(' ')).toContain('No se puede dejar la comanda #7 sin productos');
  });

  it('D1.8: MOZO no puede eliminar ítems cuando la comanda está en PREPARANDO', () => {
    auth.currentUser.set({ id: '7', nombre: 'Mozo 1', correo: 'mozo@test.com', celular: '999888777', rol: 'MOZO' });
    component.seleccionarMesa(mesa());
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/7')).flush(dtoOrden({
      estado: 'PREPARANDO',
      items: [
        { id: 301, productoId: 1, productoNombre: 'Chaufa de Pollo', cantidad: 1, precioUnitario: 32.5, subtotal: 32.5, ronda: 1 },
        { id: 302, productoId: 2, productoNombre: 'Inca Kola 1.5L', cantidad: 1, precioUnitario: 13, subtotal: 13, ronda: 1 }
      ]
    }));
    fixture.detectChanges();

    const botonesQuitar = fixture.nativeElement.querySelectorAll('button[aria-label="Eliminar ítem"]');
    expect(botonesQuitar.length).toBe(0);

    component.eliminarItemComandaModal(302);
    http.expectNone(r => r.method === 'DELETE');
    expect(notify.showWarning).toHaveBeenCalled();
  });

  it('D1.8: MOZO no puede eliminar ítems cuando la comanda está en LISTO', () => {
    auth.currentUser.set({ id: '7', nombre: 'Mozo 1', correo: 'mozo@test.com', celular: '999888777', rol: 'MOZO' });
    component.seleccionarMesa(mesa());
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/7')).flush(dtoOrden({
      estado: 'LISTO',
      items: [
        { id: 301, productoId: 1, productoNombre: 'Chaufa de Pollo', cantidad: 1, precioUnitario: 32.5, subtotal: 32.5, ronda: 1 },
        { id: 302, productoId: 2, productoNombre: 'Inca Kola 1.5L', cantidad: 1, precioUnitario: 13, subtotal: 13, ronda: 1 }
      ]
    }));
    fixture.detectChanges();

    const botonesQuitar = fixture.nativeElement.querySelectorAll('button[aria-label="Eliminar ítem"]');
    expect(botonesQuitar.length).toBe(0);

    component.eliminarItemComandaModal(302);
    http.expectNone(r => r.method === 'DELETE');
    expect(notify.showWarning).toHaveBeenCalled();
  });

  it('D1.8: ADMIN puede eliminar ítems en estados activos permitidos (PREPARANDO y LISTO)', () => {
    auth.currentUser.set({ id: '1', nombre: 'Admin', correo: 'admin@test.com', celular: '999888777', rol: 'ADMIN' });

    component.seleccionarMesa(mesa());
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/7')).flush(dtoOrden({
      estado: 'PREPARANDO',
      total: 45.5,
      items: [
        { id: 301, productoId: 1, productoNombre: 'Chaufa de Pollo', cantidad: 1, precioUnitario: 32.5, subtotal: 32.5, ronda: 1 },
        { id: 302, productoId: 2, productoNombre: 'Inca Kola 1.5L', cantidad: 1, precioUnitario: 13, subtotal: 13, ronda: 1 }
      ]
    }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('button[aria-label="Eliminar ítem"]').length).toBe(2);

    component.eliminarItemComandaModal(302);
    const del1 = http.expectOne(r => r.method === 'DELETE' && r.url.endsWith('/ordenes/7/items/302'));
    del1.flush(dtoOrden({
      estado: 'LISTO',
      total: 32.5,
      items: [
        { id: 301, productoId: 1, productoNombre: 'Chaufa de Pollo', cantidad: 1, precioUnitario: 32.5, subtotal: 32.5, ronda: 1 },
        { id: 303, productoId: 3, productoNombre: 'Chicha Morada', cantidad: 1, precioUnitario: 14, subtotal: 14, ronda: 2 }
      ]
    }));
    http.match(r => r.method === 'GET' && r.url.endsWith('/mesas')).forEach(r => r.flush([]));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('button[aria-label="Eliminar ítem"]').length).toBe(2);

    component.eliminarItemComandaModal(303);
    const del2 = http.expectOne(r => r.method === 'DELETE' && r.url.endsWith('/ordenes/7/items/303'));
    del2.flush(dtoOrden({
      estado: 'LISTO',
      total: 32.5,
      items: [
        { id: 301, productoId: 1, productoNombre: 'Chaufa de Pollo', cantidad: 1, precioUnitario: 32.5, subtotal: 32.5, ronda: 1 }
      ]
    }));
    http.match(r => r.method === 'GET' && r.url.endsWith('/mesas')).forEach(r => r.flush([]));
  });

  it('D1.8: ADMIN no puede eliminar ítems en estados terminales (ENTREGADO y CANCELADO)', () => {
    auth.currentUser.set({ id: '1', nombre: 'Admin', correo: 'admin@test.com', celular: '999888777', rol: 'ADMIN' });

    for (const estadoTerminal of ['ENTREGADO', 'CANCELADO']) {
      (notify.showWarning as jasmine.Spy).calls.reset();
      component.seleccionarMesa(mesa());
      http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/7')).flush(dtoOrden({
        estado: estadoTerminal,
        items: [
          { id: 301, productoId: 1, productoNombre: 'Chaufa de Pollo', cantidad: 1, precioUnitario: 32.5, subtotal: 32.5, ronda: 1 },
          { id: 302, productoId: 2, productoNombre: 'Inca Kola 1.5L', cantidad: 1, precioUnitario: 13, subtotal: 13, ronda: 1 }
        ]
      }));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('button[aria-label="Eliminar ítem"]').length).toBe(0);

      component.eliminarItemComandaModal(302);
      http.expectNone(r => r.method === 'DELETE');
      expect(notify.showWarning).toHaveBeenCalled();
    }
  });

  it('D1.8: COCINA (CHEF) no tiene acceso a eliminar ítems ni siquiera en RECIBIDO', () => {
    auth.currentUser.set({ id: '9', nombre: 'Chef', correo: 'chef@test.com', celular: '999888777', rol: 'CHEF' });
    component.seleccionarMesa(mesa());
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/7')).flush(dtoOrden({
      estado: 'RECIBIDO',
      items: [
        { id: 301, productoId: 1, productoNombre: 'Chaufa de Pollo', cantidad: 1, precioUnitario: 32.5, subtotal: 32.5, ronda: 1 },
        { id: 302, productoId: 2, productoNombre: 'Inca Kola 1.5L', cantidad: 1, precioUnitario: 13, subtotal: 13, ronda: 1 }
      ]
    }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('button[aria-label="Eliminar ítem"]').length).toBe(0);

    component.eliminarItemComandaModal(302);
    http.expectNone(r => r.method === 'DELETE');
    expect(notify.showError).toHaveBeenCalledWith('Acceso denegado', 'No tienes permisos para quitar productos de la comanda.');
  });

  it('D1.1 / D1.6: no permite solicitar cuenta repetidamente cuando la mesa ya está en POR_COBRAR', () => {
    component.seleccionarMesa(mesa({ estado: 'POR_COBRAR' }));
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/7')).flush(dtoOrden({
      estado: 'LISTO',
      servidoEn: '2026-01-01T12:00:00Z'
    }));
    fixture.detectChanges();

    const btnSolicitarCuenta = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find(b => b.textContent?.includes('Solicitar cuenta'));
    expect(btnSolicitarCuenta).toBeUndefined();

    component.cobrarMesaModal();
    http.expectNone(r => r.method === 'PUT' && r.url.endsWith('/mesas/3/estado'));
    expect(notify.showInfo).toHaveBeenCalledWith('Cuenta ya solicitada', 'La Mesa 03 ya se encuentra en estado POR_COBRAR.');
  });

  it('previene solicitudes duplicadas al enviar comanda, al servir y al solicitar cuenta', () => {
    // 1. Duplicado al enviar comanda
    salon.mesas.set([
      { id: 3, numero: 3, capacidad: 4, estado: 'LIBRE', posicionX: 1, posicionY: 1, zona: 'SALON_PRINCIPAL' }
    ]);
    component.selectedMesaForOrder = 3;
    component.comandaItems = [{ producto: productoDisponible, cantidad: 1, notas: '' }];

    component.enviarComandaACocina();
    component.enviarComandaACocina(); // segundo clic mientras está en vuelo

    const postReqs = http.match(r => r.method === 'POST' && r.url.endsWith('/ordenes'));
    expect(postReqs.length).toBe(1);
    postReqs[0].flush(dtoOrden({ estado: 'RECIBIDO' }));
    http.match(r => r.method === 'GET' && r.url.endsWith('/mesas')).forEach(r => r.flush([]));

    // 2. Duplicado al servir
    component.seleccionarMesa(mesa());
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/7')).flush(dtoOrden({ estado: 'LISTO' }));

    component.servirMesaSeleccionada();
    component.servirMesaSeleccionada(); // segundo clic mientras está en vuelo

    const servirReqs = http.match(r => r.method === 'POST' && r.url.endsWith('/ordenes/7/servir'));
    expect(servirReqs.length).toBe(1);
    servirReqs[0].flush(dtoOrden({ estado: 'LISTO', servidoEn: '2026-01-01T12:00:00Z' }));
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/7'))
      .flush(dtoOrden({ estado: 'LISTO', servidoEn: '2026-01-01T12:00:00Z' }));
    http.match(r => r.method === 'GET' && r.url.endsWith('/mesas')).forEach(r => r.flush([]));

    // 3. Duplicado al solicitar cuenta
    component.cobrarMesaModal();
    component.cobrarMesaModal(); // segundo clic mientras está en vuelo

    const cobrarReqs = http.match(r => r.method === 'PUT' && r.url.endsWith('/mesas/3/estado'));
    expect(cobrarReqs.length).toBe(1);
    cobrarReqs[0].flush({ id: 3, numero: 3, capacidad: 4, estado: 'POR_COBRAR', posicionX: 1, posicionY: 1 });
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes/7'))
      .flush(dtoOrden({ estado: 'LISTO', servidoEn: '2026-01-01T12:00:00Z' }));
    http.match(r => r.method === 'GET' && r.url.endsWith('/mesas')).forEach(r => r.flush([]));
  });
});
