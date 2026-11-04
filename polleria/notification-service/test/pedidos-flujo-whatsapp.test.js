process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba-con-al-menos-32-caracteres';
process.env.NOTIFICATION_API_KEY = process.env.NOTIFICATION_API_KEY || 'clave-interna';

const test = require('node:test');
const assert = require('node:assert');

const { crearBot } = require('../src/chatbot/chatbot');
const { MemoryConversationStore } = require('../src/chatbot/conversation');
const { crearCatalogo } = require('../src/pedidos/catalogo');
const { crearClienteOrdenes } = require('../src/pedidos/ordenes');
const { crearAjustes } = require('../src/outbound/ajustes');
const { crearApp } = require('../src/http/app');
const { MemoryStore } = require('../src/notifications/store');
const { NotificacionService } = require('../src/notifications/service');
const { ESTADOS_DELIVERY, mensajeEstado } = require('../src/notifications/messages');

/**
 * WhatsApp order flow end to end (S2): order lookup by the POL code with mandatory ownership,
 * "cancelar" really cancelling a live order, status/rejection webhooks touching only the order
 * the chat holds, PREPARANDO and PEDIDO_FANTASMA releasing the chat, and a capture sent after
 * the payment was approved. Deterministic: doubles for orders, storage and payments.
 */

const CELULAR = '51999888777';
const FROM = `${CELULAR}@c.us`;
let secuencia = 0;

function texto(body, from = FROM) {
    secuencia += 1;
    return { from, body, id: `t5-${secuencia}` };
}

function imagen() {
    secuencia += 1;
    return {
        from: FROM,
        id: `t5-img-${secuencia}`,
        type: 'image',
        hasMedia: true,
        async downloadMedia() {
            return { mimetype: 'image/jpeg', data: Buffer.from('captura').toString('base64'), filename: 'c.jpg' };
        }
    };
}

function ordenDe(encima = {}) {
    return {
        id: 101,
        numeroCliente: 2,
        estado: 'EN_PREPARACION',
        tipo: 'DELIVERY',
        telefonoCliente: CELULAR,
        total: 55,
        direccionEntrega: 'Av. San Martín 450, Ica',
        items: [{ cantidad: 1, productoNombre: '1/4 Pollo a la Brasa' }],
        ...encima
    };
}

function montar({ orden = ordenDe(), pago = { id: 1, estado: 'PENDIENTE_VERIFICACION' }, cancelarFalla = null } = {}) {
    const conversacion = new MemoryConversationStore();
    const consultas = [];
    const cancelaciones = [];
    const ordenes = {
        crear: async () => { throw new Error('no se usa'); },
        obtener: async id => {
            consultas.push(String(id));
            return orden && String(orden.id) === String(id) ? { ...orden } : null;
        },
        cancelar: async id => {
            if (cancelarFalla) throw cancelarFalla;
            cancelaciones.push(String(id));
            return { ...orden, estado: 'CANCELADO' };
        }
    };
    const bot = crearBot({
        catalogo: crearCatalogo({
            baseUrl: 'http://orders.test',
            ahora: () => 1000,
            fetchImpl: async () => ({ ok: true, status: 200, json: async () => [] })
        }),
        ajustes: crearAjustes({ numeroAsesor: '51934421442', numeroRespaldo: null }),
        conversacion,
        ordenes,
        almacenamiento: { subir: async () => 'comprobantes/yape/101/c.jpg' },
        pagos: { registrarComprobante: async () => pago },
        ahora: () => 1000
    });
    return { bot, conversacion, consultas, cancelaciones };
}

const PEDIDO = { id: 101, numeroCliente: 2, total: 55, metodoPago: 'YAPE', tipo: 'DELIVERY' };

// ─── 1. Order lookup ────────────────────────────────────────────────────────────

test('consulta: el código POL-<id> (sin importar mayúsculas, espacios o guiones) muestra el pedido del dueño', async () => {
    for (const codigo of ['POL-101', 'pol 101', 'Pol101', '#POL-101']) {
        const { bot, consultas } = montar();
        await bot.procesar(texto('2'));
        const r = await bot.procesar(texto(codigo));
        assert.match(r, /ESTADO DE TU PEDIDO N\.° 2/, codigo);
        assert.deepStrictEqual(consultas, ['101'], `${codigo} consulta el id global`);
    }
});

test('consulta: el número del cliente (N.° 2) se resuelve al pedido que guarda la conversación, no al id global 2', async () => {
    const { bot, conversacion, consultas } = montar();
    await conversacion.set(CELULAR, { estado: 'MENU', ultimoPedido: PEDIDO });
    await bot.procesar(texto('2'));
    const r = await bot.procesar(texto('2'));
    assert.deepStrictEqual(consultas, ['101']);
    assert.match(r, /ESTADO DE TU PEDIDO N\.° 2/);
});

test('consulta: un número que no es de este chat pide el código POL y no consulta nada', async () => {
    const { bot, consultas } = montar();
    await bot.procesar(texto('2'));
    const r = await bot.procesar(texto('#7'));
    assert.deepStrictEqual(consultas, [], 'no consulta un id global ajeno');
    assert.match(r, /POL-/);
    assert.doesNotMatch(r, /Av\. San Martín/);
});

test('consulta: si la orden no tiene teléfono registrado no se muestran sus datos', async () => {
    const { bot } = montar({ orden: ordenDe({ telefonoCliente: null }) });
    await bot.procesar(texto('2'));
    const r = await bot.procesar(texto('POL-101'));
    assert.match(r, /No encontramos/);
    assert.doesNotMatch(r, /Av\. San Martín|S\/ 55/);
});

test('consulta: si el remitente no es un celular (clave interna) no se muestran datos', async () => {
    const { bot } = montar();
    const from = '123456789012345@lid';
    await bot.procesar(texto('2', from));
    const r = await bot.procesar(texto('POL-101', from));
    assert.match(r, /No encontramos/);
    assert.doesNotMatch(r, /Av\. San Martín|S\/ 55/);
});

test('consulta: el pedido de otro celular no se muestra', async () => {
    const { bot } = montar({ orden: ordenDe({ telefonoCliente: '51911223344' }) });
    await bot.procesar(texto('2'));
    const r = await bot.procesar(texto('POL-101'));
    assert.match(r, /No encontramos/);
    assert.doesNotMatch(r, /Av\. San Martín|S\/ 55/);
});

// ─── 2. "cancelar" with a created order ─────────────────────────────────────────

test('cancelar con un pedido PENDIENTE_PAGO lo cancela en orders-service y libera el chat conservando el ticket', async () => {
    for (const estado of ['PENDIENTE_PAGO', 'PENDIENTE_CONFIRMACION', 'RECIBIDO']) {
        const { bot, conversacion, cancelaciones } = montar({ orden: ordenDe({ estado }) });
        await conversacion.set(CELULAR, { estado: 'PEDIDO_CONFIRMADO', pedido: PEDIDO, ultimoPedido: PEDIDO });
        const r = await bot.procesar(texto('cancelar'));
        assert.deepStrictEqual(cancelaciones, ['101'], estado);
        assert.match(r, /cancelado/i);
        const guardado = await conversacion.get(CELULAR);
        assert.strictEqual(guardado.estado, 'MENU');
        assert.strictEqual(guardado.ultimoPedido.id, 101);
    }
});

test('cancelar con comprobante recibido también cancela si la orden sigue esperando el pago', async () => {
    const { bot, conversacion, cancelaciones } = montar({ orden: ordenDe({ estado: 'PENDIENTE_PAGO' }) });
    await conversacion.set(CELULAR, { estado: 'COMPROBANTE_RECIBIDO', comprobanteRecibido: true, pedido: PEDIDO });
    await bot.procesar(texto('cancelar pedido'));
    assert.deepStrictEqual(cancelaciones, ['101']);
});

test('cancelar con el pedido ya en cocina no lo cancela y conserva la conversación', async () => {
    const { bot, conversacion, cancelaciones } = montar({ orden: ordenDe({ estado: 'EN_PREPARACION' }) });
    await conversacion.set(CELULAR, { estado: 'PEDIDO_CONFIRMADO', pedido: PEDIDO });
    const r = await bot.procesar(texto('cancelar'));
    assert.deepStrictEqual(cancelaciones, []);
    assert.match(r, /no se puede cancelar/i);
    assert.match(r, /934 421 442/);
    assert.strictEqual((await conversacion.get(CELULAR)).estado, 'PEDIDO_CONFIRMADO');
});

test('si orders-service rechaza la cancelación no dice que se canceló y conserva la conversación', async () => {
    const falla = Object.assign(new Error('409'), { status: 409 });
    const { bot, conversacion } = montar({ orden: ordenDe({ estado: 'PENDIENTE_PAGO' }), cancelarFalla: falla });
    await conversacion.set(CELULAR, { estado: 'PEDIDO_CONFIRMADO', pedido: PEDIDO });
    const r = await bot.procesar(texto('cancelar'));
    assert.doesNotMatch(r, /fue cancelado|Operación cancelada/i);
    assert.strictEqual((await conversacion.get(CELULAR)).estado, 'PEDIDO_CONFIRMADO');
});

test('salir/volver con un pedido creado vuelve al menú sin cancelar la orden y lo dice', async () => {
    for (const palabra of ['salir', 'volver', 'reiniciar']) {
        const { bot, conversacion, cancelaciones } = montar({ orden: ordenDe({ estado: 'PENDIENTE_PAGO' }) });
        await conversacion.set(CELULAR, { estado: 'PEDIDO_CONFIRMADO', pedido: PEDIDO, ultimoPedido: PEDIDO });
        const r = await bot.procesar(texto(palabra));
        assert.deepStrictEqual(cancelaciones, [], palabra);
        assert.match(r, /sigue activo/i, palabra);
        assert.match(r, /cancelar/i, palabra);
        assert.doesNotMatch(r, /Operación cancelada/, palabra);
        const guardado = await conversacion.get(CELULAR);
        assert.strictEqual(guardado.estado, 'MENU', palabra);
        assert.strictEqual(guardado.ultimoPedido.id, 101, palabra);
    }
});

test('PRESERVE: cancelar antes de crear el pedido solo reinicia el chat', async () => {
    const { bot, conversacion, cancelaciones, consultas } = montar();
    await conversacion.set(CELULAR, { estado: 'CATALOGO', carrito: [{ productoId: 1, nombre: 'x', precio: 1, cantidad: 1 }] });
    const r = await bot.procesar(texto('cancelar'));
    assert.match(r, /Operación cancelada/);
    assert.deepStrictEqual(cancelaciones, []);
    assert.deepStrictEqual(consultas, []);
});

test('ClienteOrdenes.cancelar envía PATCH /ordenes/{id}/estado CANCELADO con la clave interna', async () => {
    const llamadas = [];
    const cliente = crearClienteOrdenes({
        baseUrl: 'http://orders.test/',
        internalKey: 'k',
        fetchImpl: async (url, opciones) => {
            llamadas.push({ url, opciones });
            return { ok: true, status: 200, json: async () => ({ id: 101, estado: 'CANCELADO' }) };
        }
    });
    const orden = await cliente.cancelar(101);
    assert.strictEqual(orden.estado, 'CANCELADO');
    assert.strictEqual(llamadas[0].url, 'http://orders.test/ordenes/101/estado');
    assert.strictEqual(llamadas[0].opciones.method, 'PATCH');
    assert.strictEqual(llamadas[0].opciones.headers['X-Internal-Key'], 'k');
    assert.deepStrictEqual(JSON.parse(llamadas[0].opciones.body), { estado: 'CANCELADO' });

    const fallido = crearClienteOrdenes({
        baseUrl: 'http://orders.test',
        fetchImpl: async () => ({ ok: false, status: 409, text: async () => '{"detail":"No se puede"}' })
    });
    await assert.rejects(fallido.cancelar(101), err => err.status === 409 && err.detalle === 'No se puede');
});

// ─── 5. Capture after approval ──────────────────────────────────────────────────

test('una captura enviada con el pago ya APROBADO responde que el pago ya está confirmado', async () => {
    const { bot, conversacion } = montar({ pago: { id: 1, estado: 'APROBADO' } });
    await conversacion.set(CELULAR, { estado: 'PEDIDO_CONFIRMADO', pedido: PEDIDO });
    const r = await bot.procesar(imagen());
    assert.match(r, /ya está confirmado/i);
    assert.doesNotMatch(r, /Recibimos el comprobante/);
});

test('PRESERVE: una captura con el pago pendiente sigue respondiendo que se recibió', async () => {
    const { bot, conversacion } = montar();
    await conversacion.set(CELULAR, { estado: 'PEDIDO_CONFIRMADO', pedido: PEDIDO });
    const r = await bot.procesar(imagen());
    assert.match(r, /Recibimos el comprobante/);
    assert.strictEqual((await conversacion.get(CELULAR)).estado, 'COMPROBANTE_RECIBIDO');
});

// ─── 3/4. Webhooks ──────────────────────────────────────────────────────────────

const enviados = [];
const historial = new MemoryStore();
const service = new NotificacionService({
    store: historial,
    whatsapp: {
        esperarListo: async () => {},
        obtenerChatId: async numero => `${numero}@c.us`,
        enviar: async (chatId, mensaje) => { enviados.push({ chatId, mensaje }); }
    },
    intervaloMs: 0,
    maxIntentos: 3
});
const conversacionHttp = new MemoryConversationStore();
const app = crearApp({ service, store: historial, conversacion: conversacionHttp, estadoWhatsapp: () => 'CONECTADO' });
let servidor;
let base;

test.before(() => new Promise(resolve => {
    servidor = app.listen(0, () => {
        base = `http://localhost:${servidor.address().port}/api/notificaciones`;
        resolve();
    });
}));
test.after(() => servidor.close());

function post(ruta, body) {
    return fetch(base + ruta, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Key': 'clave-interna' },
        body: JSON.stringify(body)
    });
}

async function esperarCola() {
    while (service.pendientes > 0) await new Promise(r => setTimeout(r, 5));
}

const PEDIDO_CHAT = { id: 300, numeroCliente: 4, total: 40, metodoPago: 'YAPE' };

test('/whatsapp/estado de OTRA orden no toca la conversación, pero el aviso se envía', async () => {
    await conversacionHttp.set(CELULAR, { estado: 'PEDIDO_CONFIRMADO', pedido: PEDIDO_CHAT });
    const res = await post('/whatsapp/estado', { ordenId: 299, numeroPedido: 3, telefono: '999888777', estadoNuevo: 'ENTREGADO' });
    assert.strictEqual(res.status, 202);
    await esperarCola();
    const guardado = await conversacionHttp.get(CELULAR);
    assert.strictEqual(guardado.estado, 'PEDIDO_CONFIRMADO');
    assert.strictEqual(guardado.pedido.id, 300);
    assert.ok(enviados.some(e => /pedido N\.° 3 fue entregado/.test(e.mensaje)));
});

test('PRESERVE: /whatsapp/estado de la orden del chat la libera conservando el ticket', async () => {
    await conversacionHttp.set(CELULAR, { estado: 'PEDIDO_CONFIRMADO', pedido: PEDIDO_CHAT });
    await post('/whatsapp/estado', { ordenId: 300, numeroPedido: 4, telefono: '999888777', estadoNuevo: 'ENTREGADO' });
    const guardado = await conversacionHttp.get(CELULAR);
    assert.strictEqual(guardado.estado, 'MENU');
    assert.strictEqual(guardado.ultimoPedido.id, 300);
});

test('/whatsapp/estado PREPARANDO de la orden del chat libera la conversación (ContraPago confirmado por llamada)', async () => {
    await conversacionHttp.set(CELULAR, { estado: 'PEDIDO_CONFIRMADO', pedido: { ...PEDIDO_CHAT, metodoPago: 'EFECTIVO' } });
    const res = await post('/whatsapp/estado', { ordenId: 300, numeroPedido: 4, telefono: '999888777', estadoNuevo: 'PREPARANDO' });
    assert.strictEqual(res.status, 202);
    assert.strictEqual((await conversacionHttp.get(CELULAR)).estado, 'MENU');
});

test('/whatsapp/estado PEDIDO_FANTASMA es válido, avisa al cliente y libera la conversación', async () => {
    assert.ok(ESTADOS_DELIVERY.includes('PEDIDO_FANTASMA'));
    const texto = mensajeEstado({ ordenId: 300, numeroPedido: 4, estadoNuevo: 'PEDIDO_FANTASMA' });
    assert.match(texto, /pedido N\.° 4/);
    await conversacionHttp.set(CELULAR, { estado: 'PEDIDO_CONFIRMADO', pedido: PEDIDO_CHAT });
    const res = await post('/whatsapp/estado', { ordenId: 300, numeroPedido: 4, telefono: '999888777', estadoNuevo: 'PEDIDO_FANTASMA' });
    assert.strictEqual(res.status, 202);
    assert.strictEqual((await conversacionHttp.get(CELULAR)).estado, 'MENU');
});

test('/whatsapp/comprobante-rechazado de OTRA orden no marca el rechazo en la conversación', async () => {
    await conversacionHttp.set(CELULAR, { estado: 'COMPROBANTE_RECIBIDO', comprobanteRecibido: true, pedido: PEDIDO_CHAT });
    const res = await post('/whatsapp/comprobante-rechazado', { ordenId: 299, numeroPedido: 3, telefono: '999888777', motivo: 'Monto distinto' });
    assert.strictEqual(res.status, 202);
    const guardado = await conversacionHttp.get(CELULAR);
    assert.strictEqual(guardado.estado, 'COMPROBANTE_RECIBIDO');
    assert.strictEqual(guardado.motivoRechazo, undefined);
});

test('PRESERVE: /whatsapp/comprobante-rechazado de la orden del chat pide un comprobante nuevo', async () => {
    await conversacionHttp.set(CELULAR, { estado: 'COMPROBANTE_RECIBIDO', comprobanteRecibido: true, pedido: PEDIDO_CHAT });
    await post('/whatsapp/comprobante-rechazado', { ordenId: 300, numeroPedido: 4, telefono: '999888777', motivo: 'Monto distinto' });
    const guardado = await conversacionHttp.get(CELULAR);
    assert.strictEqual(guardado.estado, 'PEDIDO_CONFIRMADO');
    assert.strictEqual(guardado.motivoRechazo, 'Monto distinto');
});

test('/whatsapp/pago de OTRA orden no libera la conversación de la orden en curso', async () => {
    await conversacionHttp.set(CELULAR, { estado: 'COMPROBANTE_RECIBIDO', comprobanteRecibido: true, pedido: PEDIDO_CHAT });
    const res = await post('/whatsapp/pago', { ordenId: 299, numeroPedido: 3, telefono: '999888777', montoTotal: 20 });
    assert.strictEqual(res.status, 202);
    assert.strictEqual((await conversacionHttp.get(CELULAR)).estado, 'COMPROBANTE_RECIBIDO');
});
