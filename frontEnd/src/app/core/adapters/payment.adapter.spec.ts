import { PaymentAdapter } from './payment.adapter';
import { BackendPagoResponse } from '../models/api-contracts.model';

describe('PaymentAdapter (FE-08, FE-16)', () => {
  const baseDto = (overrides: Partial<BackendPagoResponse> = {}): BackendPagoResponse => ({
    id: 10,
    ordenId: 55,
    clienteId: 1,
    metodoPago: 'TARJETA',
    monto: 45.5,
    estado: 'APROBADO',
    creadoEn: '',
    ...overrides
  });

  it('mapea REEMBOLSADO y REEMBOLSADO_PARCIAL sin degradarlos a PENDIENTE (FE-08)', () => {
    expect(PaymentAdapter.toPaymentStatus('REEMBOLSADO')).toBe('REEMBOLSADO');
    expect(PaymentAdapter.toPaymentStatus('REEMBOLSADO_PARCIAL')).toBe('REEMBOLSADO_PARCIAL');
    expect(PaymentAdapter.toPaymentTransaction(baseDto({ estado: 'REEMBOLSADO_PARCIAL' })).estado)
      .toBe('REEMBOLSADO_PARCIAL');
  });

  it('deja fechaTransaccion vacía si backend omite creadoEn sin fabricar fechas', () => {
    const tx = PaymentAdapter.toPaymentTransaction(baseDto({ creadoEn: '' }));
    expect(tx.fechaTransaccion).toBe('');
  });

  it('lanza Error en toBackendIniciarRequest cuando ordenId es inválido (FE-16)', () => {
    expect(() => PaymentAdapter.toBackendIniciarRequest('POL-abc', 30, 'TARJETA'))
      .toThrowError(/Id de orden inválido/);
    expect(() => PaymentAdapter.toBackendIniciarRequest(0, 30, 'TARJETA'))
      .toThrowError(/Id de orden inválido/);
    expect(() => PaymentAdapter.toBackendIniciarRequest('-5', 30, 'TARJETA'))
      .toThrowError(/Id de orden inválido/);
  });

  it('construye request válido sin inventar teléfono de Yape', () => {
    const req = PaymentAdapter.toBackendIniciarRequest('77', 35.555, 'YAPE');
    expect(req).toEqual({
      ordenId: 77,
      monto: 35.56,
      metodoPago: 'YAPE_PLIN',
      telefonoYape: undefined
    });
  });
});
