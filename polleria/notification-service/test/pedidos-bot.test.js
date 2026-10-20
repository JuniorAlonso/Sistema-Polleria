const test = require('node:test');
const assert = require('node:assert');

const { crearBot } = require('../src/chatbot/chatbot');
const {
    MemoryConversationStore,
    PostgresConversationStore,
    crearConversationStore
} = require('../src/chatbot/conversation');
const { crearCatalogo } = require('../src/pedidos/catalogo');
const { crearAjustes } = require('../src/outbound/ajustes');

/**
 * T3a (S1/S4/S12) — Bot de pedidos I: catálogo real de orders-service con cache corto,
 * confirmación de que el pedido es de Ica, estado de conversación persistido, dedup por
 * `message.id` y número del asesor.
 *
 * Determinista: sin red real (fetch inyectado), sin reloj real (TTL y dedup con `ahora`
 * fijo) y con el store en memoria cuando no se prueba la persistencia.
 */

let secuencia = 0;
function mensaje(body, id) {
    secuencia += 1;
    return { from: '51999888777@c.us', body, id: id || `msg-${secuencia}` };
}

function ajustesCon(encima = {}) {
    return crearAjustes({ numeroAsesor: '51999888777', numeroRespaldo: null, ...encima });
}

function catalogoFalso(productos, contador = { llamadas: 0 }) {
    const catalogo = crearCatalogo({
        baseUrl: 'http://orders.test',
        ttlMs: 60000,
        ahora: () => 1000,
        fetchImpl: async url => {
            contador.llamadas += 1;
            assert.match(url, /\/productos$/);
            return { ok: true, status: 200, json: async () => productos };
        }
    });
    return { catalogo, contador };
}

function montar({ catalogo, conversacion, ajustes } = {}) {
    const productos = [{ id: 1, nombre: 'Cuarto de pollo + papas', precio: 18, disponible: true }];
    const cat = catalogo || catalogoFalso(productos).catalogo;
    const store = conversacion || new MemoryConversationStore();
    const aj = ajustes === undefined ? ajustesCon() : ajustes;
    return {
        bot: crearBot({ catalogo: cat, ajustes: aj, conversacion: store, ahora: () => 1000 }),
        catalogo: cat,
        conversacion: store
    };
}

/** Simula la base de datos compartida para probar la persistencia sin Postgres. */
function poolFalso() {
    const filas = new Map();
    return {
        filas,
        async query(sql, params = []) {
            const texto = String(sql).trim().toUpperCase();
            if (texto.startsWith('CREATE')) return { rows: [] };
            if (texto.startsWith('SELECT')) {
                const estado = filas.get(params[0]);
                return { rows: estado === undefined ? [] : [{ estado }] };
            }
            if (texto.startsWith('INSERT')) {
                filas.set(params[0], params[1]);
                return { rows: [] };
            }
            if (texto.startsWith('DELETE')) {
                filas.delete(params[0]);
                return { rows: [] };
            }
            return { rows: [] };
        }
    };
}

// (a) Confirmación de Ica — primer paso obligatorio del pedido.
test('el primer mensaje que pide un pedido pregunta si es de Ica y no, no avanza y ofrece el asesor', async () => {
    const { bot } = montar();

    const primera = await bot.procesar(mensaje('quiero hacer un pedido', 'a1'));
    assert.match(primera, /delivery es en \*Ica\*/i, 'pregunta si el pedido es de Ica');
    assert.match(primera, /eres de ica/i);

    const rechazo = await bot.procesar(mensaje('no', 'a2'));
    assert.match(rechazo, /cubre solo \*Ica\*/i, 'informa que el delivery cubre solo Ica');
    assert.match(rechazo, /\+51 999 888 777/, 'ofrece el número del asesor');
    assert.doesNotMatch(rechazo, /\*NUESTRA CARTA\*/, 'no avanza con el pedido');
});

test('responder que sí avanza al catálogo real', async () => {
    const { bot } = montar();

    await bot.procesar(mensaje('hacer un pedido', 'a3'));
    const catalogo = await bot.procesar(mensaje('sí', 'a4'));

    assert.match(catalogo, /\*NUESTRA CARTA\*/);
    assert.match(catalogo, /Cuarto de pollo \+ papas/);
    assert.match(catalogo, /S\/ 18\.00/);
});

// (b) Catálogo real + cache corto.
test('el catálogo sale de GET /productos y el cache evita la segunda llamada', async () => {
    const { catalogo, contador } = catalogoFalso([
        { id: 9, nombre: 'Salchipapa de prueba', descripcion: 'con todo', precio: 12, disponible: true }
    ]);
    const { bot } = montar({ catalogo });

    await bot.procesar(mensaje('quiero un pedido', 'b1'));
    const visible = await bot.procesar(mensaje('sí', 'b2'));
    assert.match(visible, /Salchipapa de prueba/, 'un producto no hardcodeado aparece en el mensaje');
    assert.match(visible, /S\/ 12\.00/);
    assert.strictEqual(contador.llamadas, 1);

    await bot.procesar(mensaje('muéstrame la carta otra vez', 'b3'));
    assert.strictEqual(contador.llamadas, 1, 'el cache evita una segunda llamada seguida');
});

// (c) orders-service caído: no se inventa carta.
test('si orders-service falla, el bot avisa que no puede tomar el pedido y ofrece el asesor', async () => {
    const catalogo = crearCatalogo({
        baseUrl: 'http://orders.test',
        fetchImpl: async () => { throw new Error('ECONNREFUSED'); }
    });
    const { bot } = montar({ catalogo });

    await bot.procesar(mensaje('quiero un pedido', 'c1'));
    const respuesta = await bot.procesar(mensaje('sí', 'c2'));

    assert.match(respuesta, /no podemos tomar tu pedido/i);
    assert.match(respuesta, /\+51 999 888 777/);
    assert.doesNotMatch(respuesta, /\*NUESTRA CARTA\*/);
    assert.doesNotMatch(respuesta, /S\//, 'no inventa precios');
});

test('si orders-service responde con error, tampoco se inventa el catálogo', async () => {
    const catalogo = crearCatalogo({
        baseUrl: 'http://orders.test',
        fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) })
    });
    const { bot } = montar({ catalogo });

    await bot.procesar(mensaje('quiero un pedido', 'c3'));
    const respuesta = await bot.procesar(mensaje('sí', 'c4'));

    assert.match(respuesta, /no podemos tomar tu pedido/i);
    assert.doesNotMatch(respuesta, /\*NUESTRA CARTA\*/);
});

test('sin números configurados el bot no ofrece un número inexistente', async () => {
    const { bot } = montar({
        ajustes: crearAjustes({ numeroAsesor: null, numeroRespaldo: null })
    });

    await bot.procesar(mensaje('quiero un pedido', 'c5'));
    const respuesta = await bot.procesar(mensaje('no', 'c6'));

    assert.match(respuesta, /no tenemos un número de asesor/i);
    assert.doesNotMatch(respuesta, /\+51/);
});

test('el respaldo se usa cuando no hay número de asesor', async () => {
    const { bot } = montar({
        ajustes: crearAjustes({ numeroAsesor: null, numeroRespaldo: '987654321' })
    });

    await bot.procesar(mensaje('quiero un pedido', 'c7'));
    const respuesta = await bot.procesar(mensaje('no', 'c8'));

    assert.match(respuesta, /\+51 987 654 321/);
});

// (d) Dedup por message.id.
test('el mismo message.id procesado dos veces ejecuta un solo paso', async () => {
    const { bot, conversacion } = montar();

    const primera = await bot.procesar(mensaje('quiero un pedido', 'mismo-id'));
    assert.match(primera, /eres de ica/i);

    const reentrega = await bot.procesar(mensaje('quiero un pedido', 'mismo-id'));
    assert.strictEqual(reentrega, null, 'la reentrega no genera respuesta');

    const guardado = await conversacion.get('51999888777');
    assert.strictEqual(guardado.estado, 'CONFIRMANDO_ICA', 'el estado avanzó una sola vez');
});

// (e) Persistencia y fallback en memoria.
test('sin DATABASE_URL el estado usa el fallback en memoria y el flujo funciona', async () => {
    const store = crearConversationStore(undefined);
    assert.ok(store instanceof MemoryConversationStore);

    const { bot } = montar({ conversacion: store });
    await bot.procesar(mensaje('quiero un pedido', 'e1'));
    const respuesta = await bot.procesar(mensaje('sí', 'e2'));

    assert.match(respuesta, /\*NUESTRA CARTA\*/);
});

test('el estado de conversación sobrevive a reconstruir el bot (misma base)', async () => {
    const pool = poolFalso();
    const productos = [{ id: 3, nombre: 'Pollo entero', precio: 65, disponible: true }];
    const { catalogo } = catalogoFalso(productos);

    const storeA = new PostgresConversationStore('postgres://x', { pool });
    await storeA.init();
    const botA = crearBot({ catalogo, ajustes: ajustesCon(), conversacion: storeA });
    await botA.procesar(mensaje('quiero hacer un pedido', 'p1'));

    // "Reinicio del servicio": store y bot nuevos, misma base.
    const storeB = new PostgresConversationStore('postgres://x', { pool });
    await storeB.init();
    const botB = crearBot({ catalogo, ajustes: ajustesCon(), conversacion: storeB });
    const respuesta = await botB.procesar(mensaje('sí', 'p2'));

    assert.match(respuesta, /Pollo entero/, 'continúa donde quedó antes del reinicio');
});

test('el store de conversación guarda, lee y borra por celular normalizado', async () => {
    const store = new MemoryConversationStore();
    await store.set('51999888777', 'CONFIRMANDO_ICA');
    assert.strictEqual((await store.get('51999888777')).estado, 'CONFIRMANDO_ICA');
    await store.del('51999888777');
    assert.strictEqual(await store.get('51999888777'), null);
});

// PRESERVE — opciones del menú que ya existían antes de T3a.
test('las opciones 2, 3 y 4 del menú siguen respondiendo', async () => {
    const { bot } = montar();

    assert.match(await bot.procesar(mensaje('hola', 'z1')), /Bienvenido a San Pollo/);
    assert.match(await bot.procesar(mensaje('3', 'z3')), /UBICACIÓN Y HORARIOS/);
    assert.match(await bot.procesar(mensaje('4', 'z4')), /asesor/i);
    assert.match(await bot.procesar(mensaje('2', 'z5')), /Código de Pedido/);
    assert.match(await bot.procesar(mensaje('4827', 'z6')), /4827/);
});

test('la opción 1 del menú inicia el pedido con la confirmación de Ica', async () => {
    const { bot } = montar();
    assert.match(await bot.procesar(mensaje('1', 'y1')), /eres de ica/i);
});

/**
 * T7 (S13) — El dueño pidió que, en vez de una bandeja de conversaciones, el bot ofrezca
 * **llamar** a un asesor: el número del admin que conecta WhatsApp y, si ese faltara, el de
 * respaldo. El comportamiento ya existía (nace de `lineaContacto` en T3a); estas pruebas lo fijan
 * porque hasta ahora solo estaba cubierto por los caminos de «no es de Ica» y de servicio caído.
 */
test('la opción 4 del menú ofrece llamar al asesor con el número configurado', async () => {
    const { bot } = montar();
    const respuesta = await bot.procesar(mensaje('4', 'asesor-1'));

    assert.match(respuesta, /asesor/i, 'dice que un asesor atiende');
    assert.match(respuesta, /\+51 999 888 777/, 'da el número del asesor para llamarlo');
});

test('sin número de asesor, la opción 4 ofrece el de respaldo', async () => {
    const { bot } = montar({ ajustes: ajustesCon({ numeroAsesor: null, numeroRespaldo: '987654321' }) });

    assert.match(await bot.procesar(mensaje('4', 'asesor-2')), /\+51 987 654 321/,
        'cae al número de respaldo cuando el del asesor no está configurado');
});

test('sin asesor ni respaldo no se inventa un número de contacto', async () => {
    const { bot } = montar({ ajustes: ajustesCon({ numeroAsesor: null, numeroRespaldo: null }) });

    assert.match(await bot.procesar(mensaje('4', 'asesor-3')), /no tenemos un número de asesor/i);
});
