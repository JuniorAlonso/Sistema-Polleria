process.env.JWT_SECRET = 'secreto-de-prueba-con-al-menos-32-caracteres';
process.env.NOTIFICATION_API_KEY = 'clave-interna';

const test = require('node:test');
const assert = require('node:assert');

const { crearApp } = require('../src/http/app');
const { MemoryStore } = require('../src/notifications/store');
const { NotificacionService } = require('../src/notifications/service');
const { mensajeComprobanteRechazado } = require('../src/notifications/messages');

/**
 * T6d (S6/S13) — Aviso al cliente cuando el administrador rechaza el comprobante de Yape.
 *
 * El rechazo de T6c deja el pedido impago esperando un comprobante válido: si el cliente no se
 * entera, el pedido muere. Este endpoint interno encola el aviso por la MISMA cola única (T4) y lo
 * registra en el historial (RF32), igual que el resto de los avisos.
 *
 * Determinista: sin red real (WhatsApp doble que registra los envíos) y con el store en memoria.
 */

const store = new MemoryStore();
const enviados = [];
const service = new NotificacionService({
    store,
    whatsapp: {
        esperarListo: async () => {},
        obtenerChatId: async numero => `${numero}@c.us`,
        enviar: async (chatId, mensaje) => { enviados.push({ chatId, mensaje }); }
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

async function esperarCola() {
    while (service.pendientes > 0) {
        await new Promise(r => setTimeout(r, 5));
    }
}

function post(ruta, body, clave = 'clave-interna') {
    return fetch(base + ruta, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Key': clave },
        body: JSON.stringify(body)
    });
}

test('el endpoint encola el aviso de rechazo con el teléfono y el mensaje correctos', async () => {
    const res = await post('/whatsapp/comprobante-rechazado', {
        ordenId: 701,
        numeroPedido: 3,
        telefono: '999888777',
        nombreCliente: 'Ana Torres',
        motivo: 'El monto no coincide con el total del pedido'
    });

    assert.strictEqual(res.status, 202);
    const body = await res.json();
    assert.strictEqual(body.status, 'EN_COLA');
    assert.match(body.notificacionId, /^notif_/);

    await esperarCola();

    const aviso = enviados.find(e => e.chatId === '51999888777@c.us');
    assert.ok(aviso, 'el aviso sale por la misma cola hacia el celular del cliente');
    assert.match(aviso.mensaje, /pedido N\.° 3/, 'usa el número de pedido que ve el cliente');
    assert.doesNotMatch(aviso.mensaje, /701/, 'no filtra el id interno de la orden');
    assert.match(aviso.mensaje, /El monto no coincide con el total del pedido/, 'incluye el motivo del admin');
    assert.match(aviso.mensaje, /No pudimos validar el comprobante/, 'dice que no pudo validarse');
    assert.match(aviso.mensaje, /mismo chat/i, 'indica que puede enviar uno nuevo por el mismo chat');
    assert.match(aviso.mensaje, /San Pollo de Ica$/, 'mantiene la firma del servicio');
    assert.doesNotMatch(aviso.mensaje, /\p{Extended_Pictographic}/u, 'sin emojis');

    const [log] = await store.findAll({ ordenId: 701 });
    assert.strictEqual(log.tipo, 'COMPROBANTE_RECHAZADO');
    assert.strictEqual(log.estado, 'ENVIADO');
    assert.strictEqual(log.destinatario, '51999888777');
});

test('el endpoint exige la clave interna y sin ella no encola nada', async () => {
    const res = await post('/whatsapp/comprobante-rechazado', {
        ordenId: 702,
        numeroPedido: 4,
        telefono: '999111222',
        nombreCliente: 'Luis',
        motivo: 'Comprobante ilegible'
    }, 'clave-ajena');

    assert.strictEqual(res.status, 401);
    assert.deepStrictEqual(await store.findAll({ ordenId: 702 }), []);
    assert.ok(!enviados.some(e => e.chatId === '51999111222@c.us'));
});

test('sin motivo (o en blanco) responde 400 y no encola', async () => {
    const sinMotivo = await post('/whatsapp/comprobante-rechazado', {
        ordenId: 703, numeroPedido: 5, telefono: '999333444', nombreCliente: 'Rosa'
    });
    assert.strictEqual(sinMotivo.status, 400);

    const motivoEnBlanco = await post('/whatsapp/comprobante-rechazado', {
        ordenId: 703, numeroPedido: 5, telefono: '999333444', nombreCliente: 'Rosa', motivo: '   '
    });
    assert.strictEqual(motivoEnBlanco.status, 400);

    assert.deepStrictEqual(await store.findAll({ ordenId: 703 }), []);
});

test('sin teléfono responde 400 y no encola', async () => {
    const res = await post('/whatsapp/comprobante-rechazado', {
        ordenId: 704, numeroPedido: 6, nombreCliente: 'Sara', motivo: 'Comprobante vencido'
    });
    assert.strictEqual(res.status, 400);
    assert.deepStrictEqual(await store.findAll({ ordenId: 704 }), []);
});

test('la plantilla del aviso usa el número de pedido del cliente, el motivo y la firma', () => {
    const mensaje = mensajeComprobanteRechazado({
        ordenId: 4821,
        numeroPedido: 7,
        nombreCliente: 'MARÍA garcía',
        motivo: 'El comprobante está borroso'
    });

    assert.match(mensaje, /^Hola, María\./);
    assert.match(mensaje, /pedido N\.° 7/);
    assert.doesNotMatch(mensaje, /4821/);
    assert.match(mensaje, /Motivo: El comprobante está borroso/);
    assert.match(mensaje, /San Pollo de Ica$/);
    assert.doesNotMatch(mensaje, /\p{Extended_Pictographic}/u);
});

// PRESERVE — el endpoint de pago confirmado (RF30) sigue igual: solo se agregó una ruta nueva.
test('PRESERVE: POST /whatsapp/pago sigue encolando la confirmación como antes', async () => {
    const res = await post('/whatsapp/pago', {
        ordenId: 705, numeroPedido: 8, telefono: '999777888',
        nombreCliente: 'José', montoTotal: 68.5, tiempoEstimado: '35-45 min'
    });

    assert.strictEqual(res.status, 202);
    const body = await res.json();
    assert.strictEqual(body.status, 'EN_COLA');

    await esperarCola();
    const aviso = enviados.find(e => e.chatId === '51999777888@c.us');
    assert.ok(aviso);
    assert.match(aviso.mensaje, /Confirmamos el pago de S\/ 68\.50 por tu pedido N\.° 8/);
});
