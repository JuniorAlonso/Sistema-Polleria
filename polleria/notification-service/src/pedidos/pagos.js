/**
 * Cliente interno de payments-service para registrar la evidencia de un pago por Yape
 * hecho por WhatsApp (T6b, S6).
 *
 * Llama a `POST /pagos/comprobante` (T6a) con la cabecera `X-Internal-Key`: payments-service
 * autentica esa ruta con una cadena de seguridad propia de autoridad `INTERNAL`, así que el
 * notification-service puede registrar el comprobante sin poder leer todos los pagos ni
 * reembolsar. El cuerpo lleva `ordenId` y la clave del objeto en el bucket; el servicio solo
 * guarda esa referencia y deja el pago en `PENDIENTE_VERIFICACION`.
 *
 * Si el servicio falla o no responde, `registrarComprobante()` lanza y el bot avisa en vez
 * de inventar un éxito. El `fetchImpl` y el timeout son inyectables para los tests.
 */

const { crearLogger } = require('../logger');
const logger = crearLogger('PagosClient');
const { errorDeRespuesta } = require('./errorHttp');

const URL_POR_DEFECTO = 'http://localhost:8083';

class ClientePagos {
    constructor({ baseUrl = URL_POR_DEFECTO, internalKey = null, timeoutMs = 5000, fetchImpl } = {}) {
        this.baseUrl = String(baseUrl || URL_POR_DEFECTO).replace(/\/+$/, '');
        this.internalKey = internalKey;
        this.timeoutMs = timeoutMs;
        this.fetchImpl = fetchImpl || globalThis.fetch;
    }

    /** Registra el comprobante y devuelve la respuesta del servicio. Lanza si falla. */
    async registrarComprobante({ ordenId, telefono, monto, comprobanteClave } = {}) {
        const cuerpo = { ordenId, comprobanteClave };
        if (telefono) cuerpo.telefono = telefono;
        if (monto !== undefined && monto !== null) cuerpo.monto = monto;

        const headers = { 'Content-Type': 'application/json' };
        if (this.internalKey) {
            headers['X-Internal-Key'] = this.internalKey;
        } else {
            logger.warn(`Llamada a ${this.baseUrl}/pagos/comprobante sin X-Internal-Key (puede responder 401 si el microservicio lo exige)`);
        }

        logger.info(`Enviando comprobante a payments-service: ${this.baseUrl}/pagos/comprobante | orden #${ordenId} | monto: ${monto} | clave: "${comprobanteClave}"`);

        const controlador = new AbortController();
        const temporizador = setTimeout(() => controlador.abort(), this.timeoutMs);
        try {
            const res = await this.fetchImpl(`${this.baseUrl}/pagos/comprobante`, {
                method: 'POST',
                headers,
                body: JSON.stringify(cuerpo),
                signal: controlador.signal
            });

            if (!res || res.ok === false) {
                // Status and backend message travel with the error: a 409 "ya no está activo"
                // means the order was cancelled or finished, not that the upload failed.
                const error = await errorDeRespuesta('payments-service', res);
                logger.error(`payments-service respondió status HTTP ${error.status === null ? 'sin respuesta' : error.status}: ${error.detalle || 'sin cuerpo de error'}`);
                throw error;
            }

            logger.success(`Comprobante registrado exitosamente en payments-service para orden #${ordenId} (HTTP ${res.status})`);
            if (typeof res.json === 'function') {
                return await res.json();
            }
            return null;
        } catch (error) {
            if (error.name === 'AbortError') {
                logger.error(`Timeout (${this.timeoutMs}ms) esperando respuesta de payments-service en ${this.baseUrl}/pagos/comprobante`);
            }
            throw error;
        } finally {
            clearTimeout(temporizador);
        }
    }
}

function crearClientePagos(opciones) {
    return new ClientePagos(opciones);
}

module.exports = { URL_POR_DEFECTO, ClientePagos, crearClientePagos };
