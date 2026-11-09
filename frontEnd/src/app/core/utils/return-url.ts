/**
 * The `returnUrl` query param only accepts a path inside this app ("/checkout"). Anything that
 * could point to another site ("//evil.com", "https://…", "/\evil.com", "javascript:") is rejected,
 * so login cannot be turned into an open redirect.
 */
export function rutaDeRetornoSegura(valor: string | null | undefined): string | null {
  if (!valor || !valor.startsWith('/')) return null;
  if (valor.startsWith('//') || valor.startsWith('/\\') || valor.includes('://')) return null;
  return valor;
}
