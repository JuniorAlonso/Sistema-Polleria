import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FinanceService } from './finance.service';

describe('FinanceService.registrarVentaEnCaja (D3.1, D3.2)', () => {
  let service: FinanceService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(FinanceService);
    http = TestBed.inject(HttpTestingController);
  });

  it('emite el comprobante con ingresoCaja y sin enviar un total propio', () => {
    service.registrarVentaEnCaja(101, { tipo: 'FACTURA', tipoDoc: 'RUC', numDoc: '20123456789', nombre: 'ACME SAC', direccion: 'Av. 1' }, true)
      .subscribe();

    const req = http.match(r => r.method === 'POST' && r.url.endsWith('/finanzas/comprobantes'))[0];
    expect(req.request.body).toEqual({
      ordenId: 101,
      tipo: 'FACTURA',
      clienteTipoDoc: 'RUC',
      clienteNumDoc: '20123456789',
      clienteNombre: 'ACME SAC',
      clienteDireccion: 'Av. 1',
      pagadoDigitalmente: true,
      ingresoCaja: true
    });
  });

  it('un cobro con tarjeta o Yape no registra ingreso en caja', () => {
    service.registrarVentaEnCaja('55', { tipo: 'BOLETA', nombre: 'Cliente General' }, false).subscribe();

    const req = http.match(r => r.method === 'POST' && r.url.endsWith('/finanzas/comprobantes'))[0];
    expect(req.request.body.ordenId).toBe(55);
    expect(req.request.body.ingresoCaja).toBeFalse();
    expect(req.request.body.total).toBeUndefined();
  });
});
