const { getMainMenu } = require('./menu');

const {
    setState,
    clearConversation
} = require('./conversation');


async function processMessage(msg, userId, conversation) {

    const texto = (msg.body || msg.caption || '').toLowerCase().trim();

    console.log(` Procesando conversación de: ${userId}`);
    console.log(` Estado en chatbot: ${conversation.state}`);


    // ==========================================
    // 1. ESTADO: ESPERANDO CÓDIGO DE PEDIDO
    // ==========================================

    if (conversation.state === 'ESPERANDO_CODIGO_PEDIDO') {

        const codigoPedido = (msg.body || msg.caption || '').trim();

        await msg.reply(
            ` Recibí tu código de pedido: *${codigoPedido}*`
        );

        clearConversation(userId);

        return true;
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

        const menuMensaje = getMainMenu();

        await msg.reply(menuMensaje);

        console.log('🚀 Menú enviado al cliente');

        return true;
    }


    // ==========================================
    // 3. OPCIONES DEL MENÚ
    // ==========================================

    switch (texto) {

        case '1':

            await msg.reply(
                '*NUESTRA CARTA*\n\n' +
                '• 1/4 de Pollo + Papas + Ensalada: *S/ 18.00*\n' +
                '• 1/2 Pollo + Papas + Ensalada: *S/ 34.00*\n' +
                '• 1 Pollo Entero + Papas + Ensalada + Gaseosa 1.5L: *S/ 65.00*'
            );

            return true;


        case '2':

            setState(userId, 'ESPERANDO_CODIGO_PEDIDO');

            await msg.reply(
                'Para consultar tu pedido, por favor envíanos tu *Código de Pedido* 🔎 (Ejemplo: #102).'
            );

            return true;


        case '3':

            await msg.reply(
                '📍 *UBICACIÓN Y HORARIOS*\n\n' +
                '• Dirección: Av. Principal 123, Lima\n' +
                '• Atención: Lunes a Domingo de 12:00 PM a 10:30 PM'
            );

            return true;


        case '4':

            await msg.reply(
                '👤 Un asesor de nuestro equipo te atenderá en unos momentos. Por favor, déjanos tu consulta.'
            );

            return true;


        default:

            return false;
    }
}


module.exports = {
    processMessage
};