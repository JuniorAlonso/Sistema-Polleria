const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    }
});

client.on('qr', qr => {
    console.log('--- ESCANEA EL CÓDIGO QR ---');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ ¡El servicio de WhatsApp de la Pollería está LISTO!');
});

client.on('message', async msg => {
    // Ignorar estados de WhatsApp y grupos
    if (msg.from === 'status@broadcast' || msg.from.endsWith('@g.us')) return;

    const texto = (msg.body || msg.caption || '').toLowerCase().trim();
    console.log(`📩 Mensaje recibido de ${msg.from}: "${texto}"`);

    // Detectamos si es un saludo
    try {
        // 1. Si el cliente saluda o pide el menú
        if (['hola', 'holi', 'buenas', 'menu', 'menú', 'opciones'].includes(texto)) {
            const menuMensaje = 
                '🍗 *¡Bienvenido a San Pollo!* 🍗\n\n' +
                'Por favor, responde enviando solo el número de la opción que deseas:\n\n' +
                '1️.- Ver Carta / Precios\n' +
                '2️.- Consultar estado de mi Pedido\n' +
                '3️.- Horarios de Atención y Ubicación\n' +
                '4️.- Hablar con un Asesor\n\n' +
                '_Escribe un número del 1 al 4_';

            await msg.reply(menuMensaje);
            console.log('🚀 Menú enviado al cliente');
            return;
        }

        // 2. Evaluamos la opción que eligió el cliente
        switch (texto) {
            case '1':
                await msg.reply(
                    '*NUESTRA CARTA*\n\n' +
                    '• 1/4 de Pollo + Papas + Ensalada: *S/ 18.00*\n' +
                    '• 1/2 Pollo + Papas + Ensalada: *S/ 34.00*\n' +
                    '• 1 Pollo Entero + Papas + Ensalada + Gaseosa 1.5L: *S/ 65.00*'
                );
                break;

            case '2':
                await msg.reply('Para consultar tu pedido, por favor envíanos tu *Código de Pedido* 🔎(Ejemplo: #102).');
                break;

            case '3':
                await msg.reply(
                    '📍 *UBICACIÓN Y HORARIOS*\n\n' +
                    '• Dirección: Av. Principal 123, Lima\n' +
                    '• Atención: Lunes a Domingo de 12:00 PM a 10:30 PM'
                );
                break;

            case '4':
                await msg.reply('👤 Un asesor de nuestro equipo te atenderá en unos momentos. Por favor, déjanos tu consulta.');
                break;

            default:
                // Opcional: Si escriben algo que no es del menú y no es un saludo, puedes ignorarlo o guiarlo.
                break;
        }

    } catch (error) {
        console.error('❌ Error en el menú:', error.message);
    }
});

client.initialize();