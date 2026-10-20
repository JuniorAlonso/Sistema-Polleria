const { ColaEnvios } = require('./queue');
const { normalizarTelefono } = require('./phone');
const { crearAjustes } = require('../outbound/ajustes');
const { duracionEscribiendo } = require('../outbound/humanizacion');

/**
 * Orquesta el envío: registra el log como EN_COLA, lo encola
 * y actualiza su estado final (ENVIADO / ERROR) cuando la cola lo procesa.
 *
 * Una sola cola para TODO lo saliente (S2): las notificaciones de pedido y las
 * respuestas del chatbot comparten `this.cola`, así que nunca salen dos mensajes a la
 * vez ni sin espaciado. El chatbot ya no envía por su cuenta.
 *
 * `whatsapp` debe exponer: esperarListo(), obtenerChatId(numero), enviar(chatId, mensaje)
 * y, para la humanización, marcarVisto(chatId) y escribiendo(chatId, duracionMs).
 */
class NotificacionService {
    constructor({ store, whatsapp, intervaloMs, maxIntentos, ajustes, gobernador, jitterPct, azar, dormir, ahora }) {
        this.store = store;
        this.whatsapp = whatsapp;
        this.maxIntentos = maxIntentos;
        // Los ajustes viven en memoria (S8) y se leen en cada envío: editarlos en caliente
        // no exige reconstruir la cola.
        this.ajustes = ajustes || crearAjustes({ intervaloMs, jitterPct });
        // El gobernador (T4b) es opcional: cuando no viene, la cola no aplica límites ni
        // circuit breaker. main.js siempre lo inyecta; los tests de cola/humanización no.
        this.gobernador = gobernador || null;
        this.cola = new ColaEnvios({
            intervaloMs: () => this.ajustes.obtener().intervaloMs,
            jitterPct: () => this.ajustes.obtener().jitterPct,
            procesar: trabajo => this._procesar(trabajo),
            azar,
            dormir,
            ahora,
            gobernador: this.gobernador
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

        this.cola.add({ logId: log.id, numero, mensaje, intentos: 0, marcarVisto: false });
        return log;
    }

    /**
     * Respuesta del chatbot: entra a la MISMA cola que las notificaciones (S2). No se
     * registra en el historial RF32 porque no es una notificación de pedido y el chat ya
     * existe, así que se usa el `chatId` recibido y no se normaliza ningún teléfono.
     */
    encolarRespuesta({ chatId, mensaje, marcarVisto = true }) {
        this.cola.add({ logId: null, numero: chatId, chatId, mensaje, intentos: 0, marcarVisto });
        return this.cola.pendientes;
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
                intentos: log.intentos,
                marcarVisto: false
            });
        }
        return pendientes.filter(log => log.tipo !== 'CODIGO_SEGUIMIENTO').length;
    }

    get pendientes() {
        return this.cola.pendientes;
    }

    get colaEnProceso() {
        return this.cola.procesandoAhora;
    }

    get ultimoEnvioEn() {
        return this.cola.ultimoEnvioEn;
    }

    // Estado anti-baneo para GET /status; null si no hay gobernador inyectado.
    estadoAntiBaneo() {
        return this.gobernador ? this.gobernador.estado() : null;
    }

    // Best-effort: si marcar visto o el "escribiendo" fallan, el mensaje igual sale.
    async _humanizar(chatId, mensaje, marcarVisto) {
        if (marcarVisto && typeof this.whatsapp.marcarVisto === 'function') {
            await this.whatsapp.marcarVisto(chatId);
        }
        if (typeof this.whatsapp.escribiendo === 'function') {
            await this.whatsapp.escribiendo(chatId, duracionEscribiendo(mensaje, this.ajustes.obtener()));
        }
    }

    async _marcar(logId, cambios) {
        if (logId) return this.store.update(logId, cambios);
    }

    async _procesar(trabajo) {
        const { logId, numero, mensaje, chatId: chatIdDirecto, marcarVisto } = trabajo;
        const intento = (trabajo.intentos || 0) + 1;

        try {
            await this.whatsapp.esperarListo();
            const chatId = chatIdDirecto || await this.whatsapp.obtenerChatId(numero);
            if (!chatId) {
                await this._marcar(logId, {
                    estado: 'ERROR',
                    intentos: intento,
                    errorDetalle: 'El número no está registrado en WhatsApp'
                });
                // El canal respondió: si el breaker estaba en prueba, se cierra.
                if (this.gobernador) this.gobernador.registrarCanalVivo();
                console.warn(`⚠️ ${logId || numero}: ${numero} no tiene WhatsApp`);
                return;
            }

            // Humanización antes del envío: marcar visto y "escribiendo" proporcional al texto.
            await this._humanizar(chatId, mensaje, marcarVisto);

            await this.whatsapp.enviar(chatId, mensaje);
            await this._marcar(logId, {
                estado: 'ENVIADO',
                intentos: intento,
                errorDetalle: null,
                enviadoEn: new Date()
            });
            // Cuenta el presupuesto por hora/día y cierra el breaker.
            if (this.gobernador) this.gobernador.registrarExito();
            console.log(`✅ ${logId || chatId} enviado a ${numero || chatId}`);
        } catch (error) {
            // Señal de rate-overlimit/bloqueo: el gobernador abre el breaker y pausa la cola.
            // El trabajo se reencola tal cual (sin consumir maxIntentos) para no perderlo.
            const bloqueo = this.gobernador ? this.gobernador.registrarFallo(error) : false;
            if (bloqueo) {
                await this._marcar(logId, { intentos: intento, errorDetalle: error.message });
                this.cola.add({ ...trabajo, intentos: intento });
                console.warn(`🚧 ${logId || numero} pausado por posible bloqueo de WhatsApp, se reintentará: ${error.message}`);
                return;
            }

            if (intento < this.maxIntentos) {
                await this._marcar(logId, { intentos: intento, errorDetalle: error.message });
                this.cola.add({ ...trabajo, intentos: intento });
                console.warn(`🔁 ${logId || numero} falló (intento ${intento}), se reintentará: ${error.message}`);
            } else {
                await this._marcar(logId, {
                    estado: 'ERROR',
                    intentos: intento,
                    errorDetalle: error.message
                });
                console.error(`❌ ${logId || numero} falló definitivamente: ${error.message}`);
            }
        }
    }
}

module.exports = { NotificacionService };
