import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PaymentService } from './payment.service';

describe('PaymentService.confirmarPago', () => {
  it('propaga el rechazo del backend para que el cajero vea el motivo', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(PaymentService);
    const http = TestBed.inject(HttpTestingController);
    let error: { status?: number } | undefined;

    service.confirmarPago(5, 'POS-1').subscribe({ error: e => (error = e) });
    http.expectOne(r => r.method === 'PATCH' && r.url.endsWith('/pagos/5/confirmar'))
      .flush({ detail: 'El monto no coincide' }, { status: 409, statusText: 'Conflict' });

    expect(error?.status).toBe(409);
  });
});
