const test = require('node:test');
const assert = require('node:assert');

const { crearBot } = require('../src/chatbot/chatbot');
const { MemoryConversationStore } = require('../src/chatbot/conversation');
const { crearCatalogo } = require('../src/pedidos/catalogo');
const { crearClienteOrdenes } = require('../src/pedidos/ordenes');
const { crearAjustes } = require('../src/outbound/ajustes');

/**
 * S3/S4: the bot must not leave a confused customer stuck or unanswered, and a customer who lost
 * or deleted the ticket message must be able to get it back from WhatsApp. The active orders are
 * looked up in orders-service by the chat's phone (GET /ordenes/activas-por-telefono).
 */

const PRODUCTOS = [{ id: 1, nombre: 'Cuarto de pollo + papas', precio: 18, disponible: true }];
const CELULAR = '51999888777';
const FROM = `${CELULAR}@c.us`;

let secuencia = 0;
function mensaje(body) {
    secuencia += 1;
    return { from: FROM, body, id: `robusto-${secuencia}` };
}

function catalogoFalso() {
    return crearCatalogo({
        baseUrl: 'http://orders.test',
        ttlMs: 60000,
        ahora: () => 1000,
        fetchImpl: async () => ({ ok: true, status: 200, json: async () => PRODUCTOS })
    });
}

function orden(id, extra = {}) {
    return {
        id, numeroCliente: id - 90, total: 18, tipo: 'RECOJO', estado: 'PENDIENTE_PAGO',
        telefonoCliente: '999888777', creadoEn: new Date().toISOString(),
        items: [{ productoId: 1, cantidad: 1, productoNombre: 'Cuarto de pollo + papas' }], ...extra
    };
}

/**
 * orders-service double. `activos` is what the phone lookup returns; `crear` decides what
 * POST /ordenes does. Every request is recorded.
 */
function montar({ activos = [], crear, porId = {} } = {}) {
    const peticiones = [];
    const ordenes = crearClienteOrdenes({
        baseUrl: 'http://orders.test',
        internalKey: 'clave-bot',
        fetchImpl: async (url, opciones = {}) => {
            peticiones.push({ url, opciones });
            if (url.includes('/ordenes/activas-por-telefono')) {
                return { ok: true, status: 200, json: async () => activos };
            }
            if (opciones.method === 'POST') {
                return crear ? crear() : { ok: true, status: 201, json: async () => orden(95) };
            }
            if (opciones.method === 'PATCH') {
                return { ok: true, status: 200, json: async () => orden(95, { estado: 'CANCELADO' }) };
            }
            const id = Number(url.split('/').pop());
            const encontrada = porId[id];
            return encontrada
                ? { ok: true, status: 200, json: async () => encontrada }
                : { ok: false, status: 404, text: async () => '' };
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
    return { bot, store, peticiones };
}

test('S4: quien perdió el ticket lo recupera escribiendo "perdí mi ticket" aunque el chat no recuerde el pedido', async () => {
    const { bot, peticiones } = montar({ activos: [orden(95)] });

    const r = await bot.procesar(mensaje('perdí mi ticket'));

    assert.match(r, /POL-95/);
    const consulta = peticiones.find(p => p.url.includes('/ordenes/activas-por-telefono'));
    assert.ok(consulta, 'debe buscar los pedidos activos del celular');
    assert.match(consulta.url, /telefono=51999888777/);
    assert.strictEqual(consulta.opciones.headers['X-Internal-Key'], 'clave-bot');
});

test('S4: con varios pedidos activos los lista todos con su código', async () => {
    const { bot } = montar({ activos: [orden(95), orden(97, { tipo: 'DELIVERY', estado: 'EN_CAMINO' })] });

    const r = await bot.procesar(mensaje('mi pedido'));

    assert.match(r, /POL-95/);
    assert.match(r, /POL-97/);
});

test('S4: "se me borró el mensaje" y "ya no tengo mi codigo" también recuperan el ticket', async () => {
    for (const frase of ['se me borró el mensaje', 'ya no tengo mi codigo', 'donde esta mi pedido']) {
        const { bot } = montar({ activos: [orden(95)] });
        const r = await bot.procesar(mensaje(frase));
        assert.match(r, /POL-95/, `"${frase}" debe devolver el ticket`);
    }
});

test('S3: "mi pedido" sin pedidos activos avisa que no hay ticket, no abre un pedido nuevo', async () => {
    const { bot } = montar({ activos: [] });

    const r = await bot.procesar(mensaje('mi pedido'));

    assert.doesNotMatch(r, /Ica/);
    assert.match(r, /No encontramos un pedido/);
});

test('Preserva: "quiero hacer mi pedido" sigue empezando un pedido', async () => {
    const { bot } = montar();

    const r = await bot.procesar(mensaje('quiero hacer mi pedido'));

    assert.match(r, /Ica/);
});

test('S3: tras "salir" con un pedido activo, "cancelar" lo cancela en vez de quedarse en silencio', async () => {
    const { bot, peticiones } = montar({ porId: { 95: orden(95) } });
    await bot.procesar(mensaje('quiero hacer un pedido'));
    await bot.procesar(mensaje('sí'));
    await bot.procesar(mensaje('1'));
    await bot.procesar(mensaje('confirmar'));
    await bot.procesar(mensaje('2'));
    await bot.procesar(mensaje('1'));
    await bot.procesar(mensaje('salir'));

    const r = await bot.procesar(mensaje('cancelar'));

    assert.ok(r, 'el bot debe responder');
    assert.match(r, /cancelado/i);
    assert.ok(peticiones.some(p => p.opciones.method === 'PATCH'), 'debe cancelar en orders-service');
});

test('S3: "cancelar" sin pedido activo responde en vez de quedarse en silencio', async () => {
    const { bot } = montar();

    const r = await bot.procesar(mensaje('cancelar'));

    assert.ok(r, 'el bot debe responder');
    assert.match(r, /no tienes un pedido/i);
});

test('S3: un texto que el bot no entiende en el menú recibe ayuda con las opciones', async () => {
    for (const texto of ['asdfg', 'ola', 'quiero algo rico', '9']) {
        const { bot } = montar();
        const r = await bot.procesar(mensaje(texto));
        assert.ok(r, `"${texto}" no puede quedar sin respuesta`);
        assert.match(r, /1️⃣/, `"${texto}" debe mostrar las opciones`);
    }
});

test('S3: con un pedido abierto, "hola" le dice al cliente cómo salir, cancelar o ver su ticket', async () => {
    const { bot } = montar();
    await bot.procesar(mensaje('quiero hacer un pedido'));
    await bot.procesar(mensaje('sí'));
    await bot.procesar(mensaje('1'));
    await bot.procesar(mensaje('confirmar'));
    await bot.procesar(mensaje('2'));
    await bot.procesar(mensaje('1'));

    const r = await bot.procesar(mensaje('hola'));

    assert.match(r, /ya está registrado/);
    assert.match(r, /\*salir\*/);
    assert.match(r, /\*cancelar\*/);
    assert.match(r, /\*ticket\*/);
});

test('S3: si el alta del pedido se corta pero orders-service sí lo creó, no se crea un duplicado', async () => {
    let posts = 0;
    const creada = orden(95, { tipo: 'RECOJO' });
    const { bot, peticiones } = montar({
        activos: [creada],
        crear: () => {
            posts += 1;
            const corte = new Error('The operation was aborted');
            corte.name = 'AbortError';
            throw corte;
        }
    });
    await bot.procesar(mensaje('quiero hacer un pedido'));
    await bot.procesar(mensaje('sí'));
    await bot.procesar(mensaje('1'));
    await bot.procesar(mensaje('confirmar'));
    await bot.procesar(mensaje('2'));

    const r = await bot.procesar(mensaje('1'));

    assert.strictEqual(posts, 1);
    assert.match(r, /Pedido registrado/i, 'debe reconocer el pedido que sí se creó');
    assert.match(r, /POL-95/);
    assert.ok(peticiones.some(p => p.url.includes('activas-por-telefono')));
});

test('Preserva: si el alta se corta y no hay pedido creado, el carrito se conserva para reintentar', async () => {
    const { bot, store } = montar({
        activos: [],
        crear: () => { throw new Error('fetch failed'); }
    });
    await bot.procesar(mensaje('quiero hacer un pedido'));
    await bot.procesar(mensaje('sí'));
    await bot.procesar(mensaje('1'));
    await bot.procesar(mensaje('confirmar'));
    await bot.procesar(mensaje('2'));

    const r = await bot.procesar(mensaje('1'));

    assert.doesNotMatch(r, /Pedido registrado/i);
    const guardado = await store.get(CELULAR);
    assert.strictEqual(guardado.carrito.length, 1);
});
