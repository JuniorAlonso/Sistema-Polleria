import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminSoportePage } from './admin-soporte.page';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { tokenDeSesion } from '../../testing/admin-test-helpers';

describe('AdminSoportePage — desbloqueo de IP', () => {
  let page: AdminSoportePage;
  let http: HttpTestingController;
  let notify: NotificationService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    TestBed.inject(AuthService).token.set(tokenDeSesion());
    page = TestBed.runInInjectionContext(() => new AdminSoportePage());
    http = TestBed.inject(HttpTestingController);
    notify = TestBed.inject(NotificationService);
    spyOn(notify, 'showSuccess');
    spyOn(notify, 'showError');
    http.match(r => r.method === 'GET').forEach(r => r.flush([]));
  });

  afterEach(() => {
    http.match(r => r.method === 'GET').forEach(r => r.flush([]));
    http.verify();
  });

  it('sends the DELETE, shows a single toast and reloads the list from the backend', () => {
    page.desbloquearIp('10.0.0.5');

    const del = http.expectOne(r => r.method === 'DELETE' && r.url.endsWith('/ips-bloqueadas/10.0.0.5'));
    del.flush(null);

    expect(notify.showSuccess).toHaveBeenCalledTimes(1);
    expect(http.match(r => r.method === 'GET' && r.url.endsWith('/ips-bloqueadas')).length).toBe(1);
  });

  it('shows the backend error and keeps the list when the unblock fails', () => {
    page.desbloquearIp('10.0.0.5');

    http.expectOne(r => r.method === 'DELETE')
      .flush({ error: 'IP no encontrada' }, { status: 404, statusText: 'Not Found' });

    expect(notify.showError).toHaveBeenCalledWith('IP no encontrada');
    expect(notify.showSuccess).not.toHaveBeenCalled();
    http.expectNone(r => r.method === 'GET' && r.url.endsWith('/ips-bloqueadas'));
  });
});
