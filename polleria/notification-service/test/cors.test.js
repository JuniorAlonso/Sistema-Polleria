process.env.JWT_SECRET = 'secreto-de-prueba-con-al-menos-32-caracteres';
process.env.NOTIFICATION_API_KEY = 'clave-interna';
process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:4200';

const test = require('node:test');
const assert = require('node:assert');

const { crearApp } = require('../src/http/app');
const { MemoryStore } = require('../src/notifications/store');
const { NotificacionService } = require('../src/notifications/service');

/**
 * El panel administrativo pide el QR desde el navegador. Si `ng serve` arranca en
 * otro puerto, o si el usuario abre la app por 127.0.0.1 en vez de localhost, el
 * preflight CORS no devolvía Access-Control-Allow-Origin y el navegador bloqueaba
 * la petición: el QR nunca aparecía. La lista exacta de orígenes no cubría esos
 * casos porque el mismo servidor local puede escuchar en varios.
 */
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
const app = crearApp({ service, store, estadoWhatsapp: () => 'CONECTADO', allowLoopbackCors: true });
const appEstricto = crearApp({ service, store, estadoWhatsapp: () => 'CONECTADO', allowLoopbackCors: false });

let servidor;
let servidorEstricto;
let base;
let baseEstricto;

test.before(() => Promise.all([
    new Promise(resolve => {
        servidor = app.listen(0, () => {
            base = `http://localhost:${servidor.address().port}/api/notificaciones`;
            resolve();
        });
    }),
    new Promise(resolve => {
        servidorEstricto = appEstricto.listen(0, () => {
            baseEstricto = `http://localhost:${servidorEstricto.address().port}/api/notificaciones`;
            resolve();
        });
    })
]));
test.after(() => Promise.all([
    new Promise(resolve => servidor.close(resolve)),
    new Promise(resolve => servidorEstricto.close(resolve))
]));

function preflight(origin, urlBase = base) {
    return fetch(`${urlBase}/qr`, {
        method: 'OPTIONS',
        headers: {
            Origin: origin,
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'authorization'
        }
    });
}

test('con allowLoopbackCors=true permite 127.0.0.1:4200 y otros puertos locales', async () => {
    const resIp = await preflight('http://127.0.0.1:4200');
    assert.strictEqual(resIp.headers.get('access-control-allow-origin'), 'http://127.0.0.1:4200');

    const resPuerto = await preflight('http://localhost:4201');
    assert.strictEqual(resPuerto.headers.get('access-control-allow-origin'), 'http://localhost:4201');
});

test('sin allowLoopbackCors (default prod) solo habilita origenes explicitos', async () => {
    const resExplicito = await preflight('http://localhost:4200', baseEstricto);
    assert.strictEqual(resExplicito.headers.get('access-control-allow-origin'), 'http://localhost:4200');

    const resPuerto = await preflight('http://localhost:4201', baseEstricto);
    assert.strictEqual(resPuerto.headers.get('access-control-allow-origin'), null);

    const resIp = await preflight('http://127.0.0.1:4200', baseEstricto);
    assert.strictEqual(resIp.headers.get('access-control-allow-origin'), null);
});

test('el preflight mantiene permitido el origen de la lista explicita', async () => {
    const res = await preflight('http://localhost:4200');
    assert.strictEqual(res.headers.get('access-control-allow-origin'), 'http://localhost:4200');
});

test('el preflight NO habilita un origen externo arbitrario', async () => {
    const res = await preflight('http://sitio-ajeno.example');
    assert.strictEqual(res.headers.get('access-control-allow-origin'), null);
});
