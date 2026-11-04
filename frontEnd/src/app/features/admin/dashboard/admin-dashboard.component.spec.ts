import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { AuthService } from '../../../core/services/auth.service';
import { SalonService } from '../../../core/services/salon.service';
import { productoDto, tokenDeSesion } from '../testing/admin-test-helpers';

@Component({ standalone: true, template: '<p>pestaña de prueba</p>' })
class PestanaStub {}

/** Shell del panel admin: sidebar, header y router-outlet con la pestaña activa derivada de la ruta. */
describe('AdminDashboardComponent (shell)', () => {
  let fixture: ComponentFixture<AdminDashboardComponent>;
  let component: AdminDashboardComponent;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();

    TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'ordenes', component: PestanaStub },
          { path: 'mesas', component: PestanaStub }
        ])
      ]
    });

    TestBed.inject(AuthService).token.set(tokenDeSesion());
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);

    fixture.detectChanges();

    http.match(r => r.method === 'GET' && r.url.includes('/productos'))
      .forEach(r => r.flush([productoDto]));
    http.match(r => r.method === 'GET').forEach(r => r.flush([]));
  });

  afterEach(() => {
    TestBed.inject(SalonService).detenerSincronizacion();
    fixture.destroy();
    http.verify();
  });

  it('renderiza el sidebar con todas las pestañas', () => {
    const texto = fixture.nativeElement.textContent as string;
    for (const etiqueta of ['Órdenes', 'Mesas & Salón', 'Inventario', 'Reparto', 'Finanzas', 'Feedback', 'WhatsApp', 'Soporte']) {
      expect(texto).toContain(etiqueta);
    }
  });

  it('deriva la pestaña activa de la ruta hija', async () => {
    await router.navigateByUrl('/mesas');
    fixture.detectChanges();

    expect(component.activeTab()).toBe('MESAS');
    expect(component.getActiveTabLabel()).toBe('Mesas & Salón en Vivo');
    expect(fixture.nativeElement.textContent as string).toContain('pestaña de prueba');
  });
});
