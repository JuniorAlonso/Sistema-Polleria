console.log('🔥 HANDLER.JS CARGADO');

/**
 * Punto de entrada de cada mensaje entrante.
 *
 * El bot ya no envía por su cuenta: devuelve el texto y el handler lo encola en la
 * MISMA cola saliente que usan las notificaciones (S2). Ese contrato se conserva; lo
 * que cambia en T3a es que el bot resuelve el estado persistido, el dedup por
 * `message.id` y el catálogo real de orders-service (se inyecta desde `main.js`).
 *
 * @param msg     mensaje entrante de whatsapp-web.js
 * @param service NotificacionService (dueño de la única cola de salida)
 * @param bot     BotPedidos (motor conversacional con estado persistido)
 */
async function handleMessage(msg, { service, bot }) {

    // Ignorar estados de WhatsApp y grupos
    if (
        msg.from === 'status@broadcast' ||
        msg.from.endsWith('@g.us')
    ) {
        return;
    }

    try {

        const respuesta = await bot.procesar(msg);

        if (!respuesta) {
            return;
        }

        // Único camino de salida: la cola compartida. Marcar visto porque es una
        // conversación entrante real.
        await service.encolarRespuesta({
            chatId: msg.from,
            mensaje: respuesta,
            marcarVisto: true
        });

    } catch (error) {

        console.error('❌ Error en chatbot:', error.message);

    }
}

module.exports = handleMessage;
