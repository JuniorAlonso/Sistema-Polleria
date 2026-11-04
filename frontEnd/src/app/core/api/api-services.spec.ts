import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OrdersApiService } from './orders-api.service';
import { PaymentsApiService } from './payments-api.service';
import { FinanceApiService } from './finance-api.service';
import { IncidentsApiService } from './incidents-api.service';

describe('Api services', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('OrdersApiService.actualizarEstado hace PATCH /ordenes/:id/estado', () => {
    TestBed.inject(OrdersApiService).actualizarEstado(5, { estado: 'LISTO' } as never).subscribe();
    const req = httpMock.expectOne(r => r.url.endsWith('/ordenes/5/estado'));
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('PaymentsApiService.listar hace GET /pagos', () => {
    TestBed.inject(PaymentsApiService).listar().subscribe();
    const req = httpMock.expectOne(r => r.url.endsWith('/pagos'));
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('FinanceApiService.abrirCaja hace POST /finanzas/caja/apertura', () => {
    TestBed.inject(FinanceApiService).abrirCaja({ montoApertura: 10 } as never).subscribe();
    const req = httpMock.expectOne(r => r.url.endsWith('/finanzas/caja/apertura'));
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('IncidentsApiService.listar hace GET /incidentes', () => {
    TestBed.inject(IncidentsApiService).listar().subscribe();
    const req = httpMock.expectOne(r => r.url.endsWith('/incidentes'));
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
