console.log('🔥 HANDLER.JS CARGADO');

const { getConversation } = require('./../chatbot/conversation');
const { processMessage } = require('./../chatbot/chatbot');

/**
 * Punto de entrada de cada mensaje entrante.
 *
 * El chatbot ya no envía por su cuenta: devuelve el texto y el handler lo encola en la
 * MISMA cola saliente que usan las notificaciones (S2). Así un pedido de 6-10 mensajes
 * sale espaciado y humanizado en vez de en una ráfaga.
 *
 * @param msg     mensaje entrante de whatsapp-web.js
 * @param service NotificacionService (dueño de la única cola de salida)
 */
async function handleMessage(msg, { service }) {

    // Ignorar estados de WhatsApp y grupos
    if (
        msg.from === 'status@broadcast' ||
        msg.from.endsWith('@g.us')
    ) {
        return;
    }

    const texto = (msg.body || msg.caption || '').toLowerCase().trim();

    const userId = msg.from;

    const conversation = getConversation(userId);

    console.log(` Mensaje recibido de ${msg.from}: "${texto}"`);
    console.log(` Estado actual: ${conversation.state}`);

    try {

        const respuesta = await processMessage(
            msg,
            userId,
            conversation
        );

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
