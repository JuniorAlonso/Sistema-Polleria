const test = require('node:test');
const assert = require('node:assert');

const { crearBot } = require('../src/chatbot/chatbot');
const { MemoryConversationStore } = require('../src/chatbot/conversation');
const { crearCatalogo } = require('../src/pedidos/catalogo');
const { crearClienteOrdenes } = require('../src/pedidos/ordenes');
const { crearAjustes } = require('../src/outbound/ajustes');

/**
 * T3b (S1/S4) — Bot de pedidos II: carrito, resumen y alta del DELIVERY anónimo.
 *
 * Determinista: sin red real (catálogo y cliente de órdenes con `fetch` inyectado), sin
 * reloj real y con el store en memoria. El bot devuelve texto (T3a); el handler lo encola.
 *
 * El total que se muestra al confirmar DEBE ser el que devuelve orders-service (con el
 * envío ya sumado por `Orden.recalcularTotal()`, S12); el bot no calcula envío.
 */

const PRODUCTOS = [
    { id: 1, nombre: 'Cuarto de pollo + papas', precio: 18, disponible: true },
    { id: 2, nombre: 'Salchipapa', precio: 12, disponible: true }
];

const CELULAR = '51999888777';
const FROM = `${CELULAR}@c.us`;

// Subtotal del carrito = 2×18 + 12 = 48; el total real incluye el envío (S/ 54).
const ORDEN_CREADA = { id: 77, numeroCliente: 3, total: 54, tipo: 'DELIVERY', canalOrigen: 'WHATSAPP' };

let secuencia = 0;
function mensaje(body, id) {
    secuencia += 1;
    return { from: FROM, body, id: id || `t3b-${secuencia}` };
}

function catalogoFalso(productos = PRODUCTOS) {
    return crearCatalogo({
        baseUrl: 'http://orders.test',
        ttlMs: 60000,
        ahora: () => 1000,
        fetchImpl: async () => ({ ok: true, status: 200, json: async () => productos })
    });
}

/** Cliente de orders-service falso: registra los cuerpos enviados a POST /ordenes. */
function clienteFalso({ total = ORDEN_CREADA.total, fallar = { valor: false } } = {}) {
    const llamadas = [];
    const ordenes = crearClienteOrdenes({
        baseUrl: 'http://orders.test',
        fetchImpl: async (url, opciones) => {
            llamadas.push({ url, cuerpo: JSON.parse(opciones.body) });
            if (fallar.valor) throw new Error('ECONNREFUSED');
            return {
                ok: true,
                status: 201,
                json: async () => ({ ...ORDEN_CREADA, total })
            };
        }
    });
    return { ordenes, llamadas, fallar };
}

function ajustesCon(encima = {}) {
    return crearAjustes({ numeroAsesor: '51999888777', numeroRespaldo: null, ...encima });
}

function montar({ fallar } = {}) {
    const store = new MemoryConversationStore();
    const cliente = clienteFalso({ fallar });
    const bot = crearBot({
        catalogo: catalogoFalso(),
        ajustes: ajustesCon(),
        conversacion: store,
        ordenes: cliente.ordenes,
        ahora: () => 1000
    });
    return { bot, store, cliente };
}

/** Deja la conversación en CATALOGO con la carta ya mostrada. */
async function entrarAlCatalogo(bot, id = 'ica') {
    await bot.procesar(mensaje('quiero hacer un pedido', `${id}-1`));
    return bot.procesar(mensaje('sí', `${id}-2`));
}

// (a) Carrito: agregar por número, sumar cantidad al repetir, quitar y conservar.
test('(a) armar carrito: agregar por número, sumar cantidad, quitar y seguir en el mensaje siguiente', async () => {
    const { bot, store } = montar();
    await entrarAlCatalogo(bot);

    const agregado = await bot.procesar(mensaje('1', 'a1'));
    assert.match(agregado, /Cuarto de pollo \+ papas/, 'agrega el producto por su número');
    assert.match(agregado, /x1/);

    const repetido = await bot.procesar(mensaje('1', 'a2'));
    assert.match(repetido, /Cuarto de pollo \+ papas x2/, 'suma la cantidad al repetir el producto');
    assert.match(repetido, /S\/ 36\.00/, 'el subtotal de la línea suma la cantidad');

    await bot.procesar(mensaje('2', 'a3'));
    const visto = await bot.procesar(mensaje('carrito', 'a4'));
    assert.match(visto, /Cuarto de pollo \+ papas x2/);
    assert.match(visto, /Salchipapa x1/);
    assert.match(visto, /\*Subtotal:\* S\/ 48\.00/);

    const quitado = await bot.procesar(mensaje('quitar 2', 'a5'));
    assert.doesNotMatch(quitado, /Salchipapa/, 'quita el producto indicado');
    assert.match(quitado, /Cuarto de pollo \+ papas x2/, 'el resto del carrito sigue ahí');

    // El carrito vive en el estado persistido: el siguiente mensaje lo sigue viendo.
    const siguiente = await bot.procesar(mensaje('carrito', 'a6'));
    assert.match(siguiente, /Cuarto de pollo \+ papas x2/);
    assert.doesNotMatch(siguiente, /Salchipapa/);

    const guardado = await store.get(CELULAR);
    assert.strictEqual(guardado.estado, 'CATALOGO');
    assert.deepStrictEqual(guardado.carrito, [
        { productoId: 1, nombre: 'Cuarto de pollo + papas', precio: 18, cantidad: 2 }
    ]);
});

// (b) Resumen: muestra los ítems y NO inventa un total con envío propio.
test('(b) el resumen muestra los ítems y no calcula el envío por su cuenta', async () => {
    const { bot } = montar();
    await entrarAlCatalogo(bot);

    await bot.procesar(mensaje('1', 'b1'));
    const resumen = await bot.procesar(mensaje('2', 'b2'));

    assert.match(resumen, /Cuarto de pollo \+ papas x1/);
    assert.match(resumen, /Salchipapa x1/);
    assert.match(resumen, /\*Subtotal:\* S\/ 30\.00/);
    assert.match(resumen, /env[ií]o se suma al confirmar/i, 'aclara que el envío se suma al confirmar');
    assert.doesNotMatch(resumen, /\*Total\*?:?/i, 'no muestra un "total" antes de crear la orden');
    assert.doesNotMatch(resumen, /S\/ 36\.00/, 'no suma el envío fijo (30 + 6) por su cuenta');
});

// (c) Confirmar con dirección crea UNA orden DELIVERY y usa el total de orders-service.
test('(c) confirmar con dirección crea una orden DELIVERY por WhatsApp con el total devuelto', async () => {
    const { bot, cliente, store } = montar();
    await entrarAlCatalogo(bot);
    await bot.procesar(mensaje('1', 'c1'));
    await bot.procesar(mensaje('nota sin cebolla', 'c2'));
    await bot.procesar(mensaje('mi nombre es Ana', 'c3'));

    const pideEntrega = await bot.procesar(mensaje('confirmar', 'c4'));
    assert.match(pideEntrega, /Delivery/, 'primero pregunta delivery o recojo');
    assert.match(pideEntrega, /Recojo en tienda/);
    const pideDireccion = await bot.procesar(mensaje('1', 'c4b'));
    assert.match(pideDireccion, /direcci[oó]n/i, 'para delivery pide la dirección de entrega');
    assert.strictEqual(cliente.llamadas.length, 0, 'todavía no crea la orden');

    const pideReferencia = await bot.procesar(mensaje('Av. Grau 123, Ica', 'c5'));
    assert.match(pideReferencia, /referencia/i, 'luego pide la referencia');
    assert.strictEqual(cliente.llamadas.length, 0, 'sin referencia todavía no crea la orden');

    const pidePago = await bot.procesar(mensaje('Portón azul frente al parque', 'c6'));
    assert.match(pidePago, /Yape/, 'luego pregunta el método de pago');
    assert.match(pidePago, /Efectivo contra entrega/);
    assert.strictEqual(cliente.llamadas.length, 0, 'sin método de pago todavía no crea la orden');

    const final = await bot.procesar(mensaje('1', 'c7'));

    assert.strictEqual(cliente.llamadas.length, 1, 'crea exactamente una orden');
    const { url, cuerpo } = cliente.llamadas[0];
    assert.match(url, /\/ordenes$/);
    assert.strictEqual(cuerpo.tipo, 'DELIVERY');
    assert.strictEqual(cuerpo.canalOrigen, 'WHATSAPP');
    assert.strictEqual(cuerpo.estadoInicial, 'PENDIENTE_PAGO', 'Yape espera la captura en la bandeja del cajero');
    assert.strictEqual(cuerpo.montoPagaCon, undefined, 'Yape no manda monto en efectivo');
    assert.strictEqual(cuerpo.telefonoCliente, CELULAR, 'usa el celular normalizado del remitente');
    assert.strictEqual(cuerpo.direccionEntrega, 'Av. Grau 123, Ica');
    assert.strictEqual(cuerpo.referencia, 'Portón azul frente al parque');
    assert.strictEqual(cuerpo.nombreCliente, 'Ana');
    assert.strictEqual(cuerpo.observaciones, 'sin cebolla');
    assert.deepStrictEqual(cuerpo.items, [{ productoId: 1, cantidad: 1 }]);

    assert.match(final, /N\.° \*?3\*?/, 'informa el número de pedido del servicio');
    assert.match(final, /S\/ 54\.00/, 'usa el total devuelto por orders-service');
    assert.doesNotMatch(final, /S\/ 30\.00/, 'no muestra el subtotal como total final');
    assert.match(final, /coordina el pago/i, 'dice que el equipo coordina el pago');
    // T6f: el dueño pidió que el cliente pague por Yape a un número concreto y mande la captura
    // para que el admin la revise. La aserción vieja («no promete el comprobante») era correcta en
    // T3b, cuando la recepción todavía no existía; ahora se exige lo contrario, con el número.
    assert.match(final, /934 421 442/, 'le dice a qué Yape pagar');
    assert.match(final, /captura|comprobante/i, 'le pide la captura del pago');
    assert.match(final, /15 minutos/, 'avisa el plazo para enviar la captura');
    assert.strictEqual((await store.get(CELULAR)).estado, 'PEDIDO_CONFIRMADO');
});

// (d) Idempotencia: confirmar dos veces (o reentrega del mismo message.id) crea una sola orden.
test('(d) confirmar dos veces y la reentrega del mismo mensaje crean una sola orden', async () => {
    const { bot, cliente } = montar();
    await entrarAlCatalogo(bot);
    await bot.procesar(mensaje('1', 'd1'));
    await bot.procesar(mensaje('confirmar', 'd2'));
    await bot.procesar(mensaje('delivery', 'd2b'));
    await bot.procesar(mensaje('Av. Grau 123', 'd3'));
    await bot.procesar(mensaje('Portón azul', 'd4a'));

    const pago = { from: FROM, body: 'yape', id: 'd4' };
    const final = await bot.procesar(pago);
    assert.match(final, /N\.° \*?3\*?/);
    assert.strictEqual(cliente.llamadas.length, 1);

    // Reentrega exacta del mismo message.id: el dedup no vuelve a ejecutar el paso.
    const reentrega = await bot.procesar({ from: FROM, body: 'yape', id: 'd4' });
    assert.strictEqual(reentrega, null, 'la reentrega no genera respuesta');
    assert.strictEqual(cliente.llamadas.length, 1, 'la reentrega no vuelve a crear la orden');

    // Un segundo "confirmar", con otro id, recuerda el pedido ya creado.
    const segundo = await bot.procesar(mensaje('confirmar', 'd5'));
    assert.match(segundo, /N\.° \*?3\*?/);
    assert.strictEqual(cliente.llamadas.length, 1, 'confirmar de nuevo no crea otra orden');
});

// (e) Fallo explícito: no inventa número de pedido y el carrito se conserva para reintentar.
test('(e) si orders-service falla no hay número de pedido y el carrito queda para reintentar', async () => {
    const { bot, cliente, store } = montar({ fallar: { valor: true } });
    await entrarAlCatalogo(bot);
    await bot.procesar(mensaje('1', 'e1'));
    await bot.procesar(mensaje('confirmar', 'e2'));
    await bot.procesar(mensaje('1', 'e2b'));
    await bot.procesar(mensaje('Av. Grau 123', 'e3'));
    await bot.procesar(mensaje('Portón azul', 'e3b'));

    const fallo = await bot.procesar(mensaje('1', 'e4'));

    assert.match(fallo, /no pudimos registrar tu pedido/i, 'dice que no pudo crear la orden');
    assert.doesNotMatch(fallo, /N\.°\s*\*?\d/, 'no inventa número de pedido');
    assert.match(fallo, /reintentar/i, 'invita a reintentar');

    const guardado = await store.get(CELULAR);
    assert.strictEqual(guardado.estado, 'CATALOGO', 'queda en un estado retryable');
    assert.strictEqual(guardado.carrito.length, 1, 'el carrito no se pierde');

    // El reintento usa el mismo carrito y ahora sí crea la orden.
    cliente.fallar.valor = false;
    const reintento = await bot.procesar(mensaje('confirmar', 'e5'));
    assert.match(reintento, /N\.° \*?3\*?/);
    assert.strictEqual(cliente.llamadas.length, 2);
    assert.deepStrictEqual(cliente.llamadas[1].cuerpo.items, [{ productoId: 1, cantidad: 1 }]);
});

// (f) Confirmar sin dirección no crea nada y la pide.
test('(f) confirmar sin dirección no crea la orden y pide la dirección', async () => {
    const { bot, cliente, store } = montar();
    await entrarAlCatalogo(bot);
    await bot.procesar(mensaje('1', 'f1'));

    await bot.procesar(mensaje('confirmar', 'f2'));
    const respuesta = await bot.procesar(mensaje('1', 'f3'));

    assert.match(respuesta, /direcci[oó]n/i);
    assert.strictEqual(cliente.llamadas.length, 0, 'no crea la orden sin dirección');
    const guardado = await store.get(CELULAR);
    assert.strictEqual(guardado.estado, 'ESPERANDO_DIRECCION');
    assert.strictEqual(guardado.carrito.length, 1, 'no pierde el carrito al pedir la dirección');
});

// (g) Confirmar con el carrito vacío no crea nada.
test('(g) confirmar con el carrito vacío no crea la orden', async () => {
    const { bot, cliente } = montar();
    await entrarAlCatalogo(bot);

    const respuesta = await bot.procesar(mensaje('confirmar', 'g1'));

    assert.match(respuesta, /carrito est[aá] vac[ií]o/i);
    assert.strictEqual(cliente.llamadas.length, 0);
});

// PRESERVE — el catálogo, la confirmación de Ica y las opciones que tocó el cambio siguen igual.
test('PRESERVE: la carta sigue saliendo de GET /productos y las opciones del menú siguen respondiendo', async () => {
    let llamadas = 0;
    const bot = crearBot({
        catalogo: crearCatalogo({
            baseUrl: 'http://orders.test',
            ttlMs: 60000,
            ahora: () => 1000,
            fetchImpl: async () => {
                llamadas += 1;
                return { ok: true, status: 200, json: async () => PRODUCTOS };
            }
        }),
        ajustes: ajustesCon(),
        conversacion: new MemoryConversationStore(),
        ordenes: clienteFalso().ordenes,
        ahora: () => 1000
    });

    const carta = await entrarAlCatalogo(bot);
    assert.match(carta, /\*NUESTRA CARTA\*/);
    assert.match(carta, /1\. Cuarto de pollo \+ papas/);
    assert.match(carta, /S\/ 18\.00/);
    assert.strictEqual(llamadas, 1, 'la carta sale de GET /productos');

    // Las opciones del menú siguen respondiendo desde un número nuevo (estado MENU).
    const otro = '51111111111@c.us';
    assert.match(await bot.procesar({ from: otro, id: 'p1', body: '3' }), /UBICACIÓN Y HORARIOS/);
    assert.match(await bot.procesar({ from: otro, id: 'p2', body: '4' }), /asesor/i);
});
