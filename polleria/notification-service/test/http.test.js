process.env.JWT_SECRET = 'secreto-de-prueba-con-al-menos-32-caracteres';
process.env.NOTIFICATION_API_KEY = 'clave-interna';

const test = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');

const { crearApp } = require('../src/http/app');
const { MemoryStore } = require('../src/notifications/store');
const { NotificacionService } = require('../src/notifications/service');

const store = new MemoryStore();
const service = new NotificacionService({
    store,
    whatsapp: {
        esperarListo: async () => {},
        obtenerChatId: async numero => `${numero}@c.us`,
        enviar: async () => {}
    },
    intervaloMs: 0,
    maxIntentos: 3
});
const app = crearApp({ service, store, estadoWhatsapp: () => 'CONECTADO' });

let servidor;
let base;

test.before(() => new Promise(resolve => {
    servidor = app.listen(0, () => {
        base = `http://localhost:${servidor.address().port}/api/notificaciones`;
        resolve();
    });
}));
test.after(() => servidor.close());

function post(ruta, body, clave = 'clave-interna') {
    return fetch(base + ruta, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Key': clave },
        body: JSON.stringify(body)
    });
}

function token(role) {
    return jwt.sign({ role, userId: 1 }, process.env.JWT_SECRET, { subject: 'a@a.com', algorithm: 'HS256' });
}

test('POST /whatsapp/pago responde 202 EN_COLA', async () => {
    const res = await post('/whatsapp/pago', {
        ordenId: 52, telefono: '51999888777', nombreCliente: 'María García',
        montoTotal: 68.5, metodoPago: 'YAPE_PLIN', tiempoEstimado: '35-45 min'
    });
    const body = await res.json();
    assert.strictEqual(res.status, 202);
    assert.strictEqual(body.status, 'EN_COLA');
    assert.match(body.notificacionId, /^notif_/);
});

test('POST /whatsapp/pago sin clave interna responde 401', async () => {
    const res = await post('/whatsapp/pago', { ordenId: 1, telefono: '999888777', montoTotal: 10 }, 'otra');
    assert.strictEqual(res.status, 401);
});

test('POST /whatsapp/estado valida el estado', async () => {
    const malo = await post('/whatsapp/estado', { ordenId: 52, telefono: '999888777', estadoNuevo: 'LISTO' });
    assert.strictEqual(malo.status, 400);

    const bueno = await post('/whatsapp/estado', { ordenId: 52, telefono: '999888777', estadoNuevo: 'EN_CAMINO' });
    assert.strictEqual(bueno.status, 202);
});

test('POST /whatsapp/estado con teléfono mal formado responde 422 y queda en el historial', async () => {
    const res = await post('/whatsapp/estado', { ordenId: 77, telefono: 'abc', estadoNuevo: 'ENTREGADO' });
    assert.strictEqual(res.status, 422);
    assert.strictEqual((await res.json()).status, 'ERROR');
});

test('GET /historial exige rol ADMIN y filtra', async () => {
    const sinToken = await fetch(`${base}/historial`);
    assert.strictEqual(sinToken.status, 401);

    const cliente = await fetch(`${base}/historial`, { headers: { Authorization: `Bearer ${token('CLIENTE')}` } });
    assert.strictEqual(cliente.status, 403);

    const admin = await fetch(`${base}/historial?ordenId=77&estado=ERROR`, { headers: { Authorization: `Bearer ${token('ADMIN')}` } });
    const logs = await admin.json();
    assert.strictEqual(admin.status, 200);
    assert.strictEqual(logs.length, 1);
    assert.strictEqual(logs[0].tipo, 'ESTADO_ENTREGADO');
});

test('GET /status informa la conexión', async () => {
    const res = await fetch(`${base}/status`);
    const body = await res.json();
    assert.strictEqual(body.whatsapp, 'connected');
});

test('CORS permite al frontend configurado', async () => {
    const permitido = await fetch(`${base}/status`, { headers: { Origin: 'http://localhost:4200' } });
    assert.strictEqual(permitido.headers.get('access-control-allow-origin'), 'http://localhost:4200');

    const ajeno = await fetch(`${base}/status`, { headers: { Origin: 'http://malicioso.com' } });
    assert.strictEqual(ajeno.headers.get('access-control-allow-origin'), null);
});

test('POST /whatsapp/codigo encola el código y valida el formato', async () => {
    const malo = await post('/whatsapp/codigo', { telefono: '999888777', codigo: 'abcd' });
    assert.strictEqual(malo.status, 400);

    const bueno = await post('/whatsapp/codigo', { telefono: '999888777', codigo: '4827' });
    assert.strictEqual(bueno.status, 202);
});

test('GET /qr desde la misma máquina muestra el estado sin enviar el QR a terceros', async () => {
    const res = await fetch(base.replace('/api/notificaciones', '/qr'));
    const html = await res.text();
    assert.strictEqual(res.status, 200);
    assert.match(html, /WhatsApp ya está conectado/);
    assert.doesNotMatch(html, /qrserver/);
});

test('GET /api/notificaciones/qr solo para ADMIN y devuelve la imagen cuando hay QR', async () => {
    const sinToken = await fetch(`${base}/qr`);
    assert.strictEqual(sinToken.status, 401);

    const cliente = await fetch(`${base}/qr`, { headers: { Authorization: `Bearer ${token('CLIENTE')}` } });
    assert.strictEqual(cliente.status, 403);

    // Servidor aparte simulando WhatsApp esperando QR
    const appQr = crearApp({ service, store, estadoWhatsapp: () => 'ESPERANDO_QR', ultimoQr: () => '2@abc,def,ghi' });
    const srv = appQr.listen(0);
    try {
        const url = `http://localhost:${srv.address().port}/api/notificaciones/qr`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token('ADMIN')}` } });
        const body = await res.json();
        assert.strictEqual(res.status, 200);
        assert.strictEqual(body.whatsapp, 'waiting_qr');
        assert.match(body.qr, /^data:image\/png;base64,/);
    } finally {
        srv.close();
    }
});
