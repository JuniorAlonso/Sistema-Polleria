/**
 * Detección de señales de bloqueo de WhatsApp y circuit breaker asociado (T4b, S2/S8).
 *
 * La detección es HEURÍSTICA: WhatsApp Web no expone un código de error oficial, así que
 * se buscan signos conocidos dentro del mensaje del error. Los patrones viven en
 * PATRONES_BLOQUEO y cada uno tiene una `senal` legible que se expone en /status para
 * poder leer POR QUÉ se abrió el breaker. Un error que no coincide con ningún patrón NO
 * abre el breaker: los fallos comunes (sin WhatsApp, timeout, error de red) se manejan
 * con los reintentos normales de la cola.
 *
 * Al abrirse, la cola global se pausa y se aplica un backoff exponencial acotado:
 *   espera = min(breakerBaseMs * 2^aperturas, breakerMaxMs)
 * Al vencer el backoff el breaker pasa a medio abierto y deja pasar UN envío de prueba;
 * si sale bien cierra y resetea, si vuelve a fallar con una señal reabre con el doble de
 * espera (hasta el tope). Ningún trabajo encolado se descarta durante la pausa.
 *
 * Para ampliar la heurística basta con agregar un patrón a PATRONES_BLOQUEO; el resto del
 * flujo (pausa, backoff, /status) no cambia.
 */

const PATRONES_BLOQUEO = [
    { senal: 'rate-overlimit', patron: /rate[-_ ]?over[-_ ]?limit/i },
    { senal: 'too-many-requests', patron: /too many requests|demasiadas solicitudes/i },
    { senal: 'http-429', patron: /\b429\b/ },
    { senal: 'numero-bloqueado', patron: /\bblocked\b|\bbloquead[oa]\b|temporarily banned|\bbanned\b/i }
];

/**
 * @returns {{senal: string, detalle: string} | null}
 *   El nombre legible de la señal detectada y el texto que la disparó, o null si el
 *   error no parece un bloqueo.
 */
function detectarSenalDeBloqueo(error) {
    const texto = error && error.message ? error.message : (error == null ? '' : String(error));
    if (!texto) return null;
    for (const { senal, patron } of PATRONES_BLOQUEO) {
        if (patron.test(texto)) return { senal, detalle: texto };
    }
    return null;
}

const ESTADOS_BREAKER = {
    CERRADO: 'cerrado',
    ABIERTO: 'abierto',
    MEDIO_ABIERTO: 'medioAbierto'
};

class CircuitBreaker {
    constructor({ ajustes, ahora = () => Date.now() }) {
        this.ajustes = ajustes;
        this.ahora = ahora;
        this._estado = ESTADOS_BREAKER.CERRADO;
        this._abiertoHasta = 0;
        this._aperturas = 0;
        this._senal = null;
        this._detalle = null;
    }

    _cfg() {
        return typeof this.ajustes.obtener === 'function' ? this.ajustes.obtener() : this.ajustes;
    }

    /** Abre el breaker y devuelve la espera aplicada (base * 2^aperturas, con tope). */
    abrir(t, senal) {
        const cfg = this._cfg();
        const espera = Math.min(cfg.breakerBaseMs * 2 ** this._aperturas, cfg.breakerMaxMs);
        this._aperturas += 1;
        this._estado = ESTADOS_BREAKER.ABIERTO;
        this._abiertoHasta = t + espera;
        this._senal = senal.senal;
        this._detalle = senal.detalle || null;
        return espera;
    }

    /**
     * Un envío salió bien: el canal está operativo. Cierra y resetea el backoff, pero
     * conserva la última señal para que /status pueda seguir mostrando por qué se abrió.
     */
    registrarExito(t = this.ahora()) {
        this._estado = ESTADOS_BREAKER.CERRADO;
        this._abiertoHasta = 0;
        this._aperturas = 0;
    }

    /** @returns {boolean} true si el error era una señal de bloqueo (y abrió el breaker). */
    registrarFallo(t, error) {
        const senal = detectarSenalDeBloqueo(error);
        if (!senal) {
            // El canal respondió: aunque el envío haya fallado, no es un bloqueo.
            this.registrarExito(t);
            return false;
        }
        this.abrir(t, senal);
        return true;
    }

    /** null si se puede enviar; si no, { motivo, esperarMs, detalle }. */
    motivoDePausa(t = this.ahora()) {
        if (this._estado === ESTADOS_BREAKER.CERRADO) return null;
        if (this._estado === ESTADOS_BREAKER.ABIERTO) {
            if (t >= this._abiertoHasta) {
                this._estado = ESTADOS_BREAKER.MEDIO_ABIERTO;
                return null; // se permite un único envío de prueba
            }
            const restante = Math.max(1, this._abiertoHasta - t);
            return {
                motivo: 'circuit-breaker',
                esperarMs: restante,
                detalle: `Circuit breaker abierto por ${this._senal}; reintento en ${restante} ms`
            };
        }
        return null; // medio abierto: deja pasar el envío de prueba
    }

    /** Vista para /status. No muta el estado. */
    estado(t = this.ahora()) {
        const efectivo = this._estado === ESTADOS_BREAKER.ABIERTO && t >= this._abiertoHasta
            ? ESTADOS_BREAKER.MEDIO_ABIERTO
            : this._estado;
        return {
            estado: efectivo,
            senal: this._senal,
            detalle: this._detalle,
            aperturas: this._aperturas,
            reintentoEn: efectivo === ESTADOS_BREAKER.ABIERTO ? Math.max(0, this._abiertoHasta - t) : 0
        };
    }
}

module.exports = { PATRONES_BLOQUEO, detectarSenalDeBloqueo, CircuitBreaker, ESTADOS_BREAKER };
