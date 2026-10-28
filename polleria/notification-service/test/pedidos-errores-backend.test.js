process.env.NOTIFICATION_API_KEY = process.env.NOTIFICATION_API_KEY || 'clave-interna';

const test = require('node:test');
const assert = require('node:assert');

const { crearBot } = require('../src/chatbot/chatbot');
const { MemoryConversationStore } = require('../src/chatbot/conversation');
const { crearCatalogo } = require('../src/pedidos/catalogo');
const { crearClienteOrdenes } = require('../src/pedidos/ordenes');
const { crearClientePagos } = require('../src/pedidos/pagos');
const { crearAlmacenamiento } = require('../src/pedidos/almacenamiento');
const { crearAjustes } = require('../src/outbound/ajustes');
const { crearApp } = require('../src/http/app');
const { MemoryStore } = require('../src/notifications/store');
const { NotificacionService } = require('../src/notifications/service');

/**
 * How the bot reads backend rejections (S3, S6, S10, S11):
 * - orders-service 409 is a ghost sanction only when its body mentions the sanction;
 * - orders-service 400 "no cubre" for cash asks the amount again with the real total;
 * - payments-service 409 "ya no está activo" tells the customer the order is over;
 * - the CANCELADO status notification releases the conversation, keeping the ticket.
 * Deterministic: fetch, MinIO and the conversation store are doubles.
 */

const PRODUCTOS = [{ id: 1, nombre: 'Cuarto de pollo + papas', precio: 18, disponible: true }];
const CELULAR = '51999888777';
const FROM = `${CELULAR}@c.us`;
const MENSAJE_NO_CUBRE = 'El monto con el que pagas (S/ 20.00) no cubre el total del pedido (S/ 24.00)';

let secuencia = 0;
function mensaje(body) {
    secuencia += 1;
    return { from: FROM, body, id: `err-${secuencia}` };
}

/** Response double with only `text()`, like a real fetch Response read as text. */
function respuestaTexto(status, cuerpo) {
    const texto = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo);
    return { ok: false, status, text: async () => texto, json: async () => JSON.parse(texto) };
}

function catalogoFalso() {
    return crearCatalogo({
        baseUrl: 'http://orders.test',
        ttlMs: 60000,
        ahora: () => 1000,
        fetchImpl: async () => ({ ok: true, status: 200, json: async () => PRODUCTOS })
    });
}

/** orders-service double: `responder(cuerpo)` returns the POST /ordenes response. */
function montarBot(responder) {
    const llamadas = [];
    const ordenes = crearClienteOrdenes({
        baseUrl: 'http://orders.test',
        fetchImpl: async (url, opciones) => {
            const cuerpo = JSON.parse(opciones.body);
            llamadas.push(cuerpo);
            return responder(cuerpo, llamadas.length);
        }
    });
    const store = new MemoryConversationStore();
    const bot = crearBot({
        catalogo: catalogoFalso(),
        ajustes: crearAjustes({ numeroAsesor: '51999888777', numeroRespaldo: null }),
        conversacion: store,
        ordenes,
        ahora: () => 1000
    });
    return { bot, store, llamadas };
}

const CREADA = cuerpo => ({
    ok: true,
    status: 201,
    json: async () => ({ id: 90, numeroCliente: 5, total: 24, tipo: cuerpo.tipo, montoPagaCon: cuerpo.montoPagaCon })
});

/** Cart with one product, delivery by recojo and cash chosen: the bot asks the amount. */
async function hastaMonto(bot) {
    await bot.procesar(mensaje('quiero hacer un pedido'));
    await bot.procesar(mensaje('sí'));
    await bot.procesar(mensaje('1'));
    await bot.procesar(mensaje('confirmar'));
    await bot.procesar(mensaje('2'));
    return bot.procesar(mensaje('efectivo'));
}

// ───────────────────────── Order client: status and backend message ─────────────────────────

test('el cliente de órdenes adjunta status y el mensaje del backend al error', async () => {
    const ordenes = crearClienteOrdenes({
        baseUrl: 'http://orders.test',
        fetchImpl: async () => respuestaTexto(400, { error: MENSAJE_NO_CUBRE })
    });
    await assert.rejects(() => ordenes.crear({}), error => {
        assert.strictEqual(error.status, 400);
        assert.strictEqual(error.detalle, MENSAJE_NO_CUBRE);
        return true;
    });
});

test('el cliente de pagos adjunta status y el mensaje del backend al error', async () => {
    const pagos = crearClientePagos({
        baseUrl: 'http://payments.test',
        internalKey: 'clave-interna',
        fetchImpl: async () => respuestaTexto(409, { mensaje: 'La orden 77 ya no está activo para pagos' })
    });
    await assert.rejects(() => pagos.registrarComprobante({ ordenId: 77, comprobanteClave: 'c' }), error => {
        assert.strictEqual(error.status, 409);
        assert.match(error.detalle, /ya no está activo/);
        return true;
    });
});

// ───────────────────────── S10: only a sanction 409 is a sanction ─────────────────────────

test('S10: un 409 que no menciona la sanción conserva el carrito y no bloquea el efectivo', async () => {
    const { bot, store, llamadas } = montarBot(() => respuestaTexto(409, { error: 'La orden ya existe' }));
    await hastaMonto(bot);

    const respuesta = await bot.procesar(mensaje('exacto'));

    assert.strictEqual(llamadas.length, 1);
    assert.match(respuesta, /no pudimos registrar/i);
    assert.doesNotMatch(respuesta, /no podemos aceptar pago en efectivo/i, 'no lo trata como sanción');
    const guardado = await store.get(CELULAR);
    assert.strictEqual(guardado.carrito.length, 1, 'el carrito se conserva');
    assert.ok(!guardado.sancionContraPago, 'no marca el número como sancionado');
});

test('S10 (preserva): un 409 con la sanción en el cuerpo solo deja Yape', async () => {
    const { bot, store } = montarBot(() =>
        respuestaTexto(409, { error: 'Tu número tiene una sanción por pedido fantasma: solo Yape' }));
    await hastaMonto(bot);

    const respuesta = await bot.procesar(mensaje('exacto'));

    assert.match(respuesta, /no podemos aceptar pago en efectivo/i);
    assert.match(respuesta, /Yape/);
    const guardado = await store.get(CELULAR);
    assert.strictEqual(guardado.sancionContraPago, true);
    assert.strictEqual(guardado.estado, 'ESPERANDO_METODO_PAGO');
});

test('S10 (preserva): un 500 de orders-service conserva el carrito y pide reintentar', async () => {
    const { bot, store } = montarBot(() => respuestaTexto(500, 'Internal Server Error'));
    await hastaMonto(bot);

    const respuesta = await bot.procesar(mensaje('exacto'));

    assert.match(respuesta, /no pudimos registrar/i);
    assert.match(respuesta, /confirmar/i);
    const guardado = await store.get(CELULAR);
    assert.strictEqual(guardado.carrito.length, 1);
    assert.ok(!guardado.sancionContraPago);
});

// ───────────────────────── S6: cash amount below the real total ─────────────────────────

test('S6: si el monto no cubre el total (400) vuelve a pedir el monto con el mensaje del backend', async () => {
    const { bot, store, llamadas } = montarBot((cuerpo, n) =>
        n === 1 ? respuestaTexto(400, { error: MENSAJE_NO_CUBRE }) : CREADA(cuerpo));
    await hastaMonto(bot);

    const respuesta = await bot.procesar(mensaje('20'));

    assert.strictEqual(llamadas.length, 1);
    assert.ok(respuesta.includes(MENSAJE_NO_CUBRE), 'repite el mensaje con el total real');
    assert.match(respuesta, /con cu[aá]nto vas a pagar/i, 'vuelve a preguntar el monto');
    const guardado = await store.get(CELULAR);
    assert.strictEqual(guardado.estado, 'ESPERANDO_MONTO_EFECTIVO');
    assert.strictEqual(guardado.montoPagaCon, undefined, 'olvida el monto rechazado');
    assert.strictEqual(guardado.carrito.length, 1);

    const final = await bot.procesar(mensaje('50'));
    assert.strictEqual(llamadas.length, 2, 'el nuevo monto crea la orden');
    assert.strictEqual(llamadas[1].montoPagaCon, 50);
    assert.strictEqual((await store.get(CELULAR)).estado, 'PEDIDO_CONFIRMADO');
    assert.match(final, /recojo en tienda/i);
});

// ───────────────────────── S3: capture for an order that is no longer active ─────────────────────────

function minioFalso() {
    return {
        async bucketExists() { return true; },
        async makeBucket() {},
        async putObject() {}
    };
}

function montarComprobante(fetchPagos) {
    const store = new MemoryConversationStore();
    const pagos = crearClientePagos({ baseUrl: 'http://payments.test', internalKey: 'k', fetchImpl: fetchPagos });
    const bot = crearBot({
        catalogo: catalogoFalso(),
        ajustes: crearAjustes({ numeroAsesor: '51999888777', numeroRespaldo: null }),
        conversacion: store,
        almacenamiento: crearAlmacenamiento({ cliente: minioFalso(), bucket: 'b', ahora: () => 1000 }),
        pagos,
        ahora: () => 1000,
        dormir: async () => {}
    });
    return { bot, store };
}

function imagen() {
    return {
        from: FROM,
        id: 'img-err-1',
        hasMedia: true,
        async downloadMedia() {
            return { mimetype: 'image/jpeg', data: 'Zm90bw==', filename: 'yape.jpg' };
        }
    };
}

const PEDIDO_YAPE = { id: 77, numeroCliente: 3, total: 54, tipo: 'DELIVERY', metodoPago: 'YAPE' };

test('S3: una captura para un pedido que ya no está activo (409) avisa y libera la conversación', async () => {
    const { bot, store } = montarComprobante(async () =>
        respuestaTexto(409, { error: 'La orden 77 ya no está activo: no acepta comprobantes' }));
    await store.set(CELULAR, { estado: 'PEDIDO_CONFIRMADO', pedido: { ...PEDIDO_YAPE } });

    const respuesta = await bot.procesar(imagen());

    assert.match(respuesta, /ya no est[aá] activo/i);
    assert.match(respuesta, /cancelado|finalizado/i);
    assert.match(respuesta, /\*ticket\*/);
    assert.match(respuesta, /\*1\*/);
    assert.doesNotMatch(respuesta, /vuelve a enviarla/i, 'no pide reenviar la captura');
    const guardado = await store.get(CELULAR);
    assert.strictEqual(guardado.estado, 'MENU', 'la conversación queda libre');
    assert.strictEqual(guardado.ultimoPedido.id, 77, 'conserva el ticket');
});

test('S3 (preserva): una captura para un pedido activo se registra y se confirma', async () => {
    const llamadas = [];
    const { bot, store } = montarComprobante(async (url, opciones) => {
        llamadas.push(JSON.parse(opciones.body));
        return { ok: true, status: 201, json: async () => ({ id: 1 }) };
    });
    await store.set(CELULAR, { estado: 'PEDIDO_CONFIRMADO', pedido: { ...PEDIDO_YAPE } });

    const respuesta = await bot.procesar(imagen());

    assert.strictEqual(llamadas.length, 1);
    assert.strictEqual(llamadas[0].ordenId, 77);
    assert.match(respuesta, /administrador/i);
    assert.strictEqual((await store.get(CELULAR)).estado, 'COMPROBANTE_RECIBIDO');
});

test('S3 (preserva): otro 409 de pagos sigue pidiendo reenviar la captura', async () => {
    const { bot, store } = montarComprobante(async () => respuestaTexto(409, { error: 'Comprobante duplicado' }));
    await store.set(CELULAR, { estado: 'PEDIDO_CONFIRMADO', pedido: { ...PEDIDO_YAPE } });

    const respuesta = await bot.procesar(imagen());

    assert.match(respuesta, /no pudimos registrar el comprobante/i);
    assert.strictEqual((await store.get(CELULAR)).estado, 'PEDIDO_CONFIRMADO');
});

// ───────────────────────── S11: CANCELADO releases the conversation ─────────────────────────

async function conApp(conversacion, fn) {
    const store = new MemoryStore();
    const service = new NotificacionService({
        store,
        whatsapp: { esperarListo: async () => {}, obtenerChatId: async n => `${n}@c.us`, enviar: async () => {} },
        intervaloMs: 0,
        maxIntentos: 3
    });
    const app = crearApp({ service, store, conversacion, estadoWhatsapp: () => 'CONECTADO' });
    const servidor = await new Promise(resolve => {
        const s = app.listen(0, () => resolve(s));
    });
    const base = `http://localhost:${servidor.address().port}/api/notificaciones`;
    try {
        return await fn(body => fetch(`${base}/whatsapp/estado`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Internal-Key': process.env.NOTIFICATION_API_KEY },
            body: JSON.stringify(body)
        }));
    } finally {
        await new Promise(resolve => servidor.close(resolve));
        if (typeof service.detener === 'function') service.detener();
    }
}

test('S11: el aviso CANCELADO libera la conversación conservando el ticket', async () => {
    const conversacion = new MemoryConversationStore();
    await conversacion.set(CELULAR, { estado: 'PEDIDO_CONFIRMADO', pedido: { ...PEDIDO_YAPE } });

    await conApp(conversacion, async post => {
        const res = await post({ ordenId: 77, telefono: CELULAR, estadoNuevo: 'CANCELADO' });
        assert.strictEqual(res.status, 202);
    });

    const guardado = await conversacion.get(CELULAR);
    assert.strictEqual(guardado.estado, 'MENU', '"hola" empieza un pedido nuevo');
    assert.strictEqual(guardado.ultimoPedido.id, 77, 'el ticket sigue disponible');
});

test('S11 (preserva): EN_CAMINO sigue liberando y LISTO no toca la conversación', async () => {
    const conversacion = new MemoryConversationStore();
    await conversacion.set(CELULAR, { estado: 'PEDIDO_CONFIRMADO', pedido: { ...PEDIDO_YAPE } });

    await conApp(conversacion, async post => {
        await post({ ordenId: 77, telefono: CELULAR, estadoNuevo: 'LISTO' });
        assert.strictEqual((await conversacion.get(CELULAR)).estado, 'PEDIDO_CONFIRMADO');
        await post({ ordenId: 77, telefono: CELULAR, estadoNuevo: 'EN_CAMINO' });
    });

    assert.strictEqual((await conversacion.get(CELULAR)).estado, 'MENU');
});

test('lee el campo detail de un ProblemDetail de Spring (payments-service)', async () => {
    const { leerDetalle } = require('../src/pedidos/errorHttp');
    const cuerpo = JSON.stringify({ title: 'Operación no permitida', status: 409, detail: 'El pedido #95 ya no está activo (estado CANCELADO)' });
    const detalle = await leerDetalle({ text: async () => cuerpo });
    assert.strictEqual(detalle, 'El pedido #95 ya no está activo (estado CANCELADO)');
});
