/**
 * Cliente del alta de pedidos de orders-service (T3b, S1/S4).
 *
 * El bot crea el DELIVERY anónimo con `POST /ordenes` (ruta pública: el checkout web la
 * usa igual). El bot NO calcula el envío: el `total` que devuelve orders-service ya lo
 * sumó `Orden.recalcularTotal()` (S12), así que el mensaje de confirmación lo reutiliza
 * tal cual. Si el servicio falla o no responde, `crear()` lanza y el bot lo dice SIN
 * inventar un número de pedido, conservando el carrito para reintentar.
 *
 * `fetchImpl` y `timeoutMs` son inyectables para que los tests sean deterministas y no
 * toquen la red real.
 */

const URL_POR_DEFECTO = 'http://localhost:8082';

class ClienteOrdenes {
    constructor({ baseUrl = URL_POR_DEFECTO, timeoutMs = 5000, internalKey, fetchImpl } = {}) {
        this.baseUrl = String(baseUrl || URL_POR_DEFECTO).replace(/\/+$/, '');
        this.timeoutMs = timeoutMs;
        this.internalKey = internalKey || null;
        this.fetchImpl = fetchImpl || globalThis.fetch;
    }

    /** Crea la orden y devuelve la respuesta de orders-service. Lanza si falla. */
    async crear(datos) {
        const controlador = new AbortController();
        const temporizador = setTimeout(() => controlador.abort(), this.timeoutMs);
        try {
            const res = await this.fetchImpl(`${this.baseUrl}/ordenes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datos),
                signal: controlador.signal
            });
            if (!res || res.ok === false) {
                throw new Error(`orders-service respondió ${res ? res.status : 'sin respuesta'}`);
            }
            const orden = await res.json();
            if (!orden || typeof orden !== 'object') {
                throw new Error('orders-service devolvió una orden inválida');
            }
            return orden;
        } finally {
            clearTimeout(temporizador);
        }
    }

    /** Consulta la orden por ID usando X-Internal-Key. Devuelve null si no existe (404). */
    async obtener(id) {
        const idLimpio = String(id || '').replace(/\D/g, '');
        if (!idLimpio) return null;
        const controlador = new AbortController();
        const temporizador = setTimeout(() => controlador.abort(), this.timeoutMs);
        try {
            const headers = { 'Content-Type': 'application/json' };
            if (this.internalKey) {
                headers['X-Internal-Key'] = this.internalKey;
            }
            const res = await this.fetchImpl(`${this.baseUrl}/ordenes/${idLimpio}`, {
                method: 'GET',
                headers,
                signal: controlador.signal
            });
            if (res && res.status === 404) return null;
            if (!res || res.ok === false) {
                throw new Error(`orders-service respondió ${res ? res.status : 'sin respuesta'}`);
            }
            const orden = await res.json();
            return orden && typeof orden === 'object' ? orden : null;
        } finally {
            clearTimeout(temporizador);
        }
    }
}

function crearClienteOrdenes(opciones) {
    return new ClienteOrdenes(opciones);
}

module.exports = { URL_POR_DEFECTO, ClienteOrdenes, crearClienteOrdenes };
