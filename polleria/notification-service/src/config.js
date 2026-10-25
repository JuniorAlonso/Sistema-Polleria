const path = require('path');
require('dotenv').config({ quiet: true });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
const fs = require('fs');
const { normalizarTelefono } = require('./notifications/phone');

// Detecta automáticamente Chrome o Edge en Windows, Linux o macOS si Puppeteer no tiene descargado el suyo.
function detectarRutaNavegador() {
    if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
        return process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    const posiblesRutas = [
        // Linux
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        // Windows (Google Chrome)
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        (process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe') : null),
        // Windows (Microsoft Edge Chromium)
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        // macOS
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    ].filter(Boolean);

    for (const ruta of posiblesRutas) {
        try {
            if (fs.existsSync(ruta)) {
                return ruta;
            }
        } catch (_) {}
    }

    return undefined;
}

// Lee un número de entorno sin que un valor vacío o inválido pise el default.
function numeroEnv(nombre, porDefecto) {
    const bruto = process.env[nombre];
    if (bruto === undefined || bruto === '') return porDefecto;
    const valor = Number(bruto);
    return Number.isFinite(valor) ? valor : porDefecto;
}

// Teléfono de contacto configurable (T5, S4/S11): vacío o con formato inválido queda en null.
function telefonoEnv(nombre) {
    return normalizarTelefono(process.env[nombre]) || null;
}

const config = {
    port: Number(process.env.PORT) || 3001,

    // Sesión de WhatsApp (QR escaneado una sola vez y persistido en disco)
    sessionPath: path.resolve(process.env.WHATSAPP_SESSION_PATH || path.join(__dirname, '../.wwebjs_auth')),
    chromePath: detectarRutaNavegador(),

    // RNF10: espera mínima entre mensajes para evitar bloqueos de Meta
    rateLimitMs: Number(process.env.WHATSAPP_RATE_LIMIT_MS) || 10000,
    maxIntentos: Number(process.env.WHATSAPP_MAX_INTENTOS) || 3,

    // Si no hay DATABASE_URL, el historial se guarda en memoria (se pierde al reiniciar)
    databaseUrl: process.env.DATABASE_URL || null,

    // Catálogo real de orders-service (T3a): el bot lo lee con GET /productos y lo
    // cachea un rato en memoria para no golpear el servicio en cada mensaje.
    ordersServiceUrl: process.env.ORDERS_SERVICE_URL || 'http://localhost:8082',
    catalogoTtlMs: numeroEnv('ORDERS_CATALOGO_TTL_MS', 30000),

    // payments-service (T6b): el bot registra la evidencia del comprobante de Yape con
    // POST /pagos/comprobante, autenticado con la clave interna compartida. Sin
    // PAYMENTS_SERVICE_URL usa el puerto local y sin INTERNAL_API_KEY el servicio
    // responde 401 y el bot avisa el fallo (nunca inventa un éxito).
    paymentsServiceUrl: process.env.PAYMENTS_SERVICE_URL || 'http://localhost:8083',
    internalKeyCompartida: process.env.INTERNAL_API_KEY || process.env.NOTIFICATION_API_KEY || null,

    // Almacenamiento de comprobantes en MinIO (T6b, S7). Defaults para local: MinIO
    // levantado con docker-compose.local.yml (API 9000, consola 9001) y credenciales
    // de desarrollo. En Docker el endpoint es `minio` (nombre del servicio del compose).
    minio: {
        endpoint: process.env.MINIO_ENDPOINT || 'localhost',
        port: numeroEnv('MINIO_PORT', 9000),
        useSSL: process.env.MINIO_USE_SSL === 'true',
        accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
        secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
        bucket: process.env.MINIO_BUCKET || 'polleria-comprobantes'
    },

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
// entre el mínimo y el máximo. El presupuesto por hora/día, la ventana horaria y el
// circuit breaker (T4b) también viven solo en memoria del proceso.
config.antiBaneo = {
    intervaloMs: config.rateLimitMs,
    jitterPct: numeroEnv('WHATSAPP_JITTER_PCT', 20),
    typingMinMs: numeroEnv('WHATSAPP_TYPING_MIN_MS', 1000),
    typingMaxMs: numeroEnv('WHATSAPP_TYPING_MAX_MS', 6000),
    typingMsPorCaracter: numeroEnv('WHATSAPP_TYPING_MS_POR_CARACTER', 50),

    // Presupuesto de envíos: al agotarse, la cola se pausa y se reanuda con la hora/día nuevos.
    presupuestoHora: numeroEnv('WHATSAPP_PRESUPUESTO_HORA', 40),
    presupuestoDia: numeroEnv('WHATSAPP_PRESUPUESTO_DIA', 500),

    // Ventana horaria de atención: fuera de [horaDesde, horaHasta) la cola espera, no descarta.
    horaDesde: numeroEnv('WHATSAPP_HORA_DESDE', 11),
    horaHasta: numeroEnv('WHATSAPP_HORA_HASTA', 23),

    // Circuit breaker: backoff exponencial acotado al detectar señales de bloqueo.
    breakerBaseMs: numeroEnv('WHATSAPP_BREAKER_BASE_MS', 60000),
    breakerMaxMs: numeroEnv('WHATSAPP_BREAKER_MAX_MS', 900000),

    // Datos de contacto configurables desde el panel (T5, S4/S11/S13): el número del
    // admin que conecta WhatsApp y el de respaldo (opcional). Se normalizan a 51+9 dígitos.
    numeroAsesor: telefonoEnv('WHATSAPP_NUMERO_ASESOR'),
    numeroRespaldo: telefonoEnv('WHATSAPP_NUMERO_RESPALDO'),
    // T6f: número de Yape de la pollería. Es el valor del negocio y se puede cambiar desde el panel;
    // el store lo guarda normalizado (51 + 9 dígitos) como el resto de los contactos.
    numeroYape: telefonoEnv('WHATSAPP_NUMERO_YAPE') || '+51 934 421 442'
};

module.exports = config;
