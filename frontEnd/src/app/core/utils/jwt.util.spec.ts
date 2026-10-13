import { leerUserIdDelToken } from './jwt.util';

/** Construye un token con la forma real (header.payload.signature) en base64url. */
function tokenConPayload(payload: unknown): string {
  const base64url = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `cabecera.${base64url}.firma-falsa`;
}

describe('leerUserIdDelToken', () => {
  it('devuelve el id numérico del claim userId', () => {
    expect(leerUserIdDelToken(tokenConPayload({ userId: 4, role: 'REPARTIDOR' }))).toBe(4);
  });

  it('acepta el id cuando llega como texto numérico', () => {
    expect(leerUserIdDelToken(tokenConPayload({ userId: '12' }))).toBe(12);
  });

  it('devuelve null en lugar de inventar un id', () => {
    expect(leerUserIdDelToken(null)).toBeNull();
    expect(leerUserIdDelToken('')).toBeNull();
    expect(leerUserIdDelToken('sin-puntos')).toBeNull();
    expect(leerUserIdDelToken('a.b.c')).toBeNull();
    expect(leerUserIdDelToken(tokenConPayload({ role: 'REPARTIDOR' }))).toBeNull();
    expect(leerUserIdDelToken(tokenConPayload({ userId: 'no-es-un-numero' }))).toBeNull();
  });
});
