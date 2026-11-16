const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'secreto-de-prueba-con-al-menos-32-caracteres';
process.env.NOTIFICATION_API_KEY = 'clave-interna';

const config = require('../src/config');
const { crearApp } = require('../src/http/app');
const { MemoryStore, PostgresStore } = require('../src/notifications/store');
const { NotificacionService, WhatsappDesconectadoError } = require('../src/notifications/service');
const { crearClienteMinio } = require('../src/pedidos/almacenamiento');
const { comparacionConstante } = require('../src/http/auth');

async function ticks(n = 30) {
    for (let i = 0; i < n; i += 1) await new Promise(resolve => setImmediate(resolve));
}

test('SEC-05 y CFG-12/13: config sin env no trae secretos JWT ni credenciales MinIO por defecto y puppeteerNoSandbox inicia en false', () => {
    const cacheConfig = require.resolve('../src/config');
    const prevEnv = {
        DOTENV_DISABLE: process.env.DOTENV_DISABLE,
        JWT_SECRET: process.env.JWT_SECRET,
        MINIO_ENDPOINT: process.env.MINIO_ENDPOINT,
        MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY,
        MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY,
        PUPPETEER_NO_SANDBOX: process.env.PUPPETEER_NO_SANDBOX,
        CORS_ALLOW_LOOPBACK: process.env.CORS_ALLOW_LOOPBACK
    };

    process.env.DOTENV_DISABLE = 'true';
    delete process.env.JWT_SECRET;
    delete process.env.MINIO_ENDPOINT;
    delete process.env.MINIO_ACCESS_KEY;
    delete process.env.MINIO_SECRET_KEY;
    delete process.env.PUPPETEER_NO_SANDBOX;
    delete process.env.CORS_ALLOW_LOOPBACK;
    delete require.cache[cacheConfig];

    try {
        const limpio = require('../src/config');
        assert.strictEqual(limpio.jwtSecret, null);
        assert.strictEqual(limpio.minio.endpoint, null);
        assert.strictEqual(limpio.minio.accessKey, null);
        assert.strictEqual(limpio.minio.secretKey, null);
        assert.strictEqual(limpio.puppeteerNoSandbox, false);
        assert.strictEqual(limpio.corsAllowLoopback, false);
    } finally {
        for (const [k, v] of Object.entries(prevEnv)) {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
        }
        delete require.cache[cacheConfig];
        require('../src/config');
    }

    assert.throws(() => crearClienteMinio({}), /Configuración de MinIO incompleta/);
});

test('CFG-15: package.json fija el commit SHA de whatsapp-web.js y no apunta a #main', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));
    const dep = pkg.dependencies['whatsapp-web.js'];
    assert.ok(dep && !dep.endsWith('#main'), `dependencia debe fijar commit SHA, actual: ${dep}`);
    assert.match(dep, /#[0-9a-f]{40}$/);
});

test('SEC-05 y SEC-07: falla cerrado sin clave interna, rechaza token de seguimiento y evita query param ?clave en /qr', async () => {
    const store = new MemoryStore();
    const service = new NotificacionService({
        store,
        whatsapp: { esperarListo: async () => {}, obtenerChatId: async n => `${n}@c.us`, enviar: async () => {} },
        intervaloMs: 0,
        maxIntentos: 1
    });
    const app = crearApp({ service, store, estadoWhatsapp: () => 'ESPERANDO_QR', ultimoQr: () => 'qr-secreto' });
    const srv = app.listen(0);
    const baseUrl = `http://localhost:${srv.address().port}`;
    const claveAnterior = config.internalApiKey;
    const jwtAnterior = config.jwtSecret;

    try {
        config.internalApiKey = null;
        const failClosed = await fetch(`${baseUrl}/api/notificaciones/whatsapp/pago`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ordenId: 1, telefono: '999888777', montoTotal: 10 })
        });
        assert.strictEqual(failClosed.status, 500);

        config.internalApiKey = 'clave-interna';
        const trackingJwt = jwt.sign({ role: 'ADMIN', tipo: 'seguimiento', sub: 'anon' }, jwtAnterior, { algorithm: 'HS256' });
        const trackingRes = await fetch(`${baseUrl}/api/notificaciones/historial`, {
            headers: { Authorization: `Bearer ${trackingJwt}` }
        });
        assert.strictEqual(trackingRes.status, 401);

        assert.strictEqual(comparacionConstante('clave-interna', 'clave-interna'), true);
        assert.strictEqual(comparacionConstante('clave-interna', 'otra'), false);
        assert.strictEqual(comparacionConstante('clave-interna', 'clave-internX'), false);

        // /qr desde una IP no loopback no debe aceptar ?clave=... en query string
        const mockReq = { headers: {}, query: { clave: 'clave-interna' }, socket: { remoteAddress: '203.0.113.10' } };
        const handlerLayer = app._router.stack.find(l => l.route && l.route.path === '/qr');
        let statusCapturado = 200;
        const mockRes = {
            setHeader() {},
            status(code) { statusCapturado = code; return this; },
            send() { return this; }
        };
        await handlerLayer.route.stack[0].handle(mockReq, mockRes, err => { if (err) throw err; });
        assert.strictEqual(statusCapturado, 403);

        mockReq.headers['x-internal-key'] = 'clave-interna';
        statusCapturado = 200;
        await handlerLayer.route.stack[0].handle(mockReq, mockRes, err => { if (err) throw err; });
        assert.strictEqual(statusCapturado, 200);
    } finally {
        config.internalApiKey = claveAnterior;
        config.jwtSecret = jwtAnterior;
        await new Promise(resolve => srv.close(resolve));
    }
});

test('CON-14: desconexión pausa la cola sin consumir maxIntentos y reanuda al reconectar', async () => {
    const store = new MemoryStore();
    const enviados = [];
    let estado = 'CONECTADO';
    let t = 1_000_000;
    const dormidas = [];

    const whatsapp = {
        estado: () => estado,
        esperarListo: async () => {
            if (estado !== 'CONECTADO') {
                throw new WhatsappDesconectadoError('WhatsApp desconectado');
            }
        },
        obtenerChatId: async n => `${n}@c.us`,
        enviar: async (chatId, mensaje) => {
            if (estado !== 'CONECTADO') {
                throw new WhatsappDesconectadoError('Session closed');
            }
            enviados.push({ chatId, mensaje });
        }
    };

    const service = new NotificacionService({
        store,
        whatsapp,
        intervaloMs: 0,
        jitterPct: 0,
        maxIntentos: 2,
        reintentoDesconexionMs: 5000,
        ahora: () => t,
        dormir: ms => new Promise(resolve => dormidas.push({ ms, resolve }))
    });

    // Entra el trabajo 1 estando desconectado desde el envío previo
    estado = 'DESCONECTADO';
    const log = await service.encolar({ ordenId: 10, telefono: '999888777', tipo: 'PAGO_CONFIRMADO', mensaje: 'Hola' });
    await ticks();

    assert.strictEqual(service.pendientes, 1);
    assert.strictEqual(service.estadoConexion().pausada, true);
    assert.strictEqual(service.estadoConexion().motivo, 'whatsapp-desconectado');
    let actual = await store.findById(log.id);
    assert.strictEqual(actual.estado, 'EN_COLA');
    assert.strictEqual(actual.intentos, 0, 'no consume intentos durante desconexión');

    // Reconecta y dispara evento ready -> reanuda de inmediato sin agotar reintentos
    estado = 'CONECTADO';
    service.reanudarPorConexion();
    await ticks();

    assert.strictEqual(service.pendientes, 0);
    assert.strictEqual(enviados.length, 1);
    actual = await store.findById(log.id);
    assert.strictEqual(actual.estado, 'ENVIADO');
    assert.strictEqual(actual.intentos, 1);
});

test('CON-14: error transitorio de sesión durante enviar() reencola al frente sin consumir intentos', async () => {
    const store = new MemoryStore();
    const enviados = [];
    let falloPrimera = true;
    let t = 2_000_000;
    const dormidas = [];

    const service = new NotificacionService({
        store,
        whatsapp: {
            esperarListo: async () => {},
            obtenerChatId: async n => `${n}@c.us`,
            enviar: async (chatId, mensaje) => {
                if (falloPrimera) {
                    falloPrimera = false;
                    throw new Error('Protocol error (Target.sendMessage): Target closed');
                }
                enviados.push({ chatId, mensaje });
            }
        },
        intervaloMs: 0,
        jitterPct: 0,
        maxIntentos: 1,
        reintentoDesconexionMs: 1000,
        ahora: () => t,
        dormir: ms => new Promise(resolve => dormidas.push({ ms, resolve }))
    });

    const log = await service.encolar({ ordenId: 11, telefono: '999888777', tipo: 'ESTADO_EN_CAMINO', mensaje: 'En camino' });
    await ticks();

    let actual = await store.findById(log.id);
    assert.strictEqual(actual.estado, 'EN_COLA');
    assert.strictEqual(actual.intentos, 0);
    assert.strictEqual(service.pendientes, 1);

    t += 1000;
    while (dormidas.length) dormidas.shift().resolve();
    await ticks();

    actual = await store.findById(log.id);
    assert.strictEqual(actual.estado, 'ENVIADO');
    assert.strictEqual(actual.intentos, 1);
    assert.strictEqual(enviados.length, 1);
});

test('CON-19: eventoId deduplica reintentos HTTP y PostgresStore incluye tablas e índice único', async () => {
    const store = new MemoryStore();
    const enviados = [];
    const service = new NotificacionService({
        store,
        whatsapp: {
            esperarListo: async () => {},
            obtenerChatId: async n => `${n}@c.us`,
            enviar: async (chatId, mensaje) => { enviados.push({ chatId, mensaje }); }
        },
        intervaloMs: 0,
        maxIntentos: 2
    });
    const app = crearApp({ service, store, estadoWhatsapp: () => 'CONECTADO' });
    const srv = app.listen(0);
    const base = `http://localhost:${srv.address().port}/api/notificaciones`;

    try {
        const body = { ordenId: 80, telefono: '999888777', montoTotal: 45, eventoId: 'pago-80-aprobado' };
        const res1 = await fetch(`${base}/whatsapp/pago`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Internal-Key': 'clave-interna' },
            body: JSON.stringify(body)
        });
        const res2 = await fetch(`${base}/whatsapp/pago`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Internal-Key': 'clave-interna' },
            body: JSON.stringify(body)
        });

        const j1 = await res1.json();
        const j2 = await res2.json();
        assert.strictEqual(res1.status, 202);
        assert.strictEqual(res2.status, 202);
        assert.strictEqual(j2.notificacionId, j1.notificacionId);

        while (service.pendientes > 0) await ticks();
        assert.strictEqual(enviados.length, 1);
        assert.strictEqual((await store.findAll()).length, 1);
    } finally {
        await new Promise(resolve => srv.close(resolve));
    }

    // Verificar SQL de init() y settings en PostgresStore
    const queries = [];
    const pgStore = Object.create(PostgresStore.prototype);
    pgStore.pool = {
        async query(sql, params) {
            queries.push({ sql, params });
            if (sql.includes('RETURNING settings')) return { rows: [{ settings: JSON.parse(params[0]) }] };
            if (sql.includes('SELECT settings')) return { rows: [{ settings: { presupuestoHora: 12 } }] };
            return { rows: [] };
        }
    };
    await pgStore.init();
    assert.match(queries[0].sql, /uq_notification_log_evento_id/);
    assert.match(queries[0].sql, /CREATE TABLE IF NOT EXISTS notification_settings/);

    const guardado = await pgStore.saveSettings({ presupuestoHora: 12 });
    assert.strictEqual(guardado.presupuestoHora, 12);
    const leido = await pgStore.getSettings();
    assert.strictEqual(leido.presupuestoHora, 12);
});
