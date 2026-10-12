const express = require('express');
const client = require('./src/whatsapp/client');
const { getLatestQr } = require('./src/whatsapp/client');
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

app.get('/qr', (req, res) => {
    if (client.info) {
        return res.send('<h2 style="font-family:sans-serif;color:green">✅ WhatsApp ya está conectado. No se necesita QR.</h2>');
    }
    const qr = getLatestQr();
    if (!qr) {
        return res.send('<h2 style="font-family:sans-serif;color:orange">⏳ QR aún no generado. Recarga en 5 segundos.</h2><script>setTimeout(()=>location.reload(),5000)</script>');
    }
    const encoded = encodeURIComponent(qr);
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>QR WhatsApp</title>
<meta http-equiv="refresh" content="25">
<style>body{font-family:sans-serif;text-align:center;padding:40px;background:#f0f0f0}
h2{color:#333}img{border:8px solid white;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.15)}</style></head>
<body><h2>📱 Escanea con WhatsApp</h2>
<img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encoded}" width="300" height="300" />
<p style="color:#888;font-size:13px">Esta página se actualiza automáticamente cada 25 segundos.<br>
Abrí WhatsApp → Dispositivos vinculados → Vincular dispositivo → escanea este QR.</p>
</body></html>`);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Notification service en puerto ${PORT}`));

client.on('message', handleMessage);

// En Windows, LocalAuth lanza EBUSY al intentar borrar archivos de sesión
// bloqueados por Chrome. Capturamos el error para que el proceso no muera.
process.on('unhandledRejection', (reason) => {
    if (reason && reason.message && reason.message.includes('EBUSY')) {
        console.warn('⚠️  Sesión WhatsApp bloqueada (EBUSY). Reiniciando cliente...');
        setTimeout(() => client.initialize(), 3000);
        return;
    }
    console.error('Unhandled rejection:', reason);
});

client.initialize();