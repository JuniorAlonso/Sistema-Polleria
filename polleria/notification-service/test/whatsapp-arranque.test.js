process.env.JWT_SECRET = 'secreto-de-prueba-con-al-menos-32-caracteres';
process.env.NOTIFICATION_API_KEY = 'clave-interna';

const test = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');

const { crearApp } = require('../src/http/app');
const { MemoryStore } = require('../src/notifications/store');
const { NotificacionService } = require('../src/notifications/service');

/**
 * Cuando Chromium no arranca (por ejemplo por un SingletonLock de un contenedor
 * anterior) WhatsApp queda en INICIANDO para siempre y el panel administrativo
 * muestra "Generando el código QR..." sin explicación. El estado debe ser
 * explícito y llevar el motivo.
 */
const FALLO_ARRANQUE = 'Failed to launch the browser process: The profile appears to be in use by another Chromium process';

const store = new MemoryStore();
const service = new NotificacionService({
    store,
    whatsapp: {
        esperarListo: async () => {},
        obtenerChatId: async numero => `${numero}@c.us`,
        enviar: async () => {}
    },
    intervaloMs: 0,
    maxIntentos: 1
});

const app = crearApp({
    service,
    store,
    estadoWhatsapp: () => 'ERROR_INICIO',
    ultimoQr: () => null,
    errorWhatsapp: () => FALLO_ARRANQUE
});

let servidor;
let base;

test.before(() => new Promise(resolve => {
    servidor = app.listen(0, () => {
        base = `http://localhost:${servidor.address().port}/api/notificaciones`;
        resolve();
    });
}));
test.after(() => servidor.close());

function tokenAdmin() {
    return jwt.sign({ role: 'ADMIN', userId: 1 }, process.env.JWT_SECRET,
        { subject: 'a@a.com', algorithm: 'HS256' });
}

test('GET /status informa error_inicio en lugar de starting eterno', async () => {
    const res = await fetch(`${base}/status`);
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.whatsapp, 'error_inicio');
    assert.strictEqual(body.detalle, FALLO_ARRANQUE);
});

test('GET /qr informa el motivo del fallo en lugar de un QR vacío sin explicación', async () => {
    const res = await fetch(`${base}/qr`, {
        headers: { Authorization: `Bearer ${tokenAdmin()}` }
    });
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.whatsapp, 'error_inicio');
    assert.strictEqual(body.qr, null);
    assert.strictEqual(body.detalle, FALLO_ARRANQUE);
});
