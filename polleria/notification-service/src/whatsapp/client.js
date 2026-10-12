const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const config = require('../config');

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: config.sessionPath }),
    puppeteer: {
        headless: true,
        executablePath: config.chromePath,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    }
});

let estado = 'INICIANDO';
let ultimoQr = null;
let marcarListo;
let listo = new Promise(resolve => { marcarListo = resolve; });

client.on('qr', qr => {
    estado = 'ESPERANDO_QR';
    ultimoQr = qr;
    console.log('--- ESCANEA EL CÓDIGO QR ---');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    estado = 'CONECTADO';
    ultimoQr = null;
    marcarListo();
    console.log('✅ ¡El servicio de WhatsApp de la Pollería está LISTO!');
});

client.on('loading_screen', (porcentaje, mensaje) => {
    console.log(`⏳ Cargando WhatsApp Web: ${porcentaje}% ${mensaje || ''}`);
});

client.on('authenticated', () => {
    console.log('🔐 Sesión de WhatsApp autenticada, esperando que termine de cargar...');
});

client.on('change_state', nuevoEstado => {
    console.log('🔄 Estado de WhatsApp:', nuevoEstado);
});

// Si en 2 minutos no está listo ni pidió QR, avisar en consola (los mensajes quedan en cola)
setTimeout(() => {
    if (estado === 'INICIANDO') {
        console.warn('⚠️ WhatsApp lleva 2 minutos iniciando sin conectarse. Reinicia el servicio; ' +
            'si se repite, borra la carpeta de sesión y vuelve a escanear el QR.');
    }
}, 120000).unref();

client.on('auth_failure', msg => {
    estado = 'ERROR_AUTENTICACION';
    console.error('❌ Falló la autenticación de WhatsApp:', msg);
});

client.on('disconnected', razon => {
    // Los envíos esperarán hasta que vuelva a estar listo
    listo = new Promise(resolve => { marcarListo = resolve; });

    if (razon === 'LOGOUT') {
        // Cerraron la sesión desde el celular: whatsapp-web.js borra la sesión
        // y genera un QR nuevo por su cuenta, no hay que reiniciar nada.
        estado = 'ESPERANDO_QR';
        console.warn('⚠️ La sesión de WhatsApp se cerró. Escanea el nuevo QR para volver a conectar.');
        return;
    }

    // En otros casos la librería cierra el navegador: se vuelve a iniciar tras unos segundos
    estado = 'DESCONECTADO';
    console.warn('⚠️ WhatsApp desconectado:', razon, '— reconectando en 5s...');
    setTimeout(() => {
        client.initialize()
            .catch(error => console.error('❌ No se pudo reconectar WhatsApp:', error.message));
    }, 5000);
});

/**
 * Empieza de cero con una sesión nueva (QR nuevo).
 * Se usa cuando la sesión guardada quedó inválida y Windows no deja borrarla (EBUSY)
 * porque Chrome sigue abierto: primero se cierra Chrome, luego se borra la carpeta y se reinicia.
 */
let reiniciando = false;
async function reiniciarSesion() {
    if (reiniciando) return;
    reiniciando = true;
    estado = 'INICIANDO';
    try {
        await client.destroy().catch(() => {});
        await fs.promises.rm(path.join(config.sessionPath, 'session'), {
            recursive: true, force: true, maxRetries: 5, retryDelay: 1000
        });
        console.log('🧹 Sesión anterior borrada. Generando un QR nuevo...');
        await client.initialize();
    } catch (error) {
        console.error('❌ No se pudo reiniciar WhatsApp:', error.message,
            '— detén el servicio, borra la carpeta de sesión y vuelve a iniciarlo.');
    } finally {
        reiniciando = false;
    }
}

// Adaptador que usa el NotificacionService
const whatsapp = {
    esperarListo: () => listo,

    async obtenerChatId(numero) {
        const numberId = await client.getNumberId(numero);
        return numberId ? numberId._serialized : null;
    },

    enviar: (chatId, mensaje) => client.sendMessage(chatId, mensaje),

    estado: () => estado,

    // Último QR generado (para la página /qr); null si ya está conectado
    ultimoQr: () => ultimoQr
};

module.exports = { client, whatsapp, reiniciarSesion };
