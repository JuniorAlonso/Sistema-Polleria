process.env.JWT_SECRET = 'secreto-de-prueba-con-al-menos-32-caracteres';
process.env.NOTIFICATION_API_KEY = 'clave-interna';

const test = require('node:test');
const assert = require('node:assert');

const { NotificacionService } = require('../src/notifications/service');
const { MemoryStore } = require('../src/notifications/store');
const { crearAjustes } = require('../src/outbound/ajustes');
const { crearGobernador } = require('../src/outbound/gobernador');
const { detectarSenalDeBloqueo } = require('../src/outbound/breaker');
const { dentroDeVentana } = require('../src/outbound/limites');
const { crearApp } = require('../src/http/app');

/**
 * T4b (S2/S8) — Anti-baneo II: presupuesto por hora/día, ventana horaria y circuit breaker.
 *
 * Determinismo: el reloj es manual y `dormir` queda pendiente hasta que el test lo suelta,
 * así que no se usa `setTimeout` real ni `Math.random`. Los timestamps se construyen con
 * componentes LOCALES (`new Date(2026, 0, 5, hora, ...)`), de modo que la hora que ve la
 * ventana horaria es la misma en cualquier zona del mundo.
 */

const MS_HORA = 3600000;
const MS_DIA = 24 * MS_HORA;

/** Timestamp con hora local conocida (no depende de cuándo corre la suite). */
const horaLocal = (hora, dia = 5, minuto = 0) => new Date(2026, 0, dia, hora, minuto, 0, 0).getTime();

async function ticks(n = 40) {
    for (let i = 0; i < n; i += 1) await new Promise(resolve => setImmediate(resolve));
}

/** Reloj manual: cada `dormir` queda pendiente hasta que el test lo suelta con `soltar`. */
function relojManual(inicio) {
    let t = inicio;
    const dormidas = [];
    return {
        ahora: () => t,
        avanzar: ms => { t += ms; },
        dormir: ms => new Promise(resolve => dormidas.push({ ms, resolve })),
        pendientes: () => dormidas.length,
        async soltar(salto = null) {
            for (let i = 0; i < 2000 && dormidas.length === 0; i += 1) {
                await new Promise(resolve => setImmediate(resolve));
            }
            assert.ok(dormidas.length > 0, 'la cola no pidió esperar');
            const { ms, resolve } = dormidas.shift();
            t += salto === null ? ms : salto;
            resolve();
            await ticks();
        }
    };
}

/** `errores[i]` es lo que lanza el envío i (null = sale bien). */
function whatsappDePrueba(errores = []) {
    let llamadas = 0;
    const enviados = [];
    return {
        enviados,
        esperarListo: async () => {},
        obtenerChatId: async numero => `${numero}@c.us`,
        enviar: async (chatId, mensaje) => {
            const error = errores[llamadas] ?? null;
            llamadas += 1;
            if (error) throw error;
            enviados.push({ chatId, mensaje });
        }
    };
}

function ajustesCon(encima = {}) {
    return crearAjustes({
        intervaloMs: 0,
        jitterPct: 0,
        typingMinMs: 0,
        typingMaxMs: 0,
        typingMsPorCaracter: 0,
        presupuestoHora: 40,
        presupuestoDia: 400,
        horaDesde: 11,
        horaHasta: 23,
        breakerBaseMs: 1000,
        breakerMaxMs: 8000,
        ...encima
    });
}

function servicioCon(reloj, { ajustes = ajustesCon(), whatsapp = whatsappDePrueba(), store = new MemoryStore() } = {}) {
    const gobernador = crearGobernador({ ajustes, ahora: reloj.ahora });
    const service = new NotificacionService({
        store, whatsapp, ajustes, gobernador,
        maxIntentos: 3, ahora: reloj.ahora, dormir: reloj.dormir
    });
    return { service, whatsapp, store, gobernador };
}

async function pedirStatus(service, store) {
    const app = crearApp({ service, store, estadoWhatsapp: () => 'CONECTADO' });
    const servidor = app.listen(0);
    try {
        const url = `http://localhost:${servidor.address().port}/api/notificaciones/status`;
        const res = await fetch(url);
        return { status: res.status, body: await res.json() };
    } finally {
        await new Promise(resolve => servidor.close(resolve));
    }
}

test('el criterio de detección de bloqueo es explícito, heurístico y legible', () => {
    assert.strictEqual(detectarSenalDeBloqueo(new Error('rate-overlimit')).senal, 'rate-overlimit');
    assert.strictEqual(detectarSenalDeBloqueo(new Error('Too Many Requests')).senal, 'too-many-requests');
    assert.strictEqual(detectarSenalDeBloqueo(new Error('Request failed with status 429')).senal, 'http-429');
    assert.strictEqual(detectarSenalDeBloqueo(new Error('This number is blocked')).senal, 'numero-bloqueado');
    assert.strictEqual(detectarSenalDeBloqueo(new Error('Fallo temporal')), null);
    assert.strictEqual(detectarSenalDeBloqueo(null), null);

    // La ventana [11, 23) va de las 11:00 a las 22:59; 23:00 ya está cerrada.
    assert.strictEqual(dentroDeVentana(10, { horaDesde: 11, horaHasta: 23 }), false);
    assert.strictEqual(dentroDeVentana(11, { horaDesde: 11, horaHasta: 23 }), true);
    assert.strictEqual(dentroDeVentana(22, { horaDesde: 11, horaHasta: 23 }), true);
    assert.strictEqual(dentroDeVentana(23, { horaDesde: 11, horaHasta: 23 }), false);
});

test('presupuesto por hora agotado: la cola se pausa, /status lo dice y reanuda a la hora nueva', async () => {
    const reloj = relojManual(horaLocal(12));
    const ajustes = ajustesCon({ presupuestoHora: 1, presupuestoDia: 100 });
    const { service, store } = servicioCon(reloj, { ajustes });

    await service.encolar({ ordenId: 1, telefono: '999888777', tipo: 'PAGO_CONFIRMADO', mensaje: 'uno' });
    await ticks();
    assert.strictEqual(service.pendientes, 0, 'el primer mensaje sale');

    await service.encolar({ ordenId: 2, telefono: '999888777', tipo: 'PAGO_CONFIRMADO', mensaje: 'dos' });
    await ticks();
    assert.strictEqual(service.pendientes, 1, 'el trabajo queda pendiente, no se descarta');

    const { status, body } = await pedirStatus(service, store);
    assert.strictEqual(status, 200);
    assert.strictEqual(body.cola.pausada, true);
    assert.strictEqual(body.cola.motivo, 'presupuesto-hora');
    assert.strictEqual(body.antiBaneo.presupuestoHora.enviados, 1);
    assert.strictEqual(body.antiBaneo.presupuestoHora.limite, 1);

    await reloj.soltar();
    await ticks();
    assert.strictEqual(service.pendientes, 0, 'reanuda cuando abre la hora nueva');
    const logs = await store.findAll();
    assert.deepStrictEqual(logs.map(l => l.estado).sort(), ['ENVIADO', 'ENVIADO']);
});

test('presupuesto por día agotado: la cola se pausa y reanuda con el día nuevo', async () => {
    const reloj = relojManual(horaLocal(12));
    const ajustes = ajustesCon({ presupuestoHora: 100, presupuestoDia: 1 });
    const { service, store } = servicioCon(reloj, { ajustes });

    await service.encolar({ ordenId: 1, telefono: '999888777', tipo: 'PAGO_CONFIRMADO', mensaje: 'uno' });
    await ticks();
    await service.encolar({ ordenId: 2, telefono: '999888777', tipo: 'PAGO_CONFIRMADO', mensaje: 'dos' });
    await ticks();

    assert.strictEqual(service.pendientes, 1);
    const { body } = await pedirStatus(service, store);
    assert.strictEqual(body.cola.motivo, 'presupuesto-dia');
    assert.strictEqual(body.antiBaneo.presupuestoDia.enviados, 1);

    // Se suelta un día entero: ya es el día siguiente a la misma hora, dentro de la ventana.
    await reloj.soltar(MS_DIA);
    await ticks();
    assert.strictEqual(service.pendientes, 0, 'reanuda con el día nuevo');
    const logs = await store.findAll();
    assert.deepStrictEqual(logs.map(l => l.estado).sort(), ['ENVIADO', 'ENVIADO']);
});

test('fuera de la ventana horaria el trabajo sigue pendiente y /status reporta el motivo', async () => {
    const reloj = relojManual(horaLocal(3));
    const { service, store, whatsapp } = servicioCon(reloj, { ajustes: ajustesCon() });

    await service.encolar({ ordenId: 1, telefono: '999888777', tipo: 'PAGO_CONFIRMADO', mensaje: 'fuera' });
    await ticks();

    assert.strictEqual(service.pendientes, 1, 'no se descarta: sigue en la cola');
    assert.strictEqual((await store.findAll())[0].estado, 'EN_COLA', 'el log no se marca como error');
    assert.strictEqual(whatsapp.enviados.length, 0, 'no salió nada fuera de la ventana');

    const { body } = await pedirStatus(service, store);
    assert.strictEqual(body.cola.pausada, true);
    assert.strictEqual(body.cola.motivo, 'fuera-de-ventana');
    assert.strictEqual(body.antiBaneo.ventana.abierta, false);

    // A las 11:00 arranca la ventana y el trabajo pendiente sale.
    await reloj.soltar(8 * MS_HORA);
    await ticks();
    assert.strictEqual(service.pendientes, 0);
    assert.strictEqual(whatsapp.enviados.length, 1);
});

test('una señal de rate-overlimit abre el breaker, el backoff crece y la cola reanuda al vencer', async () => {
    const reloj = relojManual(horaLocal(12));
    const ajustes = ajustesCon({ breakerBaseMs: 1000, breakerMaxMs: 8000 });
    const whatsapp = whatsappDePrueba([
        new Error('rate-overlimit'),
        new Error('rate-overlimit'),
        null
    ]);
    const { service, store } = servicioCon(reloj, { ajustes, whatsapp });

    await service.encolar({ ordenId: 1, telefono: '999888777', tipo: 'PAGO_CONFIRMADO', mensaje: 'x' });
    await ticks();

    let estado = service.estadoAntiBaneo();
    assert.strictEqual(estado.breaker.estado, 'abierto');
    assert.strictEqual(estado.breaker.senal, 'rate-overlimit');
    assert.strictEqual(estado.breaker.reintentoEn, 1000);
    assert.strictEqual(estado.pausada, true);
    assert.strictEqual(estado.motivo, 'circuit-breaker');
    assert.strictEqual(service.pendientes, 1, 'el trabajo no se pierde');

    // Vence el backoff, se prueba un envío y vuelve a fallar: el backoff se duplica.
    await reloj.soltar();
    estado = service.estadoAntiBaneo();
    assert.strictEqual(estado.breaker.estado, 'abierto');
    assert.strictEqual(estado.breaker.reintentoEn, 2000, 'el backoff creció');

    // Vence el segundo backoff: el envío de prueba sale bien y el breaker cierra.
    await reloj.soltar();
    await ticks();
    estado = service.estadoAntiBaneo();
    assert.strictEqual(estado.breaker.estado, 'cerrado');
    assert.strictEqual(service.pendientes, 0);
    assert.strictEqual((await store.findAll())[0].estado, 'ENVIADO');
});

test('el breaker no pierde trabajos encolados', async () => {
    const reloj = relojManual(horaLocal(12));
    const ajustes = ajustesCon({ breakerBaseMs: 500, breakerMaxMs: 4000 });
    const whatsapp = whatsappDePrueba([new Error('rate-overlimit'), null, null]);
    const { service, store } = servicioCon(reloj, { ajustes, whatsapp });

    await service.encolar({ ordenId: 1, telefono: '999888777', tipo: 'PAGO_CONFIRMADO', mensaje: 'A' });
    await service.encolar({ ordenId: 2, telefono: '999888777', tipo: 'PAGO_CONFIRMADO', mensaje: 'B' });
    await ticks();

    assert.strictEqual(service.pendientes, 2, 'los dos trabajos siguen ahí tras abrirse el breaker');

    await reloj.soltar();
    await ticks();
    assert.strictEqual(service.pendientes, 0);
    const logs = await store.findAll();
    assert.deepStrictEqual(logs.map(l => l.estado).sort(), ['ENVIADO', 'ENVIADO']);
    assert.strictEqual(whatsapp.enviados.length, 2);
});

test('la configuración nueva del anti-baneo se valida y se aplica en caliente', () => {
    const ajustes = ajustesCon({ presupuestoHora: 1 });
    assert.throws(() => ajustes.actualizar({ presupuestoHora: 0 }), /presupuestoHora/);
    assert.throws(() => ajustes.actualizar({ horaDesde: 24 }), /horaDesde/);
    assert.throws(() => ajustes.actualizar({ breakerMaxMs: 10 }), /breakerMaxMs/);
    assert.strictEqual(ajustes.obtener().presupuestoHora, 1, 'el cambio inválido no se aplica');

    const gobernador = crearGobernador({ ajustes, ahora: () => horaLocal(12) });
    gobernador.registrarExito();
    assert.strictEqual(gobernador.motivoDePausa().motivo, 'presupuesto-hora');
    ajustes.actualizar({ presupuestoHora: 2 });
    assert.strictEqual(gobernador.motivoDePausa(), null, 'la edición en caliente se lee al vuelo');
});
