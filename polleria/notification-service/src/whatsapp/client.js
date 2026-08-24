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

module.exports = client;