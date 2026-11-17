import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';

function createJwt(expSeconds: number): string {
  const encodeBase64Url = (obj: object): string =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const header = encodeBase64Url({ alg: 'HS256', typ: 'JWT' });
  const payload = encodeBase64Url({
    sub: 'admin@polleria.com',
    role: 'ADMIN',
    exp: expSeconds
  });
  return `${header}.${payload}.sig`;
}

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

describe('AuthService session & refresh token', () => {
  let http: HttpTestingController;
  let nowMs: number;

  beforeEach(() => {
    localStorage.clear();
    nowMs = 1_700_000_000_000;
    spyOn(Date, 'now').and.callFake(() => nowMs);
  });

  afterEach(() => {
    http?.verify();
    localStorage.clear();
  });

  it('keeps session signals populated while refreshing an expired token on startup and deduplicates refresh calls', () => {
    const expiredJwt = createJwt(Math.floor((nowMs - 60_000) / 1000));
    const freshJwt = createJwt(Math.floor((nowMs + 900_000) / 1000));

    localStorage.setItem('polleria_user', JSON.stringify({
      id: 'usr-admin',
      nombre: 'Admin',
      correo: 'admin@polleria.com',
      celular: '999999999',
      rol: 'ADMIN'
    }));
    localStorage.setItem('polleria_token', expiredJwt);
    localStorage.setItem('polleria_refresh_token', 'refresh-startup-1');

    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    });

    const service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);

    expect(service.isAuthenticated()).toBeTrue();
    expect(service.token()).toBe(expiredJwt);
    expect(service.getRefreshToken()).toBe('refresh-startup-1');

    let secondCallToken: string | undefined;
    service.refreshTokens().subscribe(res => (secondCallToken = res.token));

    const refreshReqs = http.match(r => r.method === 'POST' && r.url.includes('/auth/refresh'));
    expect(refreshReqs.length).toBe(1);
    expect(refreshReqs[0].request.body).toEqual({ refreshToken: 'refresh-startup-1' });

    refreshReqs[0].flush({
      token: freshJwt,
      refreshToken: 'refresh-startup-2',
      email: 'admin@polleria.com',
      name: 'Admin',
      role: 'ADMIN'
    });

    expect(service.token()).toBe(freshJwt);
    expect(service.getRefreshToken()).toBe('refresh-startup-2');
    expect(secondCallToken).toBe(freshJwt);
  });

  it('reads rotated refresh token from localStorage and syncs on storage events across tabs', () => {
    const validJwt = createJwt(Math.floor((nowMs + 600_000) / 1000));
    const freshJwt = createJwt(Math.floor((nowMs + 900_000) / 1000));

    localStorage.setItem('polleria_user', JSON.stringify({
      id: 'usr-admin',
      nombre: 'Admin',
      correo: 'admin@polleria.com',
      celular: '999999999',
      rol: 'ADMIN'
    }));
    localStorage.setItem('polleria_token', validJwt);
    localStorage.setItem('polleria_refresh_token', 'refresh-tab-1');

    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    });

    const service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);

    // Another tab rotated tokens in localStorage
    localStorage.setItem('polleria_token', freshJwt);
    localStorage.setItem('polleria_refresh_token', 'refresh-tab-2');
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'polleria_refresh_token',
      newValue: 'refresh-tab-2'
    }));

    expect(service.getRefreshToken()).toBe('refresh-tab-2');
    expect(service.getAccessToken()).toBe(freshJwt);

    // Another tab logged out
    localStorage.removeItem('polleria_token');
    localStorage.removeItem('polleria_refresh_token');
    localStorage.removeItem('polleria_user');
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'polleria_token',
      newValue: null
    }));

    expect(service.isAuthenticated()).toBeFalse();
    expect(service.getRefreshToken()).toBeNull();
  });

  it('does not resurrect session if logout() is called while an in-flight refresh completes', () => {
    const validJwt = createJwt(Math.floor((nowMs + 600_000) / 1000));
    const freshJwt = createJwt(Math.floor((nowMs + 900_000) / 1000));

    localStorage.setItem('polleria_user', JSON.stringify({
      id: 'usr-admin',
      nombre: 'Admin',
      correo: 'admin@polleria.com',
      celular: '999999999',
      rol: 'ADMIN'
    }));
    localStorage.setItem('polleria_token', validJwt);
    localStorage.setItem('polleria_refresh_token', 'refresh-inflight');

    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    });

    const service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);

    service.refreshTokens().subscribe();
    const refreshReq = http.expectOne(r => r.url.includes('/auth/refresh'));

    service.logout();
    const logoutReq = http.expectOne(r => r.url.includes('/auth/logout'));
    expect(logoutReq.request.body).toEqual({ refreshToken: 'refresh-inflight' });
    logoutReq.flush({});

    refreshReq.flush({
      token: freshJwt,
      refreshToken: 'refresh-new',
      email: 'admin@polleria.com',
      name: 'Admin',
      role: 'ADMIN'
    });

    expect(service.isAuthenticated()).toBeFalse();
    expect(localStorage.getItem('polleria_token')).toBeNull();
    expect(localStorage.getItem('polleria_refresh_token')).toBeNull();
  });
});
