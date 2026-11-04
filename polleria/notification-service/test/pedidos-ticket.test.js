const test = require('node:test');
const assert = require('node:assert');

const { crearBot } = require('../src/chatbot/chatbot');
const { MemoryConversationStore, liberarConservandoTicket } = require('../src/chatbot/conversation');
const { crearCatalogo } = require('../src/pedidos/catalogo');
const { crearClienteOrdenes } = require('../src/pedidos/ordenes');
const { crearAjustes } = require('../src/outbound/ajustes');

/**
 * Pickup/delivery ticket by WhatsApp: the ticket code is POL-<order id>, the code the cashier
 * checks at the pickup counter. The customer gets it when the order is created and can ask for
 * it again ("ticket" or menu option 5), also after the conversation was released by a payment
 * or status notification. The current state comes from orders-service.
 */

const PRODUCTOS = [{ id: 1, nombre: 'Cuarto de pollo + papas', precio: 18, disponible: true }];
const CELULAR = '51999888777';
const FROM = `${CELULAR}@c.us`;

let secuencia = 0;
function mensaje(body) {
    secuencia += 1;
    return { from: FROM, body, id: `ticket-${secuencia}` };
}

function catalogoFalso() {
    return crearCatalogo({
        baseUrl: 'http://orders.test',
        ttlMs: 60000,
        ahora: () => 1000,
        fetchImpl: async () => ({ ok: true, status: 200, json: async () => PRODUCTOS })
    });
}

/** orders-service double: POST /ordenes creates order 95; GET /ordenes/95 returns `actual`. */
function clienteFalso(actual = {}) {
    const consultas = [];
    const ordenes = crearClienteOrdenes({
        baseUrl: 'http://orders.test',
        fetchImpl: async (url, opciones) => {
            if (opciones && opciones.method === 'POST') {
                return { ok: true, status: 201, json: async () => ({ id: 95, numeroCliente: 4, total: 18, tipo: 'RECOJO' }) };
            }
            consultas.push(url);
            return {
                ok: true,
                status: 200,
                json: async () => ({ id: 95, numeroCliente: 4, total: 18, tipo: 'RECOJO', estado: 'LISTO_PARA_ENTREGAR', telefonoCliente: CELULAR, ...actual })
            };
        }
    });
    return { ordenes, consultas };
}

function montar(actual) {
    const store = new MemoryConversationStore();
    const cliente = clienteFalso(actual);
    const bot = crearBot({
        catalogo: catalogoFalso(),
        ajustes: crearAjustes({ numeroAsesor: '51999888777', numeroRespaldo: null }),
        conversacion: store,
        ordenes: cliente.ordenes,
        ahora: () => 1000
    });
    return { bot, store, cliente };
}

async function pedidoRecojoYape(bot) {
    await bot.procesar(mensaje('quiero hacer un pedido'));
    await bot.procesar(mensaje('sí'));
    await bot.procesar(mensaje('1'));
    await bot.procesar(mensaje('confirmar'));
    await bot.procesar(mensaje('2'));
    return bot.procesar(mensaje('1'));
}

test('la confirmación del pedido incluye el ticket con el código POL que verifica el cajero', async () => {
    const { bot } = montar();
    const final = await pedidoRecojoYape(bot);

    assert.match(final, /TICKET/i);
    assert.match(final, /POL-95/, 'el código es POL-<id>, el mismo que compara la bandeja de recojo');
    assert.match(final, /ticket\*? cuando quieras/i, 'explica cómo volver a pedirlo');
});

test('"ticket" lo reenvía con el estado actual que devuelve orders-service', async () => {
    const { bot, cliente } = montar();
    await pedidoRecojoYape(bot);

    const ticket = await bot.procesar(mensaje('Ticket'));

    assert.match(ticket, /POL-95/);
    assert.match(ticket, /N\.° \*?4/);
    assert.match(ticket, /listo para recoger/i, 'usa el estado real del pedido');
    assert.match(ticket, /presenta este c[oó]digo/i);
    assert.strictEqual(cliente.consultas.length, 1);
    assert.match(cliente.consultas[0], /\/ordenes\/95$/);
});

test('tras liberar la conversación (pago aprobado) el ticket sigue disponible con la opción 5 del menú', async () => {
    const { bot, store } = montar();
    await pedidoRecojoYape(bot);

    await liberarConservandoTicket(store, CELULAR);
    const guardado = await store.get(CELULAR);
    assert.strictEqual(guardado.estado, 'MENU', 'la conversación vuelve al menú');
    assert.strictEqual(guardado.ultimoPedido.id, 95, 'pero conserva el último pedido');

    const menu = await bot.procesar(mensaje('hola'));
    assert.match(menu, /Ver mi ticket/i, 'el menú ofrece la opción del ticket');

    const ticket = await bot.procesar(mensaje('5'));
    assert.match(ticket, /POL-95/);
});

test('cancelar un pedido nuevo en curso no pierde el ticket del pedido anterior', async () => {
    const { bot } = montar();
    await pedidoRecojoYape(bot);
    await bot.procesar(mensaje('cancelar'));

    const ticket = await bot.procesar(mensaje('mi ticket'));
    assert.match(ticket, /POL-95/);
});

test('sin pedido en este chat no inventa un ticket', async () => {
    const { bot } = montar();
    const respuesta = await bot.procesar(mensaje('ticket'));

    assert.match(respuesta, /no encontramos un pedido/i);
    assert.doesNotMatch(respuesta, /POL-/);
});

test('un pedido cancelado no se presenta como ticket válido', async () => {
    const { bot } = montar({ estado: 'CANCELADO' });
    await pedidoRecojoYape(bot);

    const respuesta = await bot.procesar(mensaje('ticket'));
    assert.match(respuesta, /cancelado/i);
    assert.match(respuesta, /no es v[aá]lido/i);
});

test('si orders-service no responde muestra el ticket guardado sin inventar el estado', async () => {
    const store = new MemoryConversationStore();
    let creado = false;
    const ordenes = crearClienteOrdenes({
        baseUrl: 'http://orders.test',
        fetchImpl: async (url, opciones) => {
            if (opciones && opciones.method === 'POST') {
                creado = true;
                return { ok: true, status: 201, json: async () => ({ id: 95, numeroCliente: 4, total: 18 }) };
            }
            throw new Error('ECONNREFUSED');
        }
    });
    const bot = crearBot({ catalogo: catalogoFalso(), ajustes: crearAjustes({}), conversacion: store, ordenes, ahora: () => 1000 });
    await pedidoRecojoYape(bot);
    assert.ok(creado);

    const ticket = await bot.procesar(mensaje('ticket'));
    assert.match(ticket, /POL-95/);
    assert.doesNotMatch(ticket, /Estado:/, 'sin respuesta del servicio no muestra un estado');
});
