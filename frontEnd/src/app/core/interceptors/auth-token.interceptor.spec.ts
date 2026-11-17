import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { authTokenInterceptor } from './auth-token.interceptor';
import { AuthService } from '../services/auth.service';

function createJwt(expSeconds: number, extraPayload: Record<string, unknown> = {}): string {
  const encodeBase64Url = (obj: object): string =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const header = encodeBase64Url({ alg: 'HS256', typ: 'JWT' });
  const payload = encodeBase64Url({
    sub: 'admin@polleria.com',
    role: 'ADMIN',
    exp: expSeconds,
    ...extraPayload
  });
  return `${header}.${payload}.sig`;
}

describe('authTokenInterceptor', () => {
  let httpClient: HttpClient;
  let http: HttpTestingController;
  let authService: AuthService;
  let nowMs: number;

  beforeEach(() => {
    localStorage.clear();
    nowMs = 1_700_000_000_000;
    spyOn(Date, 'now').and.callFake(() => nowMs);

    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        provideHttpClient(withInterceptors([authTokenInterceptor])),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    });

    httpClient = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('refresca proactivamente un JWT expirado antes de enviarlo a orders-service o payments-service', () => {
    const expiredJwt = createJwt(Math.floor((nowMs - 120_000) / 1000));
    const freshJwt = createJwt(Math.floor((nowMs + 900_000) / 1000));
    authService.token.set(expiredJwt);
    authService.refreshToken.set('refresh-valid-1');

    let responseBody: unknown;
    httpClient.get('http://localhost:8082/ordenes').subscribe(res => (responseBody = res));

    http.expectNone(r => r.url.endsWith('/ordenes') && r.headers.get('Authorization') === `Bearer ${expiredJwt}`);

    const refreshReq = http.expectOne(r => r.method === 'POST' && r.url.includes('/auth/refresh'));
    expect(refreshReq.request.body).toEqual({ refreshToken: 'refresh-valid-1' });
    refreshReq.flush({
      token: freshJwt,
      refreshToken: 'refresh-valid-2',
      email: 'admin@polleria.com',
      name: 'Admin',
      role: 'ADMIN'
    });

    const retryReq = http.expectOne(r => r.method === 'GET' && r.url === 'http://localhost:8082/ordenes');
    expect(retryReq.request.headers.get('Authorization')).toBe(`Bearer ${freshJwt}`);
    retryReq.flush([{ id: 142 }]);

    expect(responseBody).toEqual([{ id: 142 }]);
  });

  it('refresca el token y reintenta cuando un JWT expira en vuelo y el backend responde 403', () => {
    const soonExpiringJwt = createJwt(Math.floor((nowMs + 5_000) / 1000));
    const freshJwt = createJwt(Math.floor((nowMs + 900_000) / 1000));
    authService.token.set(soonExpiringJwt);
    authService.refreshToken.set('refresh-inflight-1');

    let responseBody: unknown;
    httpClient.get('http://localhost:8083/pagos').subscribe(res => (responseBody = res));

    const firstReq = http.expectOne(r => r.method === 'GET' && r.url === 'http://localhost:8083/pagos');
    expect(firstReq.request.headers.get('Authorization')).toBe(`Bearer ${soonExpiringJwt}`);

    // El token expira mientras la petición está en vuelo y el backend devuelve 403
    nowMs += 10_000;
    firstReq.flush('', { status: 403, statusText: 'Forbidden' });

    const refreshReq = http.expectOne(r => r.method === 'POST' && r.url.includes('/auth/refresh'));
    refreshReq.flush({
      token: freshJwt,
      refreshToken: 'refresh-inflight-2',
      email: 'cajero@polleria.com',
      name: 'Cajero',
      role: 'CAJERO'
    });

    const retryReq = http.expectOne(r => r.method === 'GET' && r.url === 'http://localhost:8083/pagos');
    expect(retryReq.request.headers.get('Authorization')).toBe(`Bearer ${freshJwt}`);
    retryReq.flush([{ id: 45 }]);

    expect(responseBody).toEqual([{ id: 45 }]);
  });

  it('fuerza logout si el JWT expiró en vuelo (403) y el refresh falla', () => {
    const soonExpiringJwt = createJwt(Math.floor((nowMs + 5_000) / 1000));
    authService.token.set(soonExpiringJwt);
    authService.refreshToken.set('refresh-revoked');
    const logoutSpy = spyOn(authService, 'forceLogout').and.callThrough();

    let capturedError: HttpErrorResponse | undefined;
    httpClient.get('http://localhost:8083/pagos').subscribe({
      error: (err: HttpErrorResponse) => (capturedError = err)
    });

    const firstReq = http.expectOne(r => r.url === 'http://localhost:8083/pagos');
    nowMs += 10_000;
    firstReq.flush('', { status: 403, statusText: 'Forbidden' });

    const refreshReq = http.expectOne(r => r.url.includes('/auth/refresh'));
    refreshReq.flush({ message: 'Refresh expirado' }, { status: 401, statusText: 'Unauthorized' });

    expect(logoutSpy).toHaveBeenCalled();
    expect(capturedError?.status).toBe(401);
  });

  it('PRESERVE: un 403 legítimo con JWT vigente o token no-JWT no dispara refresh ni logout', () => {
    const validJwt = createJwt(Math.floor((nowMs + 600_000) / 1000));
    authService.token.set(validJwt);
    authService.refreshToken.set('refresh-1');
    const logoutSpy = spyOn(authService, 'forceLogout').and.callThrough();

    let firstError: HttpErrorResponse | undefined;
    httpClient.get('http://localhost:8083/pagos').subscribe({
      error: (err: HttpErrorResponse) => (firstError = err)
    });

    http.expectOne(r => r.url === 'http://localhost:8083/pagos')
      .flush({ message: 'No autorizado' }, { status: 403, statusText: 'Forbidden' });
    http.expectNone(r => r.url.includes('/auth/refresh'));
    expect(logoutSpy).not.toHaveBeenCalled();
    expect(firstError?.status).toBe(403);

    // Token no-JWT de pruebas unitarias (por ejemplo 'token-admin')
    authService.token.set('token-admin');
    let secondError: HttpErrorResponse | undefined;
    httpClient.get('http://localhost:8082/ordenes').subscribe({
      error: (err: HttpErrorResponse) => (secondError = err)
    });

    http.expectOne(r => r.url === 'http://localhost:8082/ordenes')
      .flush({ message: 'Prohibido' }, { status: 403, statusText: 'Forbidden' });
    http.expectNone(r => r.url.includes('/auth/refresh'));
    expect(logoutSpy).not.toHaveBeenCalled();
    expect(secondError?.status).toBe(403);
  });

  it('notifica el error a todas las peticiones en cola si el refresh falla y no deja el estado bloqueado', () => {
    const expiredJwt = createJwt(Math.floor((nowMs - 60_000) / 1000));
    const freshJwt = createJwt(Math.floor((nowMs + 900_000) / 1000));
    authService.token.set(expiredJwt);
    authService.refreshToken.set('refresh-expired');
    const logoutSpy = spyOn(authService, 'forceLogout').and.callThrough();

    let err1: HttpErrorResponse | undefined;
    let err2: HttpErrorResponse | undefined;
    httpClient.get('http://localhost:8082/ordenes').subscribe({ error: e => (err1 = e) });
    httpClient.get('http://localhost:8083/pagos').subscribe({ error: e => (err2 = e) });

    const refreshReqs = http.match(r => r.url.includes('/auth/refresh'));
    expect(refreshReqs.length).toBe(1);
    refreshReqs[0].flush({ message: 'Refresh expirado' }, { status: 401, statusText: 'Unauthorized' });

    expect(logoutSpy).toHaveBeenCalledTimes(1);
    expect(err1?.status).toBe(401);
    expect(err2?.status).toBe(401);

    // After re-login, interceptor must not be stuck
    authService.token.set(expiredJwt);
    authService.refreshToken.set('refresh-new-login');
    let recovered: unknown;
    httpClient.get('http://localhost:8082/ordenes').subscribe(res => (recovered = res));

    const nextRefresh = http.expectOne(r => r.url.includes('/auth/refresh'));
    nextRefresh.flush({
      token: freshJwt,
      refreshToken: 'refresh-new-login-2',
      email: 'admin@polleria.com',
      name: 'Admin',
      role: 'ADMIN'
    });
    http.expectOne(r => r.url === 'http://localhost:8082/ordenes').flush({ ok: true });
    expect(recovered).toEqual({ ok: true });
  });

  it('no deja el refresh colgado si la petición que lo inició se cancela antes de responder', () => {
    const expiredJwt = createJwt(Math.floor((nowMs - 60_000) / 1000));
    const freshJwt = createJwt(Math.floor((nowMs + 900_000) / 1000));
    authService.token.set(expiredJwt);
    authService.refreshToken.set('refresh-abort-1');

    const sub = httpClient.get('http://localhost:8082/ordenes').subscribe();
    const firstRefresh = http.expectOne(r => r.url.includes('/auth/refresh'));
    sub.unsubscribe();
    expect(firstRefresh.cancelled).toBeTrue();

    let recovered: unknown;
    httpClient.get('http://localhost:8083/pagos').subscribe(res => (recovered = res));

    const secondRefresh = http.expectOne(r => r.url.includes('/auth/refresh'));
    secondRefresh.flush({
      token: freshJwt,
      refreshToken: 'refresh-abort-2',
      email: 'admin@polleria.com',
      name: 'Admin',
      role: 'ADMIN'
    });
    http.expectOne(r => r.url === 'http://localhost:8083/pagos').flush([{ id: 1 }]);
    expect(recovered).toEqual([{ id: 1 }]);
  });
});
