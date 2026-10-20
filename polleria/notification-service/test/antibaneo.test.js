process.env.JWT_SECRET = 'secreto-de-prueba-con-al-menos-32-caracteres';
process.env.NOTIFICATION_API_KEY = 'clave-interna';

const test = require('node:test');
const assert = require('node:assert');

const { ColaEnvios } = require('../src/notifications/queue');
const { NotificacionService } = require('../src/notifications/service');
const { MemoryStore } = require('../src/notifications/store');
const { crearApp } = require('../src/http/app');
const handleMessage = require('../src/whatsapp/handler');
const { crearBot } = require('../src/chatbot/chatbot');
const { MemoryConversationStore } = require('../src/chatbot/conversation');
const { crearCatalogo } = require('../src/pedidos/catalogo');

/**
 * T4 (S2/S8) — Anti-baneo I.
 * Todo lo saliente (notificaciones y respuestas del chatbot) pasa por una sola cola.
 * El azar y los timers se inyectan para que las aserciones sean deterministas: aquí no
 * se usa `Math.random` ni `setTimeout` real.
 */

/** Reloj y `dormir` compartidos: solo avanza cuando la cola duerme. */
function relojFalso(inicio = 1_000_000) {
    let t = inicio;
    return {
        ahora: () => t,
        avanzar: ms => { t += ms; },
        dormir: async ms => { t += ms; }
    };
}

function whatsappDePrueba(reloj) {
    const eventos = [];
    let enCurso = 0;
    let solapados = 0;
    return {
        eventos,
        get solapados() { return solapados; },
        esperarListo: async () => {},
        obtenerChatId: async numero => `${numero}@c.us`,
        marcarVisto: async chatId => { eventos.push({ tipo: 'visto', chatId, en: reloj.ahora() }); },
        escribiendo: async (chatId, ms) => { eventos.push({ tipo: 'escribiendo', chatId, ms, en: reloj.ahora() }); },
        enviar: async (chatId, mensaje) => {
            if (enCurso > 0) solapados += 1;
            enCurso += 1;
            eventos.push({ tipo: 'enviar', chatId, mensaje, en: reloj.ahora() });
            enCurso -= 1;
        }
    };
}

function ajustesBase(encima = {}) {
    const { crearAjustes } = require('../src/outbound/ajustes');
    return crearAjustes({
        intervaloMs: 0,
        jitterPct: 0,
        typingMinMs: 1000,
        typingMaxMs: 5000,
        typingMsPorCaracter: 50,
        ...encima
    });
}

function servicioDePrueba({ ajustes, reloj, store = new MemoryStore() } = {}) {
    const whatsapp = whatsappDePrueba(reloj);
    const service = new NotificacionService({
        store,
        whatsapp,
        ajustes: ajustes || ajustesBase(),
        maxIntentos: 1,
        ahora: reloj.ahora,
        dormir: reloj.dormir
    });
    return { service, whatsapp, store };
}

/** Espera a que la cola termine sin usar timers reales. */
async function drenar(service) {
    for (let i = 0; i < 500 && service.pendientes > 0; i += 1) {
        await new Promise(resolve => setImmediate(resolve));
    }
    assert.strictEqual(service.pendientes, 0, 'la cola de envíos no terminó de drenar');
}

test('un mensaje del bot y una notificación comparten la misma cola: nunca a la vez y con espaciado', async () => {
    const reloj = relojFalso();
    const ajustes = ajustesBase({ intervaloMs: 1000, jitterPct: 0, typingMinMs: 0, typingMaxMs: 0, typingMsPorCaracter: 0 });
    const { service, whatsapp } = servicioDePrueba({ ajustes, reloj });

    await service.encolar({ ordenId: 7, telefono: '999888777', tipo: 'PAGO_CONFIRMADO', mensaje: 'Tu pago fue confirmado' });
    service.encolarRespuesta({ chatId: '51999888777@c.us', mensaje: 'Aquí está el menú' });
    await drenar(service);

    const envios = whatsapp.eventos.filter(e => e.tipo === 'enviar');
    assert.strictEqual(envios.length, 2, 'salieron la notificación y la respuesta del bot');
    assert.strictEqual(whatsapp.solapados, 0, 'nunca hay dos envíos a la vez');
    assert.ok(envios[1].en - envios[0].en >= 1000,
        `el segundo envío respeta el espaciado (fue ${envios[1].en - envios[0].en} ms)`);
});

test('el "escribiendo" sale antes del mensaje y dura lo proporcional al texto, entre el mínimo y el máximo', async () => {
    const { duracionEscribiendo } = require('../src/outbound/humanizacion');
    const reloj = relojFalso();
    const ajustes = ajustesBase();
    const { service, whatsapp } = servicioDePrueba({ ajustes, reloj });

    // 60 caracteres * 50 ms = 3000 ms: dentro del rango [1000, 5000]
    const texto = 'x'.repeat(60);
    service.encolarRespuesta({ chatId: '51999888777@c.us', mensaje: texto, marcarVisto: true });
    await drenar(service);

    assert.deepStrictEqual(whatsapp.eventos.map(e => e.tipo), ['visto', 'escribiendo', 'enviar'],
        'marca visto y escribe antes de enviar');
    const escritura = whatsapp.eventos.find(e => e.tipo === 'escribiendo');
    assert.strictEqual(escritura.ms, 3000);

    // El largo manda mientras esté en el rango; fuera del rango mandan el mínimo y el máximo.
    assert.strictEqual(duracionEscribiendo('hola', ajustes.obtener()), 1000);
    assert.strictEqual(duracionEscribiendo(texto, ajustes.obtener()), 3000);
    assert.strictEqual(duracionEscribiendo('y'.repeat(500), ajustes.obtener()), 5000);
});

test('los ajustes anti-baneo viven en memoria: defaults, edición en caliente y validación', async () => {
    const { crearAjustes } = require('../src/outbound/ajustes');
    const ajustes = crearAjustes({
        intervaloMs: 5000, jitterPct: 10, typingMinMs: 1000, typingMaxMs: 4000, typingMsPorCaracter: 40,
        presupuestoHora: 30, presupuestoDia: 200, horaDesde: 11, horaHasta: 23, breakerBaseMs: 60000, breakerMaxMs: 900000
    });
    // T5 suma al MISMO store los números de contacto (S4/S11); la forma exacta de `obtener()`
    // cambia de contrato y sigue siendo un `deepStrictEqual` estricto, no una aserción débil.
    assert.deepStrictEqual(ajustes.obtener(), {
        intervaloMs: 5000, jitterPct: 10, typingMinMs: 1000, typingMaxMs: 4000, typingMsPorCaracter: 40,
        presupuestoHora: 30, presupuestoDia: 200, horaDesde: 11, horaHasta: 23, breakerBaseMs: 60000, breakerMaxMs: 900000,
        numeroAsesor: null, numeroRespaldo: null
    });

    // Edición en caliente (la usará el panel en T5) y descarte del cambio inválido.
    assert.strictEqual(ajustes.actualizar({ intervaloMs: 8000 }).intervaloMs, 8000);
    assert.throws(() => ajustes.actualizar({ jitterPct: 150 }), /jitterPct/);
    assert.throws(() => ajustes.actualizar({ typingMaxMs: 10 }), /typingMaxMs/);
    assert.strictEqual(ajustes.obtener().jitterPct, 10);
    assert.strictEqual(ajustes.obtener().intervaloMs, 8000);

    // Es memoria, no persistencia: una instancia nueva arranca con los defaults.
    assert.strictEqual(crearAjustes({ intervaloMs: 5000 }).obtener().intervaloMs, 5000);

    // La cola lee el ajuste en cada espera: la edición se aplica al próximo envío sin reconstruirla.
    const reloj = relojFalso();
    const pausas = [];
    const cola = new ColaEnvios({
        intervaloMs: () => ajustes.obtener().intervaloMs,
        jitterPct: () => ajustes.obtener().jitterPct,
        azar: () => 0.5, // factor exacto 1: el delay es el base vigente
        ahora: reloj.ahora,
        dormir: async ms => { pausas.push(ms); reloj.avanzar(ms); },
        procesar: async () => {}
    });
    cola.add(1);
    cola.add(2);
    for (let i = 0; i < 500 && cola.pendientes > 0; i += 1) {
        await new Promise(resolve => setImmediate(resolve));
    }
    assert.deepStrictEqual(pausas, [8000]);
});

test('el delay entre dos envíos aplica jitter inyectable: determinista y distinto del base', async () => {
    async function pausasCon(azar) {
        const reloj = relojFalso();
        const pausas = [];
        const cola = new ColaEnvios({
            intervaloMs: 1000,
            jitterPct: 20,
            azar: () => azar,
            ahora: reloj.ahora,
            dormir: async ms => { pausas.push(ms); reloj.avanzar(ms); },
            procesar: async () => {}
        });

        cola.add(1);
        cola.add(2);
        for (let i = 0; i < 500 && cola.pendientes > 0; i += 1) {
            await new Promise(resolve => setImmediate(resolve));
        }
        assert.strictEqual(cola.pendientes, 0);
        return pausas;
    }

    // ±20 % con azar inyectado: 1000 * (1 ± 0.5 * 0.20) → +100 / -100 ms
    assert.deepStrictEqual(await pausasCon(0.75), [1100]);
    assert.deepStrictEqual(await pausasCon(0.25), [900]);
    assert.notStrictEqual((await pausasCon(0.75))[0], 1000, 'el jitter no es el delay base exacto');
});

test('el chatbot ya no envía por su cuenta: devuelve el texto y el handler lo encola', async () => {
    const reloj = relojFalso();
    const { service, whatsapp } = servicioDePrueba({ reloj });

    // T3a (S12): el bot devuelve el texto y, antes de mostrar la carta, confirma que el
    // pedido es de Ica. El catálogo viene inyectado para no tocar la red en el test.
    const bot = crearBot({
        catalogo: crearCatalogo({
            baseUrl: 'http://orders.test',
            fetchImpl: async () => ({
                ok: true, status: 200,
                json: async () => ([{ id: 1, nombre: 'Pollo', precio: 18, disponible: true }])
            })
        }),
        ajustes: ajustesBase(),
        conversacion: new MemoryConversationStore()
    });

    // Si el chatbot volviera a llamar a msg.reply, este test falla a propósito.
    const msg = {
        from: '51911111111@c.us',
        body: 'hola',
        reply: async () => { throw new Error('el chatbot no debe enviar directo con msg.reply'); }
    };

    const pregunta = await bot.procesar({ from: 'otro@c.us', id: 'chat-1', body: '1' });
    assert.match(pregunta, /eres de ica/i);
    const respuesta = await bot.procesar({ from: 'otro@c.us', id: 'chat-2', body: 'si' });
    assert.match(respuesta, /NUESTRA CARTA/, 'processMessage devuelve el texto en lugar de enviarlo');

    await handleMessage(msg, { service, bot });
    await drenar(service);

    const envios = whatsapp.eventos.filter(e => e.tipo === 'enviar');
    assert.strictEqual(envios.length, 1, 'la respuesta del bot salió por la cola');
    assert.match(envios[0].mensaje, /Bienvenido a San Pollo/);
});

test('GET /status conserva el contrato y refleja el estado de la cola', async () => {
    const reloj = relojFalso();
    const { service, store } = servicioDePrueba({ ajustes: ajustesBase({ intervaloMs: 0, jitterPct: 0 }), reloj });
    const app = crearApp({ service, store, estadoWhatsapp: () => 'CONECTADO' });
    const servidor = app.listen(0);
    try {
        const base = `http://localhost:${servidor.address().port}/api/notificaciones`;
        const res = await fetch(`${base}/status`);
        const body = await res.json();

        assert.strictEqual(res.status, 200);
        assert.strictEqual(body.status, 'ok');
        assert.strictEqual(body.whatsapp, 'connected');
        assert.strictEqual(typeof body.colaPendiente, 'number');
        assert.strictEqual(typeof body.cola.enProceso, 'boolean');
    } finally {
        await new Promise(resolve => servidor.close(resolve));
    }
});
