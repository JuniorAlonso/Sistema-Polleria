require('dotenv').config({ quiet: true });
const fs = require('fs');

// Chrome instalado en el servidor Linux de despliegue; en Windows/macOS puppeteer usa el suyo
const CHROME_LINUX = '/usr/bin/google-chrome-stable';

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
    jwtSecret: process.env.JWT_SECRET || null,

    // Clave compartida con orders/payments. Si está vacía, /pago y /estado quedan abiertos.
    internalApiKey: process.env.NOTIFICATION_API_KEY || null,

    // Orígenes del frontend que pueden consultar /historial y /status
    corsOrigins: (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:4200')
        .split(',').map(o => o.trim()).filter(Boolean),

    telefonoContacto: process.env.POLLERIA_TELEFONO || '(056) 123-456'
};

module.exports = config;
