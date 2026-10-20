/**
 * Dedup de mensajes entrantes por `message.id` (T3a, S14).
 *
 * WhatsApp puede reentregar el mismo mensaje; sin esto, el mismo paso del flujo se
 * ejecutaría dos veces (dos preguntas, dos avances de estado). El registro vive en
 * memoria con vencimiento: no hace falta persistirlo, basta con cubrir la reentrega.
 */

class DedupMensajes {
    constructor({ ttlMs = 6 * 60 * 60 * 1000, ahora = Date.now } = {}) {
        this.ttlMs = ttlMs;
        this.ahora = ahora;
        this.vistos = new Map();
    }

    /** true si el id es nuevo (hay que procesarlo); false si ya se procesó. */
    registrar(id) {
        if (!id) return true;
        const ahora = this.ahora();
        this._limpiar(ahora);
        if (this.vistos.has(id)) return false;
        this.vistos.set(id, ahora + this.ttlMs);
        return true;
    }

    _limpiar(ahora) {
        for (const [id, expiraEn] of this.vistos) {
            if (expiraEn <= ahora) this.vistos.delete(id);
        }
    }
}

module.exports = { DedupMensajes };
