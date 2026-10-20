const path = require('path');
require('dotenv').config({ quiet: true });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
const fs = require('fs');

// Chrome instalado en el servidor Linux de despliegue; en Windows/macOS puppeteer usa el suyo
const CHROME_LINUX = '/usr/bin/google-chrome-stable';

// Lee un número de entorno sin que un valor vacío o inválido pise el default.
function numeroEnv(nombre, porDefecto) {
    const bruto = process.env[nombre];
    if (bruto === undefined || bruto === '') return porDefecto;
    const valor = Number(bruto);
    return Number.isFinite(valor) ? valor : porDefecto;
}

const config = {
    port: Number(process.env.PORT) || 3001,

    // Sesión de WhatsApp (QR escaneado una sola vez y persistido en disco)
    sessionPath: process.env.WHATSAPP_SESSION_PATH || './.wwebjs_auth',
    chromePath: process.env.PUPPETEER_EXECUTABLE_PATH || (fs.existsSync(CHROME_LINUX) ? CHROME_LINUX : undefined),

    // RNF10: espera mínima entre mensajes para evitar bloqueos de Meta
    rateLimitMs: Number(process.env.WHATSAPP_RATE_LIMIT_MS) || 10000,
    maxIntentos: Number(process.env.WHATSAPP_MAX_INTENTOS) || 3,

    // Si no hay DATABASE_URL, el historial se guarda en memoria (se pierde al reiniciar)
    databaseUrl: process.env.DATABASE_URL || null,

    // Mismo secreto que auth-service: protege GET /historial (solo ADMIN)
    jwtSecret: process.env.JWT_SECRET || 'sanpollo-dev-secret-key-2026-super-segura-256bits-minimo',

    // Clave compartida con orders/payments. Si está vacía, /pago y /estado quedan abiertos.
    internalApiKey: process.env.NOTIFICATION_API_KEY || null,

    // Orígenes del frontend que pueden consultar /historial y /status
    corsOrigins: (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:4200')
        .split(',').map(o => o.trim()).filter(Boolean),

    telefonoContacto: process.env.POLLERIA_TELEFONO || '(056) 123-456'
};

// Anti-baneo (S2/S8): punto de partida del store en memoria que se edita en caliente.
// El delay base sigue siendo WHATSAPP_RATE_LIMIT_MS (RNF10); el jitter lo varía ± un
// porcentaje en cada envío y el "escribiendo" dura lo proporcional al texto, acotado
// entre el mínimo y el máximo. Todo esto vive solo en memoria del proceso.
config.antiBaneo = {
    intervaloMs: config.rateLimitMs,
    jitterPct: numeroEnv('WHATSAPP_JITTER_PCT', 20),
    typingMinMs: numeroEnv('WHATSAPP_TYPING_MIN_MS', 1000),
    typingMaxMs: numeroEnv('WHATSAPP_TYPING_MAX_MS', 6000),
    typingMsPorCaracter: numeroEnv('WHATSAPP_TYPING_MS_POR_CARACTER', 50)
};

module.exports = config;
