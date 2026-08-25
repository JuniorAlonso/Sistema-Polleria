const express = require('express');
const client = require('./src/whatsapp/client');
const handleMessage = require('./src/whatsapp/handler');

const app = express();
app.use(express.json());

function buildMessage(orderId, estado, nombreCliente) {
    const nombre = nombreCliente || 'Cliente';
    const mensajes = {
        'RECIBIDO':       `✅ Hola *${nombre}*, tu pedido *#${orderId}* fue recibido y está en cola. 🍗`,
        'EN_PREPARACION': `👨‍🍳 Tu pedido *#${orderId}* está siendo preparado. ¡Ya casi!`,
        'LISTO':          `🔔 Tu pedido *#${orderId}* está *listo*. ¡Lo estamos empacando!`,
        'EN_CAMINO':      `🛵 Tu pedido *#${orderId}* va *en camino*. El repartidor está cerca.`,
        'ENTREGADO':      `🎉 Pedido *#${orderId}* entregado. ¡Buen provecho! Gracias por *San Pollo de Ica* 🐔`,
        'CANCELADO':      `❌ Tu pedido *#${orderId}* fue cancelado. Contáctanos si tienes dudas.`
    };
    return mensajes[estado] || `Tu pedido #${orderId} cambió a: ${estado}`;
}

// POST /notificar — llamado por orders-service al cambiar estado
app.post('/notificar', async (req, res) => {
    const { telefono, orderId, estado, nombreCliente } = req.body;

    if (!telefono || !orderId || !estado) {
        return res.status(400).json({ error: 'Faltan campos: telefono, orderId, estado' });
    }

    let numero = String(telefono).replace(/\D/g, '');
    if (numero.startsWith('0')) numero = numero.slice(1);
    if (!numero.startsWith('51')) numero = '51' + numero;
    const chatId = `${numero}@c.us`;

    const mensaje = buildMessage(orderId, estado, nombreCliente);

    try {
        await client.sendMessage(chatId, mensaje);
        console.log(`✅ WhatsApp → ${chatId}: [${estado}] #${orderId}`);
        res.json({ ok: true, chatId, mensaje });
    } catch (err) {
        console.error(`❌ Error → ${chatId}:`, err.message);
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.get('/status', (req, res) => {
    res.json({ status: 'ok', whatsapp: client.info ? 'connected' : 'waiting_qr' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Notification service en puerto ${PORT}`));

client.on('message', handleMessage);
client.initialize();