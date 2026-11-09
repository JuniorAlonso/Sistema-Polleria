import { rutaDeRetornoSegura } from './return-url';

describe('rutaDeRetornoSegura', () => {
  it('accepts an internal path of the app', () => {
    expect(rutaDeRetornoSegura('/checkout')).toBe('/checkout');
    expect(rutaDeRetornoSegura('/tracking?code=POL-5')).toBe('/tracking?code=POL-5');
  });

  it('rejects anything that could leave the app (open redirect)', () => {
    for (const valor of ['//evil.com', 'https://evil.com', '/\\evil.com', 'javascript:alert(1)', 'checkout', '', null, undefined]) {
      expect(rutaDeRetornoSegura(valor)).withContext(String(valor)).toBeNull();
    }
  });
});
