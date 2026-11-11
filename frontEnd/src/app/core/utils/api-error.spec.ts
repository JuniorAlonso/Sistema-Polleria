import { mensajeError } from './api-error';

describe('mensajeError', () => {
  it('usa el detail de un ProblemDetail (payments-service)', () => {
    expect(mensajeError({ error: { detail: 'Monto distinto' } }, 'x')).toBe('Monto distinto');
  });

  it('usa el campo error (finance-service)', () => {
    expect(mensajeError({ error: { error: 'No hay caja abierta' } }, 'x')).toBe('No hay caja abierta');
  });

  it('usa message cuando no hay detail ni error', () => {
    expect(mensajeError({ error: { message: 'Algo' } }, 'x')).toBe('Algo');
  });

  it('devuelve el mensaje por defecto sin cuerpo útil', () => {
    expect(mensajeError({ status: 0 }, 'Sin conexión')).toBe('Sin conexión');
    expect(mensajeError(null, 'Sin conexión')).toBe('Sin conexión');
  });
});
