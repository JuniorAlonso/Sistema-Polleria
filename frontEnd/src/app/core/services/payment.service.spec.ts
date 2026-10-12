import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PaymentService } from './payment.service';

/**
 * Regla de negocio (S3.1 del documento de feature): el frontend nunca fabrica un
 * resultado de pago. Si el backend falla, el error se propaga.
 */
describe('PaymentService — sin resultados de pago simulados', () => {
  let service: PaymentService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(PaymentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const pagoBackend = {
    id: 41,
    ordenId: 7,
    clienteId: 3,
    monto: 68.5,
    metodoPago: 'YAPE_PLIN' as const,
    estado: 'PENDIENTE' as const,
    creadoEn: '2026-01-01T00:00:00Z'
  };

  describe('iniciarPago', () => {
    it('propaga el error del backend en vez de inventar un pago aprobado', () => {
      let emitido: unknown = 'sin-emitir';
      let fallo = false;

      service.iniciarPago(7, 68.5, 'YAPE').subscribe({
        next: valor => (emitido = valor),
        error: () => (fallo = true)
      });

      http.expectOne(req => req.url.endsWith('/pagos'))
        .flush({ message: 'payments-service caído' }, { status: 500, statusText: 'Server Error' });

      expect(fallo).withContext('el error debe propagarse al llamador').toBeTrue();
      expect(emitido).withContext('no debe emitir una transacción inventada').toBe('sin-emitir');
      expect(service.lastTransaction()).withContext('no debe registrar una transacción local').toBeNull();
    });

    it('mantiene el mapeo real de la respuesta del backend', () => {
      let tx: { id: string; estado: string } | null = null;

      service.iniciarPago(7, 68.5, 'YAPE').subscribe(valor => (tx = valor));

      const req = http.expectOne(req => req.url.endsWith('/pagos'));
      expect(req.request.body.metodoPago).toBe('YAPE_PLIN');
      req.flush(pagoBackend);

      expect(tx!.id).withContext('el id debe venir del backend, no de Date.now()').toBe('41');
      expect(tx!.estado).toBe('PENDIENTE');
      expect(service.lastTransaction()!.id).toBe('41');
    });

    it('no fabrica un token de pasarela para un pago con tarjeta', () => {
      service.iniciarPago(7, 68.5, 'TARJETA').subscribe({ next: () => undefined, error: () => undefined });

      const req = http.expectOne(req => req.url.endsWith('/pagos'));
      expect(req.request.body.tokenPasarela)
        .withContext('un token inventado hace que la pasarela apruebe un cobro que nunca existió')
        .toBeUndefined();

      req.flush({ message: 'Token de pasarela requerido para pago con tarjeta' },
        { status: 400, statusText: 'Bad Request' });
    });
  });

  describe('crearPreferenciaMercadoPago', () => {
    it('propaga el error y no devuelve una URL de pago simulada', () => {
      let emitido: unknown = 'sin-emitir';
      let fallo = false;

      service.crearPreferenciaMercadoPago(7, 68.5).subscribe({
        next: valor => (emitido = valor),
        error: () => (fallo = true)
      });

      http.expectOne(req => req.url.endsWith('/pagos/mercadopago/preferencia'))
        .flush({ message: 'Mercado Pago no disponible' }, { status: 503, statusText: 'Service Unavailable' });

      expect(fallo).withContext('el error debe propagarse al llamador').toBeTrue();
      expect(emitido).withContext('no debe inventar una preferencia').toBe('sin-emitir');
    });

    it('mantiene los puntos de inicio reales cuando el backend responde', () => {
      let pref: { initPoint: string; sandboxInitPoint: string } | null = null;

      service.crearPreferenciaMercadoPago(7, 68.5).subscribe(valor => (pref = valor));

      http.expectOne(req => req.url.endsWith('/pagos/mercadopago/preferencia')).flush({
        preferenceId: 'pref-1',
        initPoint: 'https://www.mercadopago.com.pe/checkout/v1/redirect?pref_id=pref-1',
        sandboxInitPoint: 'https://sandbox.mercadopago.com.pe/checkout/v1/redirect?pref_id=pref-1',
        pagoId: 41,
        ordenId: 7
      });

      expect(pref!.initPoint).toContain('mercadopago.com.pe');
      expect(pref!.sandboxInitPoint).toContain('sandbox.mercadopago.com.pe');
    });
  });
});
