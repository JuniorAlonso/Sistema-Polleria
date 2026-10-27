import { MINUTOS_ESPERA_RECOJO, MINUTOS_VALIDACION_PAGO, minutosRestantes, normalizarCodigoTicket } from './cajero-plazos.helpers';

describe('cajero-plazos helpers', () => {
  const inicio = '2026-10-26T10:00:00Z';
  const t = (min: number) => new Date(inicio).getTime() + min * 60000;

  it('counts down the 15 minute payment window and goes negative once expired', () => {
    expect(minutosRestantes(inicio, MINUTOS_VALIDACION_PAGO, t(0))).toBe(15);
    expect(minutosRestantes(inicio, MINUTOS_VALIDACION_PAGO, t(14.5))).toBe(1);
    expect(minutosRestantes(inicio, MINUTOS_VALIDACION_PAGO, t(15))).toBe(0);
    expect(minutosRestantes(inicio, MINUTOS_VALIDACION_PAGO, t(20))).toBe(-5);
  });

  it('counts down the 1 hour pickup window', () => {
    expect(minutosRestantes(inicio, MINUTOS_ESPERA_RECOJO, t(30))).toBe(30);
  });

  it('returns null without a usable start timestamp instead of a fake countdown', () => {
    expect(minutosRestantes(undefined, 15, t(0))).toBeNull();
    expect(minutosRestantes('not-a-date', 15, t(0))).toBeNull();
  });

  it('normalizes ticket codes so prefix, separators and leading zeros do not matter', () => {
    expect(normalizarCodigoTicket('POL-0042')).toBe('42');
    expect(normalizarCodigoTicket('pol 42')).toBe('42');
    expect(normalizarCodigoTicket('0042')).toBe('42');
    expect(normalizarCodigoTicket(42)).toBe('42');
    expect(normalizarCodigoTicket('POL-0043')).not.toBe(normalizarCodigoTicket('POL-0042'));
    expect(normalizarCodigoTicket('')).toBe('');
  });
});
