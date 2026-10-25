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

let reinicioLlamado = false;

const app = crearApp({
    service,
    store,
    estadoWhatsapp: () => 'ERROR_INICIO',
    ultimoQr: () => null,
    errorWhatsapp: () => FALLO_ARRANQUE,
    reiniciarWhatsapp: async () => { reinicioLlamado = true; }
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

test('GET /status informa error_inicio sin filtrar el detalle a un endpoint público', async () => {
    const res = await fetch(`${base}/status`);
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.whatsapp, 'error_inicio');
    // /status no exige token: el mensaje de Chromium trae hostnames y rutas internas.
    assert.strictEqual(body.detalle, undefined);
});

test('GET /qr informa el motivo del fallo en lugar de un QR vacío sin explicación y añade cabeceras anti-cache', async () => {
    const res = await fetch(`${base}/qr`, {
        headers: { Authorization: `Bearer ${tokenAdmin()}` }
    });
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.whatsapp, 'error_inicio');
    assert.strictEqual(body.qr, null);
    assert.strictEqual(body.detalle, FALLO_ARRANQUE);
    assert.ok(typeof body.timestamp === 'number');
    assert.strictEqual(res.headers.get('cache-control'), 'no-store, no-cache, must-revalidate, proxy-revalidate');
});

test('POST /qr/reiniciar ejecuta la función de reinicio de sesión bajo rol ADMIN', async () => {
    reinicioLlamado = false;
    const res = await fetch(`${base}/qr/reiniciar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenAdmin()}` }
    });
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.ok, true);
    assert.strictEqual(reinicioLlamado, true);
});
