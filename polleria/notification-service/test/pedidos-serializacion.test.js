const test = require('node:test');
const assert = require('node:assert');

const handleMessage = require('../src/whatsapp/handler');
const { crearBot } = require('../src/chatbot/chatbot');
const { MemoryConversationStore } = require('../src/chatbot/conversation');
const { SerializadorConversaciones } = require('../src/chatbot/serializador');
const { crearCatalogo } = require('../src/pedidos/catalogo');
const { crearClienteOrdenes } = require('../src/pedidos/ordenes');
const { crearAjustes } = require('../src/outbound/ajustes');

/**
 * T3c (S10/S14) — Serialización de los mensajes de una misma conversación.
 *
 * El defecto declarado en T3b: el handler se invoca por cada evento sin esperar al
 * anterior, así que dos «confirmar» simultáneos con `message.id` distintos podrían abrir
 * dos pedidos. El dedup por id cubre reentregas del mismo mensaje, no dos mensajes
 * distintos. La serialización es por clave (celular normalizado), no global.
 *
 * Determinista: sin red real (catálogo y cliente de órdenes con `fetch` inyectado), sin
 * reloj real y con el store en memoria. Los tests entran por el handler, que es el punto
 * donde vive el defecto, y usan un serializador inyectado para no compartir estado.
 */

const CELULAR = '51999888777';
const FROM = `${CELULAR}@c.us`;
const OTRO_CELULAR = '51988777666';
const OTRO_FROM = `${OTRO_CELULAR}@c.us`;

const PRODUCTOS = [{ id: 1, nombre: 'Cuarto de pollo + papas', precio: 18, disponible: true }];
const ORDEN_CREADA = { id: 77, numeroCliente: 3, total: 24, tipo: 'DELIVERY', canalOrigen: 'WHATSAPP' };

let secuencia = 0;
function mensaje(body, id, from = FROM) {
    secuencia += 1;
    return { from, body, id: id || `t3c-${secuencia}` };
}

function diferido() {
    let resolver;
    const promesa = new Promise(res => { resolver = res; });
    return { promesa, resolver };
}

/** Servicio falso: registra lo que el handler encolaría en la única cola (T4). */
function servicioFalso() {
    const encoladas = [];
    return {
        encoladas,
        async encolarRespuesta(payload) { encoladas.push(payload); }
    };
}

function catalogoFalso() {
    return crearCatalogo({
        baseUrl: 'http://orders.test',
        ttlMs: 60000,
        ahora: () => 1000,
        fetchImpl: async () => ({ ok: true, status: 200, json: async () => PRODUCTOS })
    });
}

function clienteFalso() {
    const llamadas = [];
    const ordenes = crearClienteOrdenes({
        baseUrl: 'http://orders.test',
        fetchImpl: async (url, opciones) => {
            llamadas.push({ url, cuerpo: JSON.parse(opciones.body) });
            return { ok: true, status: 201, json: async () => ({ ...ORDEN_CREADA }) };
        }
    });
    return { ordenes, llamadas };
}

/** Estado listo para crear la orden con un solo «confirmar» (carrito + dirección + referencia). */
function estadoListo(telefono = CELULAR) {
    return {
        estado: 'CATALOGO',
        catalogo: PRODUCTOS,
        carrito: [{ productoId: 1, nombre: 'Cuarto de pollo + papas', precio: 18, cantidad: 1 }],
        direccion: 'Av. Grau 123, Ica',
        referencia: 'Portón azul frente al parque',
        telefono
    };
}

// (a) Dos «confirmar» casi simultáneos del mismo celular crean UNA sola orden.
test('(a) dos confirmar simultáneos con message.id distintos del mismo celular abren una sola orden', async () => {
    const store = new MemoryConversationStore();
    await store.set(CELULAR, estadoListo());
    const { ordenes, llamadas } = clienteFalso();
    const servicio = servicioFalso();
    const serializador = new SerializadorConversaciones();
    const bot = crearBot({
        catalogo: catalogoFalso(),
        ajustes: crearAjustes({}),
        conversacion: store,
        ordenes,
        ahora: () => 1000
    });

    await Promise.all([
        handleMessage(mensaje('confirmar', 'sim-1'), { service: servicio, bot, serializador }),
        handleMessage(mensaje('confirmar', 'sim-2'), { service: servicio, bot, serializador })
    ]);

    assert.strictEqual(llamadas.length, 1, 'las dos confirmaciones simultáneas crean exactamente una orden');
    assert.strictEqual(llamadas[0].cuerpo.telefonoCliente, CELULAR);
    assert.strictEqual((await store.get(CELULAR)).estado, 'PEDIDO_CONFIRMADO');
    assert.strictEqual(servicio.encoladas.length, 2, 'cada mensaje recibe su respuesta, pero solo hay una orden');
    assert.match(servicio.encoladas[0].mensaje, /Pedido registrado/);
    assert.match(servicio.encoladas[1].mensaje, /ya está registrado/);
});

// (b) Una conversación lenta no frena a otro cliente: la serialización es por clave.
test('(b) un celular lento no bloquea a otro celular: cada uno avanza por su cuenta', async () => {
    const servicio = servicioFalso();
    const serializador = new SerializadorConversaciones();
    const compuerta = diferido();

    const bot = {
        async procesar(msg) {
            if (msg.from === FROM) {
                await compuerta.promesa;
                return 'respuesta lenta';
            }
            return 'respuesta rápida';
        }
    };

    const lento = handleMessage(mensaje('confirmar', 'b-1'), { service: servicio, bot, serializador });
    // Dejar que la conversación lenta entre a procesar antes de lanzar la otra.
    await new Promise(res => setImmediate(res));

    await handleMessage(mensaje('confirmar', 'b-2', OTRO_FROM), { service: servicio, bot, serializador });
    assert.deepStrictEqual(
        servicio.encoladas.map(e => e.mensaje),
        ['respuesta rápida'],
        'el segundo celular responde sin esperar al primero'
    );

    compuerta.resolver();
    await lento;
    assert.deepStrictEqual(
        servicio.encoladas.map(e => e.mensaje),
        ['respuesta rápida', 'respuesta lenta']
    );
});

// (c) Orden de llegada: el segundo mensaje ve el estado que dejó el primero.
test('(c) el segundo mensaje de la misma conversación ve el efecto del primero', async () => {
    const store = new MemoryConversationStore();
    const { ordenes } = clienteFalso();
    const servicio = servicioFalso();
    const serializador = new SerializadorConversaciones();
    const bot = crearBot({
        catalogo: catalogoFalso(),
        ajustes: crearAjustes({}),
        conversacion: store,
        ordenes,
        ahora: () => 1000
    });

    // «1» abre la confirmación de Ica; «sí» solo tiene sentido DESPUÉS de ese paso.
    await Promise.all([
        handleMessage(mensaje('1', 'orden-1'), { service: servicio, bot, serializador }),
        handleMessage(mensaje('sí', 'orden-2'), { service: servicio, bot, serializador })
    ]);

    const respuestas = servicio.encoladas.map(e => e.mensaje);
    assert.strictEqual(respuestas.length, 2, 'los dos mensajes generan respuesta en orden');
    assert.match(respuestas[0], /Eres de Ica/);
    assert.match(respuestas[1], /NUESTRA CARTA/, 'el segundo mensaje vio el estado que dejó el primero');
    assert.strictEqual((await store.get(CELULAR)).estado, 'CATALOGO');
});

// (d) La estructura no acumula conversaciones que ya terminaron.
test('(d) la cadena de una conversación se limpia cuando termina', async () => {
    const servicio = servicioFalso();
    const serializador = new SerializadorConversaciones();
    const compuerta = diferido();
    const bot = { async procesar() { await compuerta.promesa; return 'listo'; } };

    const pendiente = handleMessage(mensaje('hola', 'c-1'), { service: servicio, bot, serializador });
    await new Promise(res => setImmediate(res));
    assert.strictEqual(serializador.tamanio, 1, 'mientras procesa, la conversación está registrada');

    compuerta.resolver();
    await pendiente;
    assert.strictEqual(serializador.tamanio, 0, 'terminada la cadena, la entrada se elimina');
});

test('(d) dos mensajes encadenados del mismo celular dejan la estructura limpia al final', async () => {
    const servicio = servicioFalso();
    const serializador = new SerializadorConversaciones();
    const bot = { async procesar() { return 'ok'; } };

    await Promise.all([
        handleMessage(mensaje('uno', 'c-2'), { service: servicio, bot, serializador }),
        handleMessage(mensaje('dos', 'c-3'), { service: servicio, bot, serializador })
    ]);

    assert.strictEqual(serializador.tamanio, 0);
    assert.deepStrictEqual(servicio.encoladas.map(e => e.mensaje), ['ok', 'ok']);
});

// PRESERVE — el enrutador previo sigue igual: grupos/estados ignorados y contrato de encolado intacto.
test('PRESERVE: los grupos y los estados de WhatsApp se siguen ignorando', async () => {
    const servicio = servicioFalso();
    const serializador = new SerializadorConversaciones();
    let llamadas = 0;
    const bot = { async procesar() { llamadas += 1; return 'no debería salir'; } };

    await handleMessage({ from: 'status@broadcast', id: 'g-1', body: 'estado' }, { service: servicio, bot, serializador });
    await handleMessage({ from: '1234567890-123@g.us', id: 'g-2', body: 'grupo' }, { service: servicio, bot, serializador });

    assert.strictEqual(llamadas, 0, 'no se invoca al bot para grupos ni estados');
    assert.strictEqual(servicio.encoladas.length, 0);
    assert.strictEqual(serializador.tamanio, 0, 'ignorar un mensaje no deja una cadena abierta');
});

test('PRESERVE: el handler sigue encolando el texto del bot con chatId y marcarVisto', async () => {
    const servicio = servicioFalso();
    const serializador = new SerializadorConversaciones();
    const bot = { async procesar() { return 'texto del bot'; } };

    await handleMessage({ from: FROM, id: 'p-1', body: 'hola' }, { service: servicio, bot, serializador });

    assert.deepStrictEqual(servicio.encoladas, [
        { chatId: FROM, mensaje: 'texto del bot', marcarVisto: true }
    ]);
});

test('PRESERVE: un bot vacío no encola nada y un error no frena al mensaje siguiente', async () => {
    const servicio = servicioFalso();
    const serializador = new SerializadorConversaciones();
    let n = 0;
    const bot = {
        async procesar() {
            n += 1;
            if (n === 1) return null;
            if (n === 2) throw new Error('boom');
            return 'recuperado';
        }
    };
    const original = console.error;
    console.error = () => {};
    try {
        await handleMessage({ from: FROM, id: 'p-2', body: 'a' }, { service: servicio, bot, serializador });
        await handleMessage({ from: FROM, id: 'p-3', body: 'b' }, { service: servicio, bot, serializador });
        await handleMessage({ from: FROM, id: 'p-4', body: 'c' }, { service: servicio, bot, serializador });
    } finally {
        console.error = original;
    }

    assert.deepStrictEqual(servicio.encoladas.map(e => e.mensaje), ['recuperado']);
    assert.strictEqual(serializador.tamanio, 0, 'un error no deja la conversación trabada');
});
