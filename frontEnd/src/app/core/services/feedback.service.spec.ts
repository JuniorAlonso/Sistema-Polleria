import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FeedbackService } from './feedback.service';
import { NotificationService } from './notification.service';
import { Resenia } from '../models/feedback.model';

describe('FeedbackService (FE-12, no fabricated dates, Idempotency-Key)', () => {
  let service: FeedbackService;
  let httpMock: HttpTestingController;
  let notify: jasmine.SpyObj<NotificationService>;

  beforeEach(() => {
    notify = jasmine.createSpyObj<NotificationService>('NotificationService', ['showSuccess', 'showError', 'showInfo']);
    TestBed.configureTestingModule({
      providers: [
        FeedbackService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: notify }
      ]
    });
    service = TestBed.inject(FeedbackService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('expone cargaError cuando fallan los listados y lo limpia al recuperar (FE-12)', () => {
    service.cargarReportes();
    const failReq = httpMock.expectOne(r => r.url.endsWith('/feedback/admin/reportes'));
    failReq.flush({ error: 'Servicio de feedback caído' }, { status: 503, statusText: 'Service Unavailable' });

    expect(service.cargaError()).toBe('Servicio de feedback caído');

    service.cargarReportes();
    const okReq = httpMock.expectOne(r => r.url.endsWith('/feedback/admin/reportes'));
    okReq.flush([]);

    expect(service.cargaError()).toBeNull();
  });

  it('deja la fecha vacía cuando el backend omite creadoEn en reseñas (sin "Ahora"/"Hoy"/"Registrado")', () => {
    service.cargarResenias();
    const listReq = httpMock.expectOne(r => r.url.endsWith('/feedback/resenias'));
    listReq.flush([{ id: 1, ordenId: 10, calificacion: 5, comentario: 'Excelente atención' } as Resenia]);

    expect(service.resenias()[0].fecha).toBe('');

    let created: Resenia | undefined;
    service.enviarResenia({ ordenId: 11, calificacion: 4, comentario: 'Muy buen sabor' }).subscribe(r => {
      created = r;
    });
    const postReq = httpMock.expectOne(r => r.url.endsWith('/feedback/resenias') && r.method === 'POST');
    postReq.flush({ id: 2, ordenId: 11, calificacion: 4, comentario: 'Muy buen sabor' } as Resenia);

    expect(created).toBeTruthy();
    expect(service.resenias()[0].fecha).toBe('');
  });

  it('envía header Idempotency-Key no vacío al resolver un reclamo en resolverReclamo', () => {
    service.resolverReclamo(77, 'Se aprobó reembolso parcial', true, 18.5, 'RESUELTO').subscribe();

    const req = httpMock.expectOne(r =>
      r.method === 'PATCH' && r.url.endsWith('/feedback/admin/reportes/77/resolver')
    );
    expect(req.request.headers.get('Idempotency-Key')?.trim()).toBeTruthy();
    expect(req.request.body).toEqual({
      estado: 'RESUELTO',
      respuestaAdmin: 'Se aprobó reembolso parcial',
      reembolsoProcedente: true,
      montoReembolso: 18.5
    });

    req.flush({
      id: 77,
      ordenId: 50,
      motivo: 'PEDIDO_INCOMPLETO',
      descripcion: 'Faltó gaseosa',
      estado: 'RESUELTO'
    });
  });
});
