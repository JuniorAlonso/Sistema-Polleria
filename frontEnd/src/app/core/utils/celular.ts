const CELULAR_REGEX = /^9\d{8}$/;

/**
 * Strips non-digit characters, removes a leading Peru country code (`51`)
 * when an 11-digit mobile number (`519XXXXXXXX`) is pasted, and caps at 9 digits.
 */
export function normalizarCelular(valor: string): string {
  const soloDigitos = (valor || '').replace(/\D/g, '').replace(/^51(?=9\d{8}$)/, '');
  return soloDigitos.slice(0, 9);
}

/**
 * Checks that the normalized phone number is a 9-digit Peruvian mobile starting with 9.
 */
export function esCelularValido(valor: string): boolean {
  return CELULAR_REGEX.test(normalizarCelular(valor));
}

/**
 * Returns a user-facing validation message for an invalid mobile number.
 */
export function mensajeErrorCelular(valor: string): string {
  const limpio = normalizarCelular(valor);
  if (!limpio) {
    return 'El número de celular es obligatorio.';
  }
  if (!limpio.startsWith('9')) {
    return 'El celular debe empezar con el dígito 9.';
  }
  return 'El celular debe tener exactamente 9 dígitos.';
}

/**
 * Keeps only ASCII digits and caps the result to `maxLength`.
 */
export function sanitizarDigitos(valor: string, maxLength: number): string {
  return (valor || '').replace(/\D/g, '').slice(0, maxLength);
}
