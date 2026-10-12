const test = require('node:test');
const assert = require('node:assert');

const { normalizarTelefono } = require('../src/notifications/phone');
const { mensajePago, mensajeEstado, mensajeCodigo } = require('../src/notifications/messages');
const { ColaEnvios } = require('../src/notifications/queue');
const { MemoryStore } = require('../src/notifications/store');
const { NotificacionService } = require('../src/notifications/service');

function whatsappFalso({ sinWhatsapp = [], fallaVeces = 0 } = {}) {
    const enviados = [];
    let fallas = 0;
    return {
        enviados,
        esperarListo: async () => {},
        obtenerChatId: async numero => (sinWhatsapp.includes(numero) ? null : `${numero}@c.us`),
        enviar: async (chatId, mensaje) => {
            if (fallas < fallaVeces) {
                fallas += 1;
                throw new Error('Fallo temporal');
            }
            enviados.push({ chatId, mensaje, en: Date.now() });
        }
    };
}

async function esperarCola(service) {
    while (service.pendientes > 0) {
        await new Promise(resolve => setTimeout(resolve, 5));
    }
}

test('normaliza teléfonos peruanos', () => {
    assert.strictEqual(normalizarTelefono('999888777'), '51999888777');
    assert.strictEqual(normalizarTelefono('+51 999 888 777'), '51999888777');
    assert.strictEqual(normalizarTelefono('51999888777'), '51999888777');
    assert.strictEqual(normalizarTelefono('12345'), null);
    assert.strictEqual(normalizarTelefono(null), null);
});

test('mensaje de pago: saludo con el nombre capitalizado, monto y firma, sin emojis', () => {
    const mensaje = mensajePago({ ordenId: 52, nombreCliente: 'MARÍA garcía', montoTotal: 68.5, tiempoEstimado: '35-45 min' });
    assert.match(mensaje, /^Hola, María\./);
    assert.match(mensaje, /S\/ 68\.50 por tu pedido N\.° 52/);
    assert.match(mensaje, /Tiempo estimado de entrega: 35-45 min\./);
    assert.match(mensaje, /San Pollo de Ica$/);
    assert.doesNotMatch(mensaje, /\p{Extended_Pictographic}/u);
});

test('mensaje EN_CAMINO incluye al repartidor solo si se envía', () => {
    const conRepartidor = mensajeEstado({ ordenId: 52, nombreCliente: 'Junior', estadoNuevo: 'EN_CAMINO', repartidorNombre: 'Juan Pérez', repartidorTelefono: '987654321' });
    assert.strictEqual(conRepartidor,
        'Hola, Junior.\n\nTu pedido N.° 52 ya salió a reparto. Te lo lleva Juan Pérez (987 654 321).\n\nSan Pollo de Ica');

    const sinRepartidor = mensajeEstado({ ordenId: 52, estadoNuevo: 'EN_CAMINO' });
    assert.strictEqual(sinRepartidor,
        'Hola.\n\nTu pedido N.° 52 ya salió a reparto y llegará en los próximos minutos.\n\nSan Pollo de Ica');
});

test('ningún mensaje de estado usa emojis', () => {
    for (const estadoNuevo of ['EN_PREPARACION', 'EN_CAMINO', 'ENTREGADO']) {
        const mensaje = mensajeEstado({ ordenId: 1, nombreCliente: 'Ana', estadoNuevo });
        assert.doesNotMatch(mensaje, /\p{Extended_Pictographic}/u, estadoNuevo);
    }
});

test('la cola procesa en orden FIFO respetando el intervalo', async () => {
    const procesados = [];
    const cola = new ColaEnvios({
        intervaloMs: 50,
        procesar: async n => procesados.push({ n, en: Date.now() })
    });

    cola.add(1);
    cola.add(2);
    cola.add(3);
    while (cola.pendientes > 0) await new Promise(r => setTimeout(r, 5));

    assert.deepStrictEqual(procesados.map(p => p.n), [1, 2, 3]);
    assert.ok(procesados[1].en - procesados[0].en >= 45);
    assert.ok(procesados[2].en - procesados[1].en >= 45);
});

test('un error en un trabajo no detiene la cola', async () => {
    const procesados = [];
    const cola = new ColaEnvios({
        intervaloMs: 0,
        procesar: async n => {
            if (n === 1) throw new Error('boom');
            procesados.push(n);
        }
    });
    const errorOriginal = console.error;
    console.error = () => {};
    cola.add(1);
    cola.add(2);
    while (cola.pendientes > 0) await new Promise(r => setTimeout(r, 5));
    console.error = errorOriginal;

    assert.deepStrictEqual(procesados, [2]);
});

test('registra ENVIADO tras un envío exitoso', async () => {
    const store = new MemoryStore();
    const whatsapp = whatsappFalso();
    const service = new NotificacionService({ store, whatsapp, intervaloMs: 0, maxIntentos: 3 });

    const log = await service.encolar({ ordenId: 52, telefono: '999888777', tipo: 'PAGO_CONFIRMADO', mensaje: 'hola' });
    assert.strictEqual(log.estado, 'EN_COLA');
    assert.match(log.id, /^notif_\d{5}$/);

    await esperarCola(service);
    const [final] = await store.findAll({ ordenId: 52 });
    assert.strictEqual(final.estado, 'ENVIADO');
    assert.strictEqual(final.intentos, 1);
    assert.ok(final.enviadoEn instanceof Date);
    assert.strictEqual(whatsapp.enviados[0].chatId, '51999888777@c.us');
});

test('un número inválido queda en ERROR y no bloquea los siguientes', async () => {
    const store = new MemoryStore();
    const whatsapp = whatsappFalso({ sinWhatsapp: ['51911111111'] });
    const service = new NotificacionService({ store, whatsapp, intervaloMs: 0, maxIntentos: 3 });
    const avisoOriginal = console.warn;
    console.warn = () => {};

    const malFormado = await service.encolar({ ordenId: 1, telefono: '123', tipo: 'ESTADO_EN_CAMINO', mensaje: 'a' });
    await service.encolar({ ordenId: 2, telefono: '911111111', tipo: 'ESTADO_EN_CAMINO', mensaje: 'b' });
    await service.encolar({ ordenId: 3, telefono: '999888777', tipo: 'ESTADO_EN_CAMINO', mensaje: 'c' });
    await esperarCola(service);
    console.warn = avisoOriginal;

    assert.strictEqual(malFormado.estado, 'ERROR');
    assert.match(malFormado.errorDetalle, /formato inválido/);
    const [sinWhatsapp] = await store.findAll({ ordenId: 2 });
    assert.strictEqual(sinWhatsapp.estado, 'ERROR');
    assert.match(sinWhatsapp.errorDetalle, /no está registrado/);
    const [ok] = await store.findAll({ ordenId: 3 });
    assert.strictEqual(ok.estado, 'ENVIADO');
});

test('reintenta fallos temporales hasta maxIntentos', async () => {
    const avisoOriginal = console.warn;
    const errorOriginal = console.error;
    console.warn = () => {};
    console.error = () => {};

    const storeOk = new MemoryStore();
    const serviceOk = new NotificacionService({ store: storeOk, whatsapp: whatsappFalso({ fallaVeces: 1 }), intervaloMs: 0, maxIntentos: 3 });
    await serviceOk.encolar({ ordenId: 1, telefono: '999888777', tipo: 'PAGO_CONFIRMADO', mensaje: 'x' });
    await esperarCola(serviceOk);
    const [recuperado] = await storeOk.findAll();
    assert.strictEqual(recuperado.estado, 'ENVIADO');
    assert.strictEqual(recuperado.intentos, 2);

    const storeMal = new MemoryStore();
    const serviceMal = new NotificacionService({ store: storeMal, whatsapp: whatsappFalso({ fallaVeces: 10 }), intervaloMs: 0, maxIntentos: 3 });
    await serviceMal.encolar({ ordenId: 1, telefono: '999888777', tipo: 'PAGO_CONFIRMADO', mensaje: 'x' });
    await esperarCola(serviceMal);
    const [fallido] = await storeMal.findAll();
    assert.strictEqual(fallido.estado, 'ERROR');
    assert.strictEqual(fallido.intentos, 3);

    console.warn = avisoOriginal;
    console.error = errorOriginal;
});

test('mensajes usan el número de pedido del cliente y no el ID interno', () => {
    const mensaje = mensajeEstado({ ordenId: 4821, numeroPedido: 3, nombreCliente: 'Ana', estadoNuevo: 'EN_PREPARACION' });
    assert.match(mensaje, /pedido N\.° 3 /);
    assert.doesNotMatch(mensaje, /4821/);
});

test('el código de seguimiento se envía real pero se guarda oculto en el historial', async () => {
    const store = new MemoryStore();
    const whatsapp = whatsappFalso();
    const service = new NotificacionService({ store, whatsapp, intervaloMs: 0, maxIntentos: 3 });

    await service.encolar({
        ordenId: null, telefono: '999888777', tipo: 'CODIGO_SEGUIMIENTO',
        mensaje: mensajeCodigo({ codigo: '4827' }), mensajeRegistro: mensajeCodigo({ codigo: '****' })
    });
    await esperarCola(service);

    assert.match(whatsapp.enviados[0].mensaje, /4827/);
    const [log] = await store.findAll();
    assert.doesNotMatch(log.mensaje, /4827/);
    assert.match(log.mensaje, /\*\*\*\*/);
    assert.strictEqual(log.ordenId, null);
});
