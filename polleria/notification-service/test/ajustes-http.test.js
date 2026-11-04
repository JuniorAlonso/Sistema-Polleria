process.env.JWT_SECRET = 'secreto-de-prueba-con-al-menos-32-caracteres';
process.env.NOTIFICATION_API_KEY = 'clave-interna';

const test = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');

const { crearApp } = require('../src/http/app');
const { MemoryStore } = require('../src/notifications/store');
const { NotificacionService } = require('../src/notifications/service');
const { crearAjustes } = require('../src/outbound/ajustes');
const { crearGobernador } = require('../src/outbound/gobernador');

/**
 * T5 (S4/S8/S11) — Configuración administrable desde el panel (backend).
 *
 * El store en memoria ya existe (T4/T4b); aquí se expone por HTTP solo a ADMIN:
 * GET devuelve los ajustes vigentes junto con el estado del gobernador y PATCH los
 * edita en caliente. Los defaults de entorno para los números de asesor y respaldo
 * se suman al MISMO store (S4/S8) y se normalizan con `src/notifications/phone.js`.
 *
 * Determinismo: el gobernador usa una hora local fija, así que la ventana horaria no
 * depende de cuándo corre la suite.
 */

const horaLocal = hora => new Date(2026, 0, 5, hora, 30, 0, 0).getTime();

function token(role) {
    return jwt.sign({ role, userId: 1 }, process.env.JWT_SECRET, { subject: 'a@a.com', algorithm: 'HS256' });
}

function ajustesDePrueba(encima = {}) {
    return crearAjustes({
        intervaloMs: 0,
        jitterPct: 20,
        typingMinMs: 1000,
        typingMaxMs: 6000,
        typingMsPorCaracter: 50,
        presupuestoHora: 40,
        presupuestoDia: 500,
        horaDesde: 11,
        horaHasta: 23,
        breakerBaseMs: 60000,
        breakerMaxMs: 900000,
        numeroAsesor: null,
        numeroRespaldo: null,
        numeroYape: '51934421442',
        ...encima
    });
}

function montarApp(encima = {}) {
    const ajustes = ajustesDePrueba(encima);
    const store = new MemoryStore();
    const ahora = () => horaLocal(12);
    const gobernador = crearGobernador({ ajustes, ahora });
    const service = new NotificacionService({
        store,
        whatsapp: {
            esperarListo: async () => {},
            obtenerChatId: async numero => `${numero}@c.us`,
            enviar: async () => {}
        },
        ajustes,
        gobernador,
        maxIntentos: 1,
        ahora,
        dormir: async () => {}
    });
    const app = crearApp({ service, store, estadoWhatsapp: () => 'CONECTADO' });
    return { app, service, ajustes, gobernador };
}

/** Levanta la app en un puerto libre, corre el cuerpo y siempre cierra el servidor. */
async function conApp(encima, cuerpo) {
    const ctx = montarApp(encima);
    const servidor = ctx.app.listen(0);
    try {
        const base = `http://localhost:${servidor.address().port}/api/notificaciones`;
        await cuerpo({ ...ctx, base });
    } finally {
        await new Promise(resolve => servidor.close(resolve));
    }
}

const conAdmin = { Authorization: `Bearer ${token('ADMIN')}` };

async function patchAjustes(base, cambios, headers = conAdmin) {
    const res = await fetch(`${base}/ajustes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(cambios)
    });
    return { status: res.status, body: await res.json() };
}

test('GET /ajustes es solo ADMIN y devuelve los ajustes vigentes con el estado del gobernador', async () => {
    await conApp({}, async ({ base, ajustes }) => {
        const sinToken = await fetch(`${base}/ajustes`);
        assert.strictEqual(sinToken.status, 401);

        const cliente = await fetch(`${base}/ajustes`, { headers: { Authorization: `Bearer ${token('CLIENTE')}` } });
        assert.strictEqual(cliente.status, 403);

        const res = await fetch(`${base}/ajustes`, { headers: conAdmin });
        const body = await res.json();
        assert.strictEqual(res.status, 200);
        assert.deepStrictEqual(body.ajustes, ajustes.obtener(), 'devuelve el store vigente completo');

        // El gobernador (pausa, presupuesto consumido, ventana y breaker) viaja junto a los ajustes.
        assert.strictEqual(body.gobernador.pausada, false);
        assert.deepStrictEqual(body.gobernador.presupuestoHora, { enviados: 0, limite: 40 });
        assert.deepStrictEqual(body.gobernador.presupuestoDia, { enviados: 0, limite: 500 });
        assert.deepStrictEqual(body.gobernador.ventana, { horaDesde: 11, horaHasta: 23, operativoTodoElDia: false, abierta: true });
        assert.strictEqual(body.gobernador.breaker.estado, 'cerrado');
    });
});

test('PATCH /ajustes es solo ADMIN, aplica el cambio en caliente y se ve en GET y en /status', async () => {
    await conApp({}, async ({ base }) => {
        const sinToken = await fetch(`${base}/ajustes`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intervaloMs: 1 })
        });
        assert.strictEqual(sinToken.status, 401);

        const cliente = await fetch(`${base}/ajustes`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token('CLIENTE')}` },
            body: JSON.stringify({ intervaloMs: 1 })
        });
        assert.strictEqual(cliente.status, 403);

        const res = await patchAjustes(base, { presupuestoHora: 7, intervaloMs: 2500 });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.presupuestoHora, 7, 'devuelve la configuración resultante completa');
        assert.strictEqual(res.body.intervaloMs, 2500);
        assert.strictEqual(typeof res.body.jitterPct, 'number', 'la respuesta trae todos los campos, no solo los cambiados');

        const vista = await fetch(`${base}/ajustes`, { headers: conAdmin });
        const { ajustes } = await vista.json();
        assert.strictEqual(ajustes.presupuestoHora, 7);
        assert.strictEqual(ajustes.intervaloMs, 2500);

        const status = await fetch(`${base}/status`);
        const estado = await status.json();
        assert.strictEqual(estado.antiBaneo.presupuestoHora.limite, 7, 'el gobernador lee la edición en caliente');
    });
});

test('el ADMIN puede activar y desactivar operativoTodoElDia; el gobernador refleja la ventana abierta sin cambiar horarios', async () => {
    await conApp({ horaDesde: 11, horaHasta: 23 }, async ({ base, ajustes, service }) => {
        const antes = ajustes.obtener();
        const activar = await patchAjustes(base, { operativoTodoElDia: true });
        assert.strictEqual(activar.status, 200);
        assert.strictEqual(activar.body.operativoTodoElDia, true);
        assert.strictEqual(activar.body.horaDesde, 11);
        assert.strictEqual(activar.body.horaHasta, 23);
        assert.strictEqual(service.estadoAntiBaneo().ventana.abierta, true);
        assert.strictEqual(ajustes.obtener().horaDesde, antes.horaDesde);

        const desactivar = await patchAjustes(base, { operativoTodoElDia: false });
        assert.strictEqual(desactivar.status, 200);
        assert.strictEqual(desactivar.body.operativoTodoElDia, false);
    });
});

test('operativoTodoElDia requiere booleano y solo ADMIN puede modificarlo', async () => {
    await conApp({}, async ({ base, ajustes }) => {
        const antes = ajustes.obtener();
        const cliente = await patchAjustes(base, { operativoTodoElDia: true }, { Authorization: `Bearer ${token('CLIENTE')}` });
        assert.strictEqual(cliente.status, 403);
        const invalido = await patchAjustes(base, { operativoTodoElDia: 'true' });
        assert.strictEqual(invalido.status, 400);
        assert.deepStrictEqual(ajustes.obtener(), antes);
    });
});

test('PATCH /ajustes con valores inválidos responde 400 y deja el store exactamente como estaba', async () => {
    await conApp({ jitterPct: 10, typingMinMs: 1000, typingMaxMs: 5000 }, async ({ base, ajustes }) => {
        const antes = ajustes.obtener();

        const jitter = await patchAjustes(base, { jitterPct: 150 });
        assert.strictEqual(jitter.status, 400);
        assert.match(jitter.body.error, /jitterPct/);

        const typing = await patchAjustes(base, { typingMaxMs: 500 });
        assert.strictEqual(typing.status, 400);
        assert.match(typing.body.error, /typingMaxMs/);

        assert.deepStrictEqual(ajustes.obtener(), antes, 'un cambio inválido no modifica el store en memoria');
    });
});

test('los números de asesor y respaldo se guardan normalizados y el respaldo vacío es válido', async () => {
    await conApp({}, async ({ base, ajustes }) => {
        const guardar = await patchAjustes(base, { numeroAsesor: '999 888 777', numeroRespaldo: '987654321' });

        // T6f: el número de Yape de la pollería también es configuración del admin y se normaliza.
        // Se prueba con otro número para que el test no pueda pasar por el default del store.
        const yape = await patchAjustes(base, { numeroYape: '987 654 321' });
        assert.strictEqual(yape.body.numeroYape, '51987654321', 'guarda el número de Yape normalizado');
        assert.strictEqual(guardar.status, 200);
        assert.strictEqual(guardar.body.numeroAsesor, '51999888777');
        assert.strictEqual(guardar.body.numeroRespaldo, '51987654321');

        // El respaldo es opcional: vacío lo deja en null sin tocar al asesor.
        const limpiar = await patchAjustes(base, { numeroRespaldo: '' });
        assert.strictEqual(limpiar.status, 200);
        assert.strictEqual(limpiar.body.numeroRespaldo, null);
        assert.strictEqual(ajustes.obtener().numeroAsesor, '51999888777');

        // Ausente: el respaldo sigue igual.
        const ausente = await patchAjustes(base, { presupuestoHora: 5 });
        assert.strictEqual(ausente.status, 200);
        assert.strictEqual(ausente.body.numeroRespaldo, null);

        // Formato inválido: 400 y no pisa el valor vigente.
        const invalido = await patchAjustes(base, { numeroAsesor: '123' });
        assert.strictEqual(invalido.status, 400);
        assert.match(invalido.body.error, /numeroAsesor/);
        assert.strictEqual(ajustes.obtener().numeroAsesor, '51999888777');
    });
});

test('el PATCH no persiste: el cambio vive solo en memoria y un store nuevo arranca con los defaults', async () => {
    await conApp({}, async ({ base, ajustes }) => {
        const res = await patchAjustes(base, { presupuestoHora: 3, numeroAsesor: '999888777' });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(ajustes.obtener().presupuestoHora, 3);

        // "Reiniciar el proceso" devuelve los defaults: no hay archivo ni tabla de ajustes.
        const reiniciado = ajustesDePrueba();
        assert.strictEqual(reiniciado.obtener().presupuestoHora, 40);
        assert.strictEqual(reiniciado.obtener().numeroAsesor, null);
    });
});
