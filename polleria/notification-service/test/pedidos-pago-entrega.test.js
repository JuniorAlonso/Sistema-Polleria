const test = require('node:test');
const assert = require('node:assert');

const { crearBot } = require('../src/chatbot/chatbot');
const { MemoryConversationStore } = require('../src/chatbot/conversation');
const { crearCatalogo } = require('../src/pedidos/catalogo');
const { crearClienteOrdenes } = require('../src/pedidos/ordenes');
const { crearAjustes } = require('../src/outbound/ajustes');

/**
 * WhatsApp checkout: delivery mode (Delivery / Recojo) and payment method (Yape / cash ContraPago).
 *
 * Yape orders open in PENDIENTE_PAGO so the capture reaches the cashier inbox; cash orders open in
 * PENDIENTE_CONFIRMACION so the cashier calls first. A number sanctioned for a ghost order gets a
 * 409 from orders-service and can only pay with Yape. Deterministic: fetch and store are doubles.
 */

const PRODUCTOS = [{ id: 1, nombre: 'Cuarto de pollo + papas', precio: 18, disponible: true }];
const CELULAR = '51999888777';
const FROM = `${CELULAR}@c.us`;

let secuencia = 0;
function mensaje(body) {
    secuencia += 1;
    return { from: FROM, body, id: `pago-${secuencia}` };
}

function catalogoFalso() {
    return crearCatalogo({
        baseUrl: 'http://orders.test',
        ttlMs: 60000,
        ahora: () => 1000,
        fetchImpl: async () => ({ ok: true, status: 200, json: async () => PRODUCTOS })
    });
}

/** orders-service double: answers 409 for cash while `sancionado.valor` is true. */
function clienteFalso({ sancionado = { valor: false }, respuesta = {} } = {}) {
    const llamadas = [];
    const ordenes = crearClienteOrdenes({
        baseUrl: 'http://orders.test',
        fetchImpl: async (url, opciones) => {
            const cuerpo = JSON.parse(opciones.body);
            llamadas.push(cuerpo);
            if (sancionado.valor && cuerpo.estadoInicial === 'PENDIENTE_CONFIRMACION') {
                return { ok: false, status: 409, json: async () => ({ error: 'sancion' }) };
            }
            return {
                ok: true,
                status: 201,
                json: async () => ({ id: 90, numeroCliente: 5, total: 18, tipo: cuerpo.tipo, ...respuesta })
            };
        }
    });
    return { ordenes, llamadas, sancionado };
}

function montar(opciones) {
    const store = new MemoryConversationStore();
    const cliente = clienteFalso(opciones);
    const bot = crearBot({
        catalogo: catalogoFalso(),
        ajustes: crearAjustes({ numeroAsesor: '51999888777', numeroRespaldo: null }),
        conversacion: store,
        ordenes: cliente.ordenes,
        ahora: () => 1000
    });
    return { bot, store, cliente };
}

/** Cart with one product and "confirmar" sent: the bot is asking the delivery mode. */
async function hastaEntrega(bot) {
    await bot.procesar(mensaje('quiero hacer un pedido'));
    await bot.procesar(mensaje('sí'));
    await bot.procesar(mensaje('1'));
    return bot.procesar(mensaje('confirmar'));
}

test('recojo + efectivo: no pide dirección, pide el monto y abre el pedido en PENDIENTE_CONFIRMACION', async () => {
    const { bot, cliente, store } = montar({ respuesta: { montoPagaCon: 50, vueltoEstimado: 32 } });
    await hastaEntrega(bot);

    const pidePago = await bot.procesar(mensaje('2'));
    assert.match(pidePago, /Efectivo al recoger en tienda/, 'recojo no pregunta dirección y ofrece efectivo al recoger');

    const pideMonto = await bot.procesar(mensaje('efectivo'));
    assert.match(pideMonto, /con cu[aá]nto vas a pagar/i);
    assert.strictEqual(cliente.llamadas.length, 0);

    const final = await bot.procesar(mensaje('50'));

    assert.strictEqual(cliente.llamadas.length, 1, 'crea exactamente una orden');
    const cuerpo = cliente.llamadas[0];
    assert.strictEqual(cuerpo.tipo, 'RECOJO');
    assert.strictEqual(cuerpo.estadoInicial, 'PENDIENTE_CONFIRMACION', 'el cajero llama antes de cocinar');
    assert.strictEqual(cuerpo.montoPagaCon, 50);
    assert.strictEqual(cuerpo.direccionEntrega, undefined, 'recojo no manda dirección');
    assert.match(final, /recojo en tienda/i);
    assert.match(final, /te llamaremos/i, 'avisa la llamada de confirmación');
    assert.match(final, /15 minutos/);
    assert.match(final, /vuelto ser[aá] \*S\/ 32\.00\*/, 'usa el vuelto calculado por orders-service');
    assert.doesNotMatch(final, /captura/i, 'en efectivo no pide captura');

    const guardado = await store.get(CELULAR);
    assert.strictEqual(guardado.estado, 'PEDIDO_CONFIRMADO');
    assert.strictEqual(guardado.pedido.metodoPago, 'EFECTIVO');
});

test('delivery + efectivo "exacto" no manda monto para vuelto', async () => {
    const { bot, cliente } = montar();
    await hastaEntrega(bot);
    await bot.procesar(mensaje('delivery'));
    await bot.procesar(mensaje('Av. Grau 123, Ica'));
    const pidePago = await bot.procesar(mensaje('sin referencia'));
    assert.match(pidePago, /Efectivo contra entrega/);
    await bot.procesar(mensaje('2'));

    const final = await bot.procesar(mensaje('exacto'));

    assert.strictEqual(cliente.llamadas.length, 1);
    assert.strictEqual(cliente.llamadas[0].tipo, 'DELIVERY');
    assert.strictEqual(cliente.llamadas[0].estadoInicial, 'PENDIENTE_CONFIRMACION');
    assert.strictEqual(cliente.llamadas[0].montoPagaCon, undefined);
    assert.match(final, /al repartidor/i);
});

test('un monto inválido o menor al pedido se vuelve a preguntar sin crear la orden', async () => {
    const { bot, cliente } = montar();
    await hastaEntrega(bot);
    await bot.procesar(mensaje('2'));
    await bot.procesar(mensaje('2'));

    assert.match(await bot.procesar(mensaje('mucho')), /con cu[aá]nto vas a pagar/i);
    assert.match(await bot.procesar(mensaje('10')), /debe cubrir tu pedido/i, 'S/ 10 no cubre S/ 18');
    assert.match(await bot.procesar(mensaje('5000')), /con cu[aá]nto vas a pagar/i, 'un monto absurdo no se acepta');
    assert.strictEqual(cliente.llamadas.length, 0);
});

test('una respuesta que no es opción repite la pregunta de entrega y la de pago', async () => {
    const { bot, cliente } = montar();
    assert.match(await hastaEntrega(bot), /Delivery/);
    assert.match(await bot.procesar(mensaje('mañana')), /Recojo en tienda/, 'repite la pregunta de entrega');
    await bot.procesar(mensaje('2'));
    assert.match(await bot.procesar(mensaje('tarjeta')), /Yape/, 'repite la pregunta de pago');
    assert.strictEqual(cliente.llamadas.length, 0);
});

test('número sancionado: el efectivo se rechaza (409) y solo queda Yape', async () => {
    const { bot, cliente, store } = montar({ sancionado: { valor: true } });
    await hastaEntrega(bot);
    await bot.procesar(mensaje('2'));
    await bot.procesar(mensaje('2'));

    const sancion = await bot.procesar(mensaje('exacto'));
    assert.match(sancion, /no podemos aceptar pago en efectivo/i);
    assert.match(sancion, /Yape/);
    assert.doesNotMatch(sancion, /N\.°/, 'no inventa un número de pedido');
    assert.strictEqual((await store.get(CELULAR)).estado, 'ESPERANDO_METODO_PAGO');

    const otraVez = await bot.procesar(mensaje('efectivo'));
    assert.match(otraVez, /no podemos aceptar pago en efectivo/i, 'no vuelve a ofrecer el efectivo');
    assert.strictEqual(cliente.llamadas.length, 1, 'no reintenta el efectivo contra orders-service');

    const final = await bot.procesar(mensaje('1'));
    assert.strictEqual(cliente.llamadas.length, 2);
    assert.strictEqual(cliente.llamadas[1].estadoInicial, 'PENDIENTE_PAGO');
    assert.match(final, /captura/i);
});

test('una imagen en un pedido en efectivo no se registra como comprobante', async () => {
    const { bot } = montar();
    await hastaEntrega(bot);
    await bot.procesar(mensaje('2'));
    await bot.procesar(mensaje('2'));
    await bot.procesar(mensaje('exacto'));

    secuencia += 1;
    const respuesta = await bot.procesar({ from: FROM, id: `pago-${secuencia}`, hasMedia: true, type: 'image' });
    assert.match(respuesta, /no necesitas enviar ninguna captura/i);
});
