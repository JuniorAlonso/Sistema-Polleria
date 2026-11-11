/**
 * Business message of a backend error. Services do not share an error format (Plan 00, section 3):
 * payments-service answers a ProblemDetail (`detail`), finance-service and orders-service an
 * `{ error }` body. Without a useful body the caller's default is returned.
 */
export function mensajeError(err: unknown, porDefecto: string): string {
  const cuerpo = (err as { error?: { detail?: unknown; error?: unknown; message?: unknown } } | null)?.error;
  const candidato = cuerpo?.detail ?? cuerpo?.error ?? cuerpo?.message;
  return typeof candidato === 'string' && candidato.trim() ? candidato : porDefecto;
}
