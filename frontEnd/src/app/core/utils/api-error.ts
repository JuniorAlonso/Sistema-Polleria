/**
 * Business message of a backend error. Services do not share an error format (Plan 00, section 3):
 * payments-service answers a ProblemDetail (`detail`), finance-service and orders-service an
 * `{ error }` body. Without a useful body the caller's default is returned.
 */
export function mensajeError(err: unknown, porDefecto: string): string {
  const errorObj = (err as { error?: unknown } | null)?.error;
  if (typeof errorObj === 'string' && errorObj.trim()) {
    return errorObj;
  }
  const cuerpo = errorObj as {
    detail?: unknown;
    error?: unknown;
    message?: unknown;
    mensaje?: unknown;
    errors?: Record<string, unknown>;
  } | null;
  const candidato = cuerpo?.detail ?? cuerpo?.error ?? cuerpo?.message ?? cuerpo?.mensaje;
  if (typeof candidato === 'string' && candidato.trim()) {
    return candidato;
  }
  if (cuerpo?.errors && typeof cuerpo.errors === 'object') {
    const textos = Object.values(cuerpo.errors)
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
    if (textos.length > 0) {
      return textos.join('. ');
    }
  }
  if (err instanceof Error && err.message.trim() && !('status' in err)) {
    return err.message;
  }
  return porDefecto;
}

/**
 * Extrae el mensaje JSON {"error": "..."} cuando la petición usó responseType: 'blob'.
 */
export async function mensajeErrorBlob(err: unknown, porDefecto: string): Promise<string> {
  const errorObj = (err as { error?: unknown } | null)?.error;
  if (typeof Blob !== 'undefined' && errorObj instanceof Blob) {
    try {
      const texto = (await errorObj.text()).trim();
      if (texto) {
        try {
          const parsed = JSON.parse(texto) as unknown;
          return mensajeError({ error: parsed }, porDefecto);
        } catch {
          return texto;
        }
      }
    } catch {
      return porDefecto;
    }
  }
  return mensajeError(err, porDefecto);
}
