import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  WhatsappNotificationsService,
  AjustesWhatsapp,
  AjustesRespuesta
} from './whatsapp-notifications.service';

/**
 * T5b (S4/S8/S11) — la pantalla del panel edita el anti-baneo y los contactos.
 * El servicio es el único punto que habla con `GET`/`PATCH /api/notificaciones/ajustes`
 * (solo ADMIN, el token lo agrega `authTokenInterceptor`):
 * - la lectura devuelve los ajustes vigentes y el estado del gobernador;
 * - la escritura manda SOLO los campos cambiados y refresca lo que responde el backend;
 * - un 400 del backend se propaga con su mensaje, sin tragárselo ni simular éxito.
 */
describe('WhatsappNotificationsService — ajustes anti-baneo', () => {
  let service: WhatsappNotificationsService;
  let http: HttpTestingController;

  const ajustes: AjustesWhatsapp = {
    intervaloMs: 10000,
    jitterPct: 20,
    typingMinMs: 1000,
    typingMaxMs: 6000,
    typingMsPorCaracter: 50,
    presupuestoHora: 40,
    presupuestoDia: 500,
    horaDesde: 11,
    horaHasta: 23,
    breakerBaseMs: 60000,
    breakerMaxMs: 900000,
    numeroAsesor: '51999888777',
    numeroRespaldo: null
  };

  const gobernador: AjustesRespuesta['gobernador'] = {
    pausada: false,
    motivo: null,
    detalle: null,
    presupuestoHora: { enviados: 3, limite: 40 },
    presupuestoDia: { enviados: 12, limite: 500 },
    ventana: { horaDesde: 11, horaHasta: 23, abierta: true },
    breaker: { estado: 'cerrado', senal: null, detalle: null, aperturas: 0, reintentoEn: 0 }
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(WhatsappNotificationsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('obtenerAjustes() hace GET a /ajustes y devuelve { ajustes, gobernador }', () => {
    let recibido: AjustesRespuesta | null = null;
    service.obtenerAjustes().subscribe(respuesta => (recibido = respuesta));

    const req = http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ajustes'));
    req.flush({ ajustes, gobernador });

    expect(recibido).not.toBeNull();
    expect(recibido!.ajustes.presupuestoHora).toBe(40);
    expect(recibido!.ajustes.numeroRespaldo).toBeNull();
    expect(recibido!.gobernador!.pausada).toBeFalse();
    expect(recibido!.gobernador!.presupuestoHora).toEqual({ enviados: 3, limite: 40 });
  });

  it('actualizarAjustes() hace PATCH mandando solo los campos cambiados', () => {
    const cambios: Partial<AjustesWhatsapp> = { presupuestoHora: 20, numeroRespaldo: '' };

    let recibido: AjustesWhatsapp | null = null;
    service.actualizarAjustes(cambios).subscribe(respuesta => (recibido = respuesta));

    const req = http.expectOne(r => r.method === 'PATCH' && r.url.endsWith('/ajustes'));
    expect(req.request.body).toEqual({ presupuestoHora: 20, numeroRespaldo: '' });
    expect(Object.keys(req.request.body))
      .withContext('el PATCH no puede mandar el formulario completo')
      .toEqual(['presupuestoHora', 'numeroRespaldo']);

    req.flush({ ...ajustes, presupuestoHora: 20, numeroRespaldo: null });

    expect(recibido).not.toBeNull();
    expect(recibido!.presupuestoHora).withContext('refresca lo que devuelve el backend').toBe(20);
    expect(recibido!.numeroRespaldo).toBeNull();
  });

  it('un 400 del backend se propaga con su mensaje y no reporta éxito', () => {
    const capturado: { mensaje?: string } = {};
    let emitido = false;

    service.actualizarAjustes({ jitterPct: 150 }).subscribe({
      next: () => (emitido = true),
      error: err => (capturado.mensaje = err.message)
    });

    http.expectOne(r => r.method === 'PATCH' && r.url.endsWith('/ajustes'))
      .flush({ error: 'jitterPct debe estar entre 0 y 100' }, { status: 400, statusText: 'Bad Request' });

    expect(capturado.mensaje).withContext('el mensaje del backend debe llegar tal cual').toBe('jitterPct debe estar entre 0 y 100');
    expect(emitido).withContext('un rechazo no puede parecer un guardado exitoso').toBeFalse();
  });
});
