/** Minutes the cashier has to validate a Yape/Plin capture or confirm a ContraPago call (backend rule). */
export const MINUTOS_VALIDACION_PAGO = 15;

/** Minutes a pickup order waits in store before it can be declared a ghost order (backend rule). */
export const MINUTOS_ESPERA_RECOJO = 60;

/**
 * Whole minutes left until `desdeIso + plazoMinutos`. Negative once expired; null when the
 * start timestamp is missing or unparsable (the UI shows no countdown instead of a fake one).
 */
export function minutosRestantes(desdeIso: string | undefined | null, plazoMinutos: number, nowMs: number): number | null {
  if (!desdeIso) return null;
  const inicio = new Date(desdeIso).getTime();
  if (Number.isNaN(inicio)) return null;
  return Math.ceil((inicio + plazoMinutos * 60000 - nowMs) / 60000);
}

/** Normalizes a ticket / tracking code so "POL-0042", "pol 42" and "0042" compare equal. */
export function normalizarCodigoTicket(codigo: string | number | undefined | null): string {
  return String(codigo ?? '')
    .toUpperCase()
    .replace(/^POL/, '')
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^0+(?=.)/, '');
}
