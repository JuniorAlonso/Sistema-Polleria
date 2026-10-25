const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const config = require('../config');

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: config.sessionPath }),
    authTimeoutMs: 60000,
    qrMaxRetries: 0,
    puppeteer: {
        headless: true,
        executablePath: config.chromePath,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-extensions',
            '--disable-accelerated-2d-canvas',
            '--disable-session-crashed-bubble',
            '--disable-features=Translate,OptimizationHints,MediaRouter',
            '--mute-audio'
        ]
    }
});

let estado = 'INICIANDO';
let ultimoQr = null;
let ultimoQrTimestamp = null;
let ultimoError = null;

// Watchdog de arranque: si lleva más de 45s en INICIANDO sin emitir QR ni conectar,
// autorrecupera automáticamente para evitar bloqueos eternos en pantalla de carga.
let watchdogTimer = null;
function iniciarWatchdog(ms = 45000) {
    cancelarWatchdog();
    watchdogTimer = setTimeout(async () => {
        if (estado === 'INICIANDO' && !ultimoQr) {
            console.warn(`⚠️ [Watchdog] WhatsApp lleva ${ms / 1000}s en INICIANDO sin generar QR ni conectar. Autorrecuperando sesión con perfil limpio...`);
            ultimoError = 'Tiempo de espera inicial agotado. Autorrecuperando con sesión limpia...';
            await reiniciarSesion();
        }
    }, ms);
    if (watchdogTimer.unref) watchdogTimer.unref();
}

function cancelarWatchdog() {
    if (watchdogTimer) {
        clearTimeout(watchdogTimer);
        watchdogTimer = null;
    }
}

client.on('qr', qr => {
    cancelarWatchdog();
    estado = 'ESPERANDO_QR';
    ultimoQr = qr;
    ultimoQrTimestamp = Date.now();
    ultimoError = null;
    console.log('--- ESCANEA EL CÓDIGO QR ---');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    cancelarWatchdog();
    estado = 'CONECTADO';
    ultimoQr = null;
    ultimoQrTimestamp = null;
    ultimoError = null;
    console.log('✅ ¡El servicio de WhatsApp de la Pollería está LISTO!');
});

client.on('loading_screen', (porcentaje, mensaje) => {
    console.log(`⏳ Cargando WhatsApp Web: ${porcentaje}% ${mensaje || ''}`);
});

client.on('authenticated', () => {
    cancelarWatchdog();
    console.log('🔐 Sesión de WhatsApp autenticada, esperando que termine de cargar...');
});

client.on('change_state', nuevoEstado => {
    console.log('🔄 Estado de WhatsApp:', nuevoEstado);
});

client.on('auth_failure', msg => {
    cancelarWatchdog();
    estado = 'ERROR_AUTENTICACION';
    console.error('❌ Falló la autenticación de WhatsApp:', msg);
});

client.on('disconnected', async razon => {
    cancelarWatchdog();
    ultimoQr = null;
    ultimoQrTimestamp = null;

    if (razon === 'LOGOUT') {
        estado = 'ESPERANDO_QR';
        console.warn('⚠️ La sesión de WhatsApp se cerró (LOGOUT). Limpiando sesión anterior y generando un nuevo QR...');
        await reiniciarSesion();
        return;
    }

    // En otros casos la librería cierra el navegador: se vuelve a iniciar tras unos segundos
    estado = 'DESCONECTADO';
    console.warn('⚠️ WhatsApp desconectado:', razon, '— reconectando en 5s...');
    setTimeout(() => {
        arrancar();
    }, 5000);
});

/**
 * Empieza de cero con una sesión nueva (QR nuevo).
 * Se usa cuando la sesión guardada quedó inválida, tras LOGOUT o por petición del ADMIN.
 */
let reiniciando = false;
async function reiniciarSesion() {
    if (reiniciando) return;
    reiniciando = true;
    estado = 'INICIANDO';
    ultimoQr = null;
    ultimoQrTimestamp = null;
    ultimoError = null;
    iniciarWatchdog(45000);
    try {
        console.log('🧹 Cerrando navegador WhatsApp y limpiando locks...');
        await client.destroy().catch(() => {});
        await limpiarLocksHuerfanos();
        const sessionDir = path.resolve(config.sessionPath, 'session');
        await fs.promises.rm(sessionDir, {
            recursive: true, force: true, maxRetries: 5, retryDelay: 1000
        }).catch(err => {
            console.warn(`⚠️ Advertencia al limpiar carpeta de sesión: ${err.message}`);
        });
        console.log('🧹 Sesión anterior borrada. Generando un QR nuevo...');
        await arrancar();
    } catch (error) {
        console.error('❌ No se pudo reiniciar WhatsApp:', error.message,
            '— detén el servicio, borra la carpeta de sesión y vuelve a iniciarlo.');
    } finally {
        reiniciando = false;
    }
}

const ARCHIVOS_LOCK = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'DevToolsActivePort'];
const PERFIL_CHROMIUM = path.resolve(config.sessionPath, 'session');
const MAX_INTENTOS_ARRANQUE = 5;

/**
 * Limpia locks de Chromium huérfanos que impiden arrancar tras un reinicio forzado.
 */
async function limpiarLocksHuerfanos() {
    for (const nombre of ARCHIVOS_LOCK) {
        await fs.promises.rm(path.join(PERFIL_CHROMIUM, nombre), { force: true }).catch(() => {});
    }
}

/**
 * Arranca el navegador con reintentos acotados y watchdog activo.
 */
async function intentarArranque(intento) {
    iniciarWatchdog(45000);
    try {
        await client.initialize();
        ultimoError = null;
        return true;
    } catch (error) {
        const mensaje = (error && error.message) || String(error);
        ultimoError = mensaje;
        console.error(`❌ Falló el arranque del navegador de WhatsApp (intento ${intento}/${MAX_INTENTOS_ARRANQUE}): ${mensaje}`);

        if (intento >= MAX_INTENTOS_ARRANQUE) {
            cancelarWatchdog();
            estado = 'ERROR_INICIO';
            console.error('❌ WhatsApp queda sin arrancar. El motivo se expone en ' +
                'GET /api/notificaciones/status (whatsapp: error_inicio).');
            return false;
        }

        estado = 'INICIANDO';
        await client.destroy().catch(() => {});
        await limpiarLocksHuerfanos();
        await new Promise(resolve => setTimeout(resolve, 3000 * intento));
        return intentarArranque(intento + 1);
    }
}

let arranqueEnCurso = null;

/** Un solo arranque a la vez: varios eventos pueden pedir reconectar. */
function arrancar() {
    if (!arranqueEnCurso) {
        arranqueEnCurso = intentarArranque(1).finally(() => { arranqueEnCurso = null; });
    }
    return arranqueEnCurso;
}

// Evita que un `getChatById` colgado bloquee toda la cola: la humanización es
// best-effort, así que un fallo aquí no debe impedir el envío del mensaje.
async function obtenerChat(chatId, timeoutMs = 8000) {
    const chatPromise = client.getChatById(chatId);
    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout en getChatById')), timeoutMs)
    );
    return Promise.race([chatPromise, timeoutPromise]);
}

// Adaptador que usa el NotificacionService
const whatsapp = {
    esperarListo(timeoutMs = 30000) {
        if (estado === 'CONECTADO') {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            let timer;
            const onReady = () => {
                clearTimeout(timer);
                client.off('ready', onReady);
                resolve();
            };

            timer = setTimeout(() => {
                client.off('ready', onReady);
                reject(new Error(`Tiempo de espera agotado (${timeoutMs / 1000}s) esperando conexión de WhatsApp. Estado actual: ${estado}`));
            }, timeoutMs);

            client.once('ready', onReady);
        });
    },

    async obtenerChatId(numero, timeoutMs = 8000) {
        try {
            const numberPromise = client.getNumberId(numero);
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout en getNumberId')), timeoutMs)
            );
            const numberId = await Promise.race([numberPromise, timeoutPromise]);
            if (numberId && numberId._serialized) {
                return numberId._serialized;
            }
            return `${numero}@c.us`;
        } catch (err) {
            console.warn(`⚠️ Verificación de número para ${numero} demoró o falló (${err.message}). Usando formato directo.`);
            return `${numero}@c.us`;
        }
    },

    async enviar(chatId, mensaje, timeoutMs = 20000) {
        const sendPromise = client.sendMessage(chatId, mensaje);
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout (${timeoutMs / 1000}s) enviando mensaje a ${chatId}`)), timeoutMs)
        );
        return Promise.race([sendPromise, timeoutPromise]);
    },

    // Humanización (S2): marcar visto y mostrar "escribiendo" antes de responder.
    // Son best-effort: si el chat no se puede resolver, el mensaje igual se envía.
    async marcarVisto(chatId) {
        try {
            const chat = await obtenerChat(chatId);
            await chat.sendSeen();
        } catch (error) {
            console.warn(`⚠️ No se pudo marcar como visto ${chatId}: ${error.message}`);
        }
    },

    async escribiendo(chatId, duracionMs) {
        if (!(duracionMs > 0)) return;
        try {
            const chat = await obtenerChat(chatId);
            await chat.sendStateTyping();
            // El indicador se mantiene hasta que se envía algo: se espera lo proporcional
            // al largo del texto para que el bot no conteste instantáneamente.
            await new Promise(resolve => setTimeout(resolve, duracionMs));
        } catch (error) {
            console.warn(`⚠️ No se pudo mostrar "escribiendo" en ${chatId}: ${error.message}`);
        }
    },

    estado: () => estado,

    // Último QR generado (para la página /qr); null si ya está conectado
    ultimoQr: () => ultimoQr,

    // Motivo del último fallo de arranque, para que el panel explique la espera
    ultimoError: () => ultimoError
};

module.exports = { client, whatsapp, reiniciarSesion, arrancar };
