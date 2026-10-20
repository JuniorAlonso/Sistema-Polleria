const { getMainMenu } = require('./menu');

const {
    setState,
    clearConversation
} = require('./conversation');


/**
 * Resuelve la respuesta del bot y la DEVUELVE como texto; ya no envía por su cuenta
 * (S2). Quien la envía es el handler, encolándola en la misma cola que las
 * notificaciones, para que nada salga por un segundo camino.
 *
 * Devuelve el texto a enviar, o null si el mensaje no amerita respuesta.
 */
async function processMessage(msg, userId, conversation) {

    const texto = (msg.body || msg.caption || '').toLowerCase().trim();

    console.log(` Procesando conversación de: ${userId}`);
    console.log(` Estado en chatbot: ${conversation.state}`);


    // ==========================================
    // 1. ESTADO: ESPERANDO CÓDIGO DE PEDIDO
    // ==========================================

    if (conversation.state === 'ESPERANDO_CODIGO_PEDIDO') {

        const codigoPedido = (msg.body || msg.caption || '').trim();

        clearConversation(userId);

        return (
            ` Recibí tu código de pedido: *${codigoPedido}*`
        );
    }


    // ==========================================
    // 2. SALUDO / MENÚ
    // ==========================================

    if (
        [
            'hola',
            'holi',
            'buenas',
            'menu',
            'menú',
            'opciones'
        ].includes(texto)
    ) {

        console.log('🚀 Menú listo para encolar');

        return getMainMenu();
    }


    // ==========================================
    // 3. OPCIONES DEL MENÚ
    // ==========================================

    switch (texto) {

        case '1':

            return (
                '*NUESTRA CARTA*\n\n' +
                '• 1/4 de Pollo + Papas + Ensalada: *S/ 18.00*\n' +
                '• 1/2 Pollo + Papas + Ensalada: *S/ 34.00*\n' +
                '• 1 Pollo Entero + Papas + Ensalada + Gaseosa 1.5L: *S/ 65.00*'
            );


        case '2':

            setState(userId, 'ESPERANDO_CODIGO_PEDIDO');

            return (
                'Para consultar tu pedido, por favor envíanos tu *Código de Pedido* 🔎 (Ejemplo: #102).'
            );


        case '3':

            return (
                '📍 *UBICACIÓN Y HORARIOS*\n\n' +
                '• Dirección: Av. Principal 123, Lima\n' +
                '• Atención: Lunes a Domingo de 12:00 PM a 10:30 PM'
            );


        case '4':

            return (
                '👤 Un asesor de nuestro equipo te atenderá en unos momentos. Por favor, déjanos tu consulta.'
            );


        default:

            return null;
    }
}


module.exports = {
    processMessage
};
