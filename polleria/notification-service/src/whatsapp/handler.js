console.log('🔥 HANDLER.JS CARGADO');

const { claveDeUsuario } = require('../chatbot/chatbot');
const { SerializadorConversaciones } = require('../chatbot/serializador');

/**
 * Punto de entrada de cada mensaje entrante.
 *
 * El bot ya no envía por su cuenta: devuelve el texto y el handler lo encola en la
 * MISMA cola saliente que usan las notificaciones (S2). Ese contrato se conserva; lo
 * que cambia en T3a es que el bot resuelve el estado persistido, el dedup por
 * `message.id` y el catálogo real de orders-service (se inyecta desde `main.js`).
 *
 * Desde T3c (S10/S14) los mensajes de una misma conversación se **serializan** por clave
 * (el celular normalizado): se procesan uno por uno y en orden de llegada, así que dos
 * «confirmar» casi simultáneos con `message.id` distintos no pueden abrir dos pedidos.
 * La serialización es por clave, no global: una conversación lenta no frena a otro
 * cliente. El contrato de salida no cambia: el bot devuelve el texto y el handler lo
 * encola en la única cola (T4).
 *
 * @param msg     mensaje entrante de whatsapp-web.js
 * @param service NotificacionService (dueño de la única cola de salida)
 * @param bot     BotPedidos (motor conversacional con estado persistido)
 * @param serializador  SerializadorConversaciones (por defecto, el del proceso)
 */

// Una instancia por proceso: `main.js` construye el bot una sola vez y el handler se
// invoca por cada evento. Los tests inyectan la suya para no compartir estado.
const serializadorCompartido = new SerializadorConversaciones();

async function handleMessage(msg, { service, bot, serializador = serializadorCompartido } = {}) {

    // Ignorar estados de WhatsApp y grupos
    if (
        msg.from === 'status@broadcast' ||
        msg.from.endsWith('@g.us')
    ) {
        return;
    }

    // Misma clave (celular normalizado) → misma cadena: el mensaje que llega mientras
    // el anterior se procesa espera su turno y ve el estado que dejó ese anterior.
    const clave = claveDeUsuario(msg.from);

    return serializador.ejecutar(clave, async () => {

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

    });
}

module.exports = handleMessage;
