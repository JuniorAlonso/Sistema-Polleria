/**
 * Cliente del catálogo real de orders-service (T3a, S1/S12).
 *
 * Lee `GET /productos` (público) para que el bot no tenga precios escritos a mano.
 * La carta cambia poco y no se quiere golpear orders-service en cada mensaje, así que
 * hay un cache corto en memoria. Si el servicio falla o no responde, `listar()` lanza
 * y el bot avisa que no puede tomar el pedido: NUNCA se devuelve una carta inventada.
 *
 * El `fetchImpl`, el reloj (`ahora`) y el timeout son inyectables para que los tests
 * sean deterministas y no toquen la red real.
 */

const URL_POR_DEFECTO = 'http://localhost:8082';

class CatalogoRemoto {
    constructor({ baseUrl = URL_POR_DEFECTO, ttlMs = 30000, timeoutMs = 3000, fetchImpl, ahora = Date.now } = {}) {
        this.baseUrl = String(baseUrl || URL_POR_DEFECTO).replace(/\/+$/, '');
        this.ttlMs = ttlMs;
        this.timeoutMs = timeoutMs;
        this.fetchImpl = fetchImpl || globalThis.fetch;
        this.ahora = ahora;
        this._cache = null;
    }

    /** Productos disponibles según orders-service. Lanza si la carta no se pudo leer. */
    async listar() {
        const ahora = this.ahora();
        if (this._cache && ahora < this._cache.expiraEn) {
            return this._cache.productos;
        }
        const productos = await this._descargar();
        this._cache = { productos, expiraEn: ahora + this.ttlMs };
        return productos;
    }

    /** Fuerza a la próxima llamada a ir de nuevo a orders-service. */
    invalidar() {
        this._cache = null;
    }

    async _descargar() {
        const controlador = new AbortController();
        const temporizador = setTimeout(() => controlador.abort(), this.timeoutMs);
        try {
            const res = await this.fetchImpl(`${this.baseUrl}/productos`, { signal: controlador.signal });
            if (!res || res.ok === false) {
                throw new Error(`orders-service respondió ${res ? res.status : 'sin respuesta'}`);
            }
            const data = await res.json();
            if (!Array.isArray(data)) {
                throw new Error('orders-service devolvió un catálogo inválido');
            }
            return data.filter(p => p && p.disponible !== false);
        } finally {
            clearTimeout(temporizador);
        }
    }
}

function crearCatalogo(opciones) {
    return new CatalogoRemoto(opciones);
}

module.exports = { URL_POR_DEFECTO, CatalogoRemoto, crearCatalogo };
