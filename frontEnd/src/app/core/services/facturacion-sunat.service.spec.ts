import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { FacturacionSunatService } from './facturacion-sunat.service';
import { NotificationService } from './notification.service';
import { EnvioSunatResponse } from '../api/facturacion-sunat-api.service';
import { environment } from '../../../environments/environment';

describe('FacturacionSunatService', () => {
  let service: FacturacionSunatService;
  let http: HttpTestingController;
  let notify: jasmine.SpyObj<NotificationService>;

  const baseUrl = environment.facturacionApiUrl || 'http://localhost:8089';

  const envioMock = (over: Partial<EnvioSunatResponse> = {}): EnvioSunatResponse => ({
    ordenId: 77,
    comprobanteId: 12,
    tipo: 'BOLETA',
    serieNumero: 'B001-12',
    nombreArchivo: '20608945123-03-B001-12',
    estado: 'ACEPTADO',
    codigoRespuesta: '0',
    descripcion: 'La Boleta numero B001-12, ha sido aceptada',
    observaciones: null,
    hash: 'abc123==',
    total: 47.2,
    intentos: 1,
    enviadoEn: '2026-11-23T20:00:00',
    tieneCdr: true,
    ...over
  });

  beforeEach(() => {
    notify = jasmine.createSpyObj('NotificationService', ['showSuccess', 'showWarning', 'showError', 'showInfo']);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: notify }
      ]
    });
    service = TestBed.inject(FacturacionSunatService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('no dispara llamadas HTTP al instanciarse y enviarASunat es cold observable', () => {
    expect(service.envios()).toEqual([]);
    expect(service.cargandoListado()).toBeFalse();

    const obs$ = service.enviarASunat(77);
    expect(service.estaEnviando(77)).toBeFalse();
    obs$.subscribe();
    expect(service.estaEnviando(77)).toBeTrue();
    http.expectOne(`${baseUrl}/facturacion/orden/77/enviar`).flush(envioMock());
    expect(service.estaEnviando(77)).toBeFalse();
  });

  it('bloquea doble clic concurrente sobre la misma orden', () => {
    service.enviarASunat(77).subscribe();
    let rechazo = false;
    service.enviarASunat(77).subscribe({ error: () => { rechazo = true; } });
    expect(rechazo).toBeTrue();

    const req = http.expectOne(`${baseUrl}/facturacion/orden/77/enviar`);
    req.flush(envioMock());
    expect(notify.showSuccess).toHaveBeenCalled();
  });

  it('carga listado y distingue 404 de otros errores en consultarEstadoOrden', () => {
    service.cargarEnvios();
    http.expectOne(`${baseUrl}/facturacion`).flush([
      envioMock({ ordenId: 10 }),
      envioMock({ ordenId: 11, estado: 'ERROR' })
    ]);
    expect(service.envios().length).toBe(2);
    expect(service.errorListado()).toBeNull();

    let res404: EnvioSunatResponse | null | undefined;
    service.consultarEstadoOrden(55).subscribe(r => { res404 = r; });
    http.expectOne(`${baseUrl}/facturacion/orden/55`).flush({}, { status: 404, statusText: 'Not Found' });
    expect(res404).toBeNull();
    expect(service.errorListado()).toBeNull();

    service.consultarEstadoOrden(56).subscribe();
    http.expectOne(`${baseUrl}/facturacion/orden/56`).flush(
      { error: 'Servicio caído' },
      { status: 503, statusText: 'Service Unavailable' }
    );
    expect(service.errorListado()).toContain('Servicio caído');
  });

  it('notifica warning para OBSERVADO y error para RECHAZADO/ERROR', () => {
    service.enviarASunat(1).subscribe();
    http.expectOne(`${baseUrl}/facturacion/orden/1/enviar`).flush(
      envioMock({ ordenId: 1, estado: 'OBSERVADO', observaciones: 'Nota 4252' })
    );
    expect(notify.showWarning).toHaveBeenCalled();

    service.enviarASunat(2).subscribe();
    http.expectOne(`${baseUrl}/facturacion/orden/2/enviar`).flush(
      envioMock({ ordenId: 2, estado: 'RECHAZADO', descripcion: 'RUC inválido' })
    );
    expect(notify.showError).toHaveBeenCalled();
  });

  it('extrae mensaje JSON de error Blob en descargarCdr y maneja popup bloqueado en abrirTicketSunat', async () => {
    service.descargarCdr(77);
    const cdrReq = http.expectOne(`${baseUrl}/facturacion/orden/77/cdr`);
    const errorBlob = new Blob([JSON.stringify({ error: 'SUNAT todavía no devolvió CDR' })], {
      type: 'application/json'
    });
    cdrReq.flush(errorBlob, { status: 404, statusText: 'Not Found' });
    await new Promise(r => setTimeout(r, 20));
    expect(notify.showError).toHaveBeenCalledWith('CDR no disponible', 'SUNAT todavía no devolvió CDR');

    spyOn(window, 'open').and.returnValue(null);
    spyOn(URL, 'createObjectURL').and.returnValue('blob:mock');
    spyOn(URL, 'revokeObjectURL');
    service.abrirTicketSunat(77);
    const ticketReq = http.expectOne(`${baseUrl}/facturacion/orden/77/ticket`);
    ticketReq.flush(new Blob(['<html></html>'], { type: 'text/html' }));
    expect(notify.showWarning).toHaveBeenCalled();
  });
});
