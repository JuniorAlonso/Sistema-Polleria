import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';

describe('AuthService.verificarSancion', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('returns the backend verdict untouched', () => {
    let resultado: unknown;
    service.verificarSancion('912345678', 'a@b.com').subscribe(r => (resultado = r));

    const req = http.expectOne(r => r.url.includes('/auth/sanciones/verificar'));
    expect(req.request.url).toContain('telefono=912345678');
    req.flush({ sancionado: true, bloqueadoEfectivo: true, bloqueadoTotal: false });

    expect(resultado).toEqual({ sancionado: true, bloqueadoEfectivo: true, bloqueadoTotal: false });
  });

  it('propagates a failed check instead of reporting the customer as clear', () => {
    let emitido = false;
    let fallo = false;
    service.verificarSancion('912345678').subscribe({
      next: () => (emitido = true),
      error: () => (fallo = true)
    });

    http.expectOne(r => r.url.includes('/auth/sanciones/verificar'))
      .flush('boom', { status: 500, statusText: 'Server Error' });

    expect(emitido).toBeFalse();
    expect(fallo).toBeTrue();
  });
});
