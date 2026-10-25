console.log('🔥 HANDLER.JS CARGADO');

const { claveDeUsuario } = require('../chatbot/chatbot');
const { SerializadorConversaciones } = require('../chatbot/serializador');
const { normalizarTelefono } = require('../notifications/phone');
const { crearLogger } = require('../logger');
const logger = crearLogger('Handler');

/**
 * Resuelve el celular real cuando WhatsApp Web envía el mensaje desde un JID `@lid`
 * (Linked ID de privacidad de Meta). Si no se puede resolver, devuelve null y el bot
 * sigue usando `msg.from`.
 */
async function resolverTelefonoDeMensaje(msg) {
    if (!msg || !msg.from) return null;
    const directo = normalizarTelefono(msg.from);
    if (directo) return directo;

    if (!String(msg.from).endsWith('@lid')) return null;

    logger.info(`Resolviendo celular real para contacto con Linked ID (LID): ${msg.from}...`);
    try {
        if (typeof msg.getContact === 'function') {
            const contacto = await msg.getContact();
            const delContacto = normalizarTelefono(contacto && (contacto.number || (contacto.id && contacto.id.user)));
            if (delContacto) {
                logger.success(`LID ${msg.from} resuelto a celular mediante contacto: ${delContacto}`);
                return delContacto;
            }
        }
        if (msg.client && typeof msg.client.getContactLidAndPhone === 'function') {
            const Info = await msg.client.getContactLidAndPhone([msg.from]);
            const entrada = Array.isArray(Info) ? Info[0] : null;
            const delCliente = normalizarTelefono(entrada && entrada.pn);
            if (delCliente) {
                logger.success(`LID ${msg.from} resuelto a celular mediante getContactLidAndPhone: ${delCliente}`);
                return delCliente;
            }
        }
    } catch (error) {
        console.warn(`⚠️ No se pudo resolver el teléfono para ${msg.from}: ${error.message}`);
    }
    logger.warn(`No se pudo resolver el celular para LID ${msg.from}, se continuará con el JID original.`);
    return null;
}

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

    // Ignorar estados de WhatsApp, grupos y canales/newsletters
    if (
        !msg ||
        !msg.from ||
        msg.from === 'status@broadcast' ||
        msg.from.endsWith('@g.us') ||
        msg.from.endsWith('@newsletter') ||
        msg.from.endsWith('@broadcast')
    ) {
        if (msg && msg.from) {
            logger.debug(`Mensaje ignorado de ${msg.from} (es estado, grupo o canal/newsletter)`);
        }
        return;
    }

    const idMsg = (msg && (msg.id ? (msg.id._serialized || msg.id.id || msg.id) : null)) || 'sin-id';
    logger.info(`Mensaje entrante [id: ${idMsg}] de ${msg.from} (tipo: "${msg.type || 'texto'}", hasMedia: ${Boolean(msg.hasMedia)})`);

    const telefonoResuelto = await resolverTelefonoDeMensaje(msg);
    if (telefonoResuelto) {
        msg.telefonoCliente = telefonoResuelto;
    }

    // Misma clave (celular normalizado) → misma cadena: el mensaje que llega mientras
    // el anterior se procesa espera su turno y ve el estado que dejó ese anterior.
    const clave = claveDeUsuario(telefonoResuelto || msg.from);
    logger.debug(`Conversación asignada a clave: "${clave}" (remitente: ${msg.from})`);

    return serializador.ejecutar(clave, async () => {

        try {

            const respuesta = await bot.procesar(msg);

            if (!respuesta) {
                logger.debug(`El bot no generó respuesta para mensaje [id: ${idMsg}] de clave "${clave}".`);
                return;
            }

            logger.info(`Encolando respuesta del bot para ${msg.from} (longitud: ${respuesta.length} chars)`);

            // Único camino de salida: la cola compartida. Marcar visto porque es una
            // conversación entrante real.
            await service.encolarRespuesta({
                chatId: msg.from,
                mensaje: respuesta,
                marcarVisto: true
            });

        } catch (error) {

            console.error('❌ Error en chatbot:', error.message);
            logger.error(`Error procesando mensaje de "${clave}": ${error.stack || error.message}`);

        }

    });
}

module.exports = handleMessage;
