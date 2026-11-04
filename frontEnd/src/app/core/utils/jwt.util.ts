/**
 * El login no devuelve el id numérico del usuario, pero el JWT sí lo lleva en el claim `userId`
 * (auth-service, JwtService.generateToken). El panel del motorizado necesita su propio id para
 * auto-asignarse un pedido (PATCH /ordenes/{id}/estado con `repartidorId`).
 *
 * Aquí solo se decodifica el payload: la firma la valida el backend en cada petición, así que un
 * token manipulado en el navegador no habilita nada. Ante cualquier duda se devuelve null y el
 * llamador trata el caso como "sin identidad", nunca como un id inventado.
 */
export function leerUserIdDelToken(token: string | null | undefined): number | null {
  if (!token) return null;

  const partes = token.split('.');
  if (partes.length !== 3) return null;

  try {
    // El payload viene en base64url: atob necesita el alfabeto estándar y el relleno.
    const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
    const relleno = (4 - (base64.length % 4)) % 4;
    const payload = JSON.parse(atob(base64 + '='.repeat(relleno)));

    const crudo = payload?.userId;
    if (typeof crudo === 'number' && Number.isFinite(crudo)) return crudo;
    if (typeof crudo === 'string' && crudo.trim() !== '' && Number.isFinite(Number(crudo))) {
      return Number(crudo);
    }
    return null;
  } catch {
    return null;
  }
}
