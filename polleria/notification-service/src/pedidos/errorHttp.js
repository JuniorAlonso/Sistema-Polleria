/**
 * Builds the Error thrown when a backend answers with a non-ok status. It carries the HTTP
 * `status` and the backend message (`detalle`) so the bot can tell a business rejection
 * (sanction, amount below the total, inactive order) from an outage.
 */

const MAX_DETALLE = 300;

/** Reads the body safely: the `error`/`mensaje`/`message`/`detail` (Spring ProblemDetail) field of a JSON body, or the plain text. */
async function leerDetalle(res) {
    if (!res) return '';
    let texto = '';
    try {
        if (typeof res.text === 'function') {
            texto = await res.text();
        } else if (typeof res.json === 'function') {
            const cuerpo = await res.json();
            texto = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo);
        }
    } catch (_) {
        return '';
    }
    texto = String(texto || '').trim();
    if (!texto) return '';
    try {
        const cuerpo = JSON.parse(texto);
        if (cuerpo && typeof cuerpo === 'object') {
            const campo = [cuerpo.error, cuerpo.mensaje, cuerpo.message, cuerpo.detail].find(v => typeof v === 'string' && v.trim());
            if (campo) texto = campo.trim();
        }
    } catch (_) {
        // Not JSON: keep the plain text.
    }
    return texto.slice(0, MAX_DETALLE);
}

async function errorDeRespuesta(servicio, res) {
    const status = res ? res.status : null;
    const detalle = await leerDetalle(res);
    const error = new Error(`${servicio} respondió ${status === null ? 'sin respuesta' : status}${detalle ? ': ' + detalle : ''}`);
    error.status = status;
    error.detalle = detalle;
    return error;
}

module.exports = { leerDetalle, errorDeRespuesta };
