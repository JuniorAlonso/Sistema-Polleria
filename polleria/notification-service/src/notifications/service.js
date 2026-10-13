const { ColaEnvios } = require('./queue');
const { normalizarTelefono } = require('./phone');

/**
 * Orquesta el envío: registra el log como EN_COLA, lo encola
 * y actualiza su estado final (ENVIADO / ERROR) cuando la cola lo procesa.
 *
 * `whatsapp` debe exponer: esperarListo(), obtenerChatId(numero), enviar(chatId, mensaje)
 */
class NotificacionService {
    constructor({ store, whatsapp, intervaloMs, maxIntentos }) {
        this.store = store;
        this.whatsapp = whatsapp;
        this.maxIntentos = maxIntentos;
        this.cola = new ColaEnvios({
            intervaloMs,
            procesar: trabajo => this._procesar(trabajo)
        });
    }

    /**
     * @param mensaje          texto que se envía por WhatsApp
     * @param mensajeRegistro  texto que se guarda en el historial (p. ej. con el código oculto); por defecto, el mismo
     */
    async encolar({ ordenId, telefono, tipo, mensaje, mensajeRegistro }) {
        const numero = normalizarTelefono(telefono);

        const log = await this.store.create({
            ordenId,
            destinatario: numero || String(telefono),
            tipo,
            mensaje: mensajeRegistro || mensaje
        });

        // Un número mal formado no entra a la cola: se registra como ERROR y no bloquea a nadie
        if (!numero) {
            return this.store.update(log.id, {
                estado: 'ERROR',
                errorDetalle: `Teléfono con formato inválido: ${telefono}`
            });
        }

        this.cola.add({ logId: log.id, numero, mensaje, intentos: 0 });
        return log;
    }

    // Al reiniciar el servicio, vuelve a encolar lo que quedó pendiente
    async recuperarPendientes() {
        const pendientes = await this.store.findPendientes();
        for (const log of pendientes) {
            // El historial no guarda el código real y, además, ya habrá vencido
            if (log.tipo === 'CODIGO_SEGUIMIENTO') {
                await this.store.update(log.id, {
                    estado: 'ERROR',
                    errorDetalle: 'Código descartado: el servicio se reinició antes de enviarlo'
                });
                continue;
            }
            this.cola.add({
                logId: log.id,
                numero: log.destinatario,
                mensaje: log.mensaje,
                intentos: log.intentos
            });
        }
        return pendientes.filter(log => log.tipo !== 'CODIGO_SEGUIMIENTO').length;
    }

    get pendientes() {
        return this.cola.pendientes;
    }

    async _procesar({ logId, numero, mensaje, intentos }) {
        const intento = intentos + 1;

        try {
            await this.whatsapp.esperarListo();
            const chatId = await this.whatsapp.obtenerChatId(numero);
            if (!chatId) {
                await this.store.update(logId, {
                    estado: 'ERROR',
                    intentos: intento,
                    errorDetalle: 'El número no está registrado en WhatsApp'
                });
                console.warn(`⚠️ ${logId}: ${numero} no tiene WhatsApp`);
                return;
            }

            await this.whatsapp.enviar(chatId, mensaje);
            await this.store.update(logId, {
                estado: 'ENVIADO',
                intentos: intento,
                errorDetalle: null,
                enviadoEn: new Date()
            });
            console.log(`✅ ${logId} enviado a ${numero}`);
        } catch (error) {
            if (intento < this.maxIntentos) {
                await this.store.update(logId, { intentos: intento, errorDetalle: error.message });
                this.cola.add({ logId, numero, mensaje, intentos: intento });
                console.warn(`🔁 ${logId} falló (intento ${intento}), se reintentará: ${error.message}`);
            } else {
                await this.store.update(logId, {
                    estado: 'ERROR',
                    intentos: intento,
                    errorDetalle: error.message
                });
                console.error(`❌ ${logId} falló definitivamente: ${error.message}`);
            }
        }
    }
}

module.exports = { NotificacionService };
