console.log('🔥 HANDLER.JS CARGADO');

const { getConversation } = require('./../chatbot/conversation');
const { processMessage } = require('./../chatbot/chatbot');

async function handleMessage(msg) {

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

        const processed = await processMessage(
            msg,
            userId,
            conversation
        );

        if (processed) {
            return;
        }

    } catch (error) {

        console.error('❌ Error en chatbot:', error.message);

    }
}

module.exports = handleMessage;