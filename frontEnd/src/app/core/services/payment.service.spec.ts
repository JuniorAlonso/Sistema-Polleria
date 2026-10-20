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

  /**
   * T6e (S6/S7) — verificación manual del comprobante de Yape por el ADMIN. El frontend nunca
   * decide el resultado: muestra el estado que devuelve el backend y propaga su mensaje de error
   * tal cual. La URL firmada del comprobante vive 300 s, así que cada consulta pide una nueva.
   */
  describe('verificación del comprobante de Yape (T6e)', () => {
    const pagoPendiente = {
      id: 41,
      ordenId: 7,
      monto: 68.5,
      metodoPago: 'YAPE_PLIN' as const,
      estado: 'PENDIENTE_VERIFICACION' as const,
      creadoEn: '2026-01-01T00:00:00Z',
      comprobanteClave: 'comprobantes/yape/7/foto.jpg',
      comprobanteUrl: 'http://localhost:9000/polleria-comprobantes/comprobantes/yape/7/foto.jpg?X-Amz-Signature=abc'
    };

    it('consulta el pago de la orden en la ruta correcta y devuelve la URL del comprobante', () => {
      let pago: { estado?: string; comprobanteUrl?: string | null } | null = null;
      let fallo = false;

      service.obtenerPagoParaVerificacion(7).subscribe({
        next: valor => (pago = valor),
        error: () => (fallo = true)
      });

      const req = http.expectOne(r => r.method === 'GET' && r.url.endsWith('/pagos/orden/7'));
      req.flush(pagoPendiente);

      expect(fallo).toBeFalse();
      expect(pago!.estado).toBe('PENDIENTE_VERIFICACION');
      expect(pago!.comprobanteUrl)
        .withContext('la URL firmada del comprobante debe llegar al ADMIN para verla')
        .toContain('/comprobantes/yape/7/foto.jpg');
    });

    it('aprueba con { aprobado: true } y refleja el estado que devuelve el backend', () => {
      let pago: { estado?: string } | null = null;

      service.verificarComprobante(41, true).subscribe(valor => (pago = valor));

      const req = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/pagos/41/verificar'));
      expect(req.request.body).toEqual({ aprobado: true });

      req.flush({ ...pagoPendiente, estado: 'APROBADO', comprobanteUrl: null });

      expect(pago!.estado)
        .withContext('el estado mostrado debe ser el del backend, no uno optimista')
        .toBe('APROBADO');
    });

    it('rechaza con el motivo y propaga el mensaje de error del backend sin reportar éxito', () => {
      let emitido: unknown = 'sin-emitir';
      let mensaje = '';

      service.verificarComprobante(41, false, '  El monto no coincide con el total  ').subscribe({
        next: valor => (emitido = valor),
        error: (err: Error) => (mensaje = err.message)
      });

      const req = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/pagos/41/verificar'));
      expect(req.request.body).toEqual({ aprobado: false, motivoRechazo: 'El monto no coincide con el total' });

      req.flush(
        { error: 'Solo se puede verificar un comprobante PENDIENTE_VERIFICACION. Estado actual: APROBADO' },
        { status: 409, statusText: 'Conflict' }
      );

      expect(mensaje)
        .withContext('el mensaje del backend debe llegar tal cual al usuario')
        .toBe('Solo se puede verificar un comprobante PENDIENTE_VERIFICACION. Estado actual: APROBADO');
      expect(emitido).withContext('un rechazo fallido no puede emitir un resultado de éxito').toBe('sin-emitir');
    });

    it('no dispara ninguna llamada si falta el motivo al rechazar', () => {
      let emitido = false;
      let mensaje = '';

      service.verificarComprobante(41, false, '   ').subscribe({
        next: () => (emitido = true),
        error: (err: Error) => (mensaje = err.message)
      });

      http.expectNone(r => r.method === 'POST' && r.url.includes('/verificar'));
      expect(emitido).toBeFalse();
      expect(mensaje)
        .withContext('sin motivo no se llama al backend: la validación es local')
        .toBeTruthy();
    });
  });
});
