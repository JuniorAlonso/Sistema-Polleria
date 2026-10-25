const test = require('node:test');
const assert = require('node:assert');

const { crearBot } = require('../src/chatbot/chatbot');
const { MemoryConversationStore } = require('../src/chatbot/conversation');
const { crearCatalogo } = require('../src/pedidos/catalogo');
const { crearClienteOrdenes } = require('../src/pedidos/ordenes');
const { crearAjustes } = require('../src/outbound/ajustes');

const PRODUCTOS = [
    { id: 10, nombre: '1/4 Pollo a la Brasa', precio: 22.5, disponible: true },
    { id: 20, nombre: '1/2 Pollo a la Brasa', precio: 38.0, disponible: true },
    { id: 30, nombre: 'Porción de Papas Nativas', precio: 10.0, disponible: true }
];

const CELULAR = '51999888777';
const FROM = `${CELULAR}@c.us`;

let contadorId = 0;
function msgTexto(body) {
    contadorId += 1;
    return { from: FROM, body, id: `msg-${contadorId}` };
}

function msgImagen(id = 'img-cap') {
    return {
        from: FROM,
        id,
        type: 'image',
        hasMedia: true,
        async downloadMedia() {
            return {
                mimetype: 'image/jpeg',
                data: Buffer.from('fake-yape-capture').toString('base64'),
                filename: 'comprobante.jpg'
            };
        }
    };
}

function setupPrueba({ ordenesMock = {}, storageMock = {}, pagosMock = {} } = {}) {
    const store = new MemoryConversationStore();
    const llamadasOrdenes = [];

    const catalogo = crearCatalogo({
        baseUrl: 'http://orders.test',
        ttlMs: 60000,
        ahora: () => 1000,
        fetchImpl: async () => ({ ok: true, status: 200, json: async () => PRODUCTOS })
    });

    const ordenes = {
        crear: async datos => {
            llamadasOrdenes.push(datos);
            return {
                id: 101,
                numeroCliente: 1,
                total: 55.0,
                ...ordenesMock.crearResp
            };
        },
        obtener: async id => {
            if (ordenesMock.obtenerResp) return ordenesMock.obtenerResp(id);
            if (id === '101' || id === '1') {
                return {
                    id: 101,
                    numeroCliente: 1,
                    estado: 'EN_PREPARACION',
                    telefonoCliente: CELULAR,
                    total: 55.0,
                    direccionEntrega: 'Av. San Martín 450, Ica',
                    items: [
                        { cantidad: 2, productoNombre: '1/4 Pollo a la Brasa' },
                        { cantidad: 1, productoNombre: 'Porción de Papas Nativas' }
                    ]
                };
            }
            return null;
        }
    };

    const almacenamiento = {
        subir: async params => {
            if (storageMock.fallar) throw new Error('MinIO down');
            return `comprobantes/yape/${params.ordenId}/test.jpg`;
        }
    };

    const pagos = {
        registrarComprobante: async params => {
            if (pagosMock.fallar) throw new Error('Payments down');
            return { id: 1, ...params };
        }
    };

    const ajustes = crearAjustes({ numeroAsesor: '51934421442', numeroRespaldo: null });

    const bot = crearBot({
        catalogo,
        ajustes,
        conversacion: store,
        ordenes,
        almacenamiento,
        pagos,
        ahora: () => 1000
    });

    return { bot, store, llamadasOrdenes };
}

// ─── Escenario 1: Flujo completo de pedido con cantidad, notas y nombre ─────────
test('Escenario 1: Flujo completo de compra (pedido con cantidad, notas, dirección y referencia)', async () => {
    const { bot, llamadasOrdenes } = setupPrueba();

    // 1. Saludo
    const r1 = await bot.procesar(msgTexto('Hola buenas tardes'));
    assert.match(r1, /Bienvenido a San Pollo/i);
    assert.match(r1, /Hacer un Pedido/i);

    // 2. Opción 1: Iniciar pedido
    const r2 = await bot.procesar(msgTexto('1'));
    assert.match(r2, /¿Eres de Ica\?/i);

    // 3. Confirmar Ica
    const r3 = await bot.procesar(msgTexto('¡Sí, claro!'));
    assert.match(r3, /NUESTRA CARTA/i);
    assert.match(r3, /1\/4 Pollo a la Brasa/i);

    // 4. Agregar cantidad con sintaxis "2 de 1"
    const r4 = await bot.procesar(msgTexto('2 de 1'));
    assert.match(r4, /Agregué \*2x 1\/4 Pollo a la Brasa\*/i);
    assert.match(r4, /Subtotal:\* S\/ 45\.00/i);

    // 5. Agregar producto 3 (papas)
    const r5 = await bot.procesar(msgTexto('3'));
    assert.match(r5, /Agregué \*Porción de Papas Nativas\*/i);
    assert.match(r5, /Subtotal:\* S\/ 55\.00/i);

    // 6. Indicar notas para cocina
    const r6 = await bot.procesar(msgTexto('nota: las papas bien crocantes por favor'));
    assert.match(r6, /Anoté tu indicación/i);

    // 7. Indicar nombre del cliente
    const r7 = await bot.procesar(msgTexto('Mi nombre es Roberto'));
    assert.match(r7, /Gracias, Roberto/i);

    // 8. Confirmar pedido
    const r8 = await bot.procesar(msgTexto('confirmar'));
    assert.match(r8, /dirección/i);

    // 9. Enviar dirección
    const r9 = await bot.procesar(msgTexto('Av. San Martín 450, Ica'));
    assert.match(r9, /referencia/i);

    // 10. Enviar referencia
    const r10 = await bot.procesar(msgTexto('Frente al parque Bolognesi'));
    assert.match(r10, /Pedido registrado/i);
    assert.match(r10, /Tu pedido N\.° \*1\*/i);
    assert.match(r10, /total de \*S\/ 55\.00\*/i);
    assert.match(r10, /Yape/i);

    // Verificación de datos enviados a orders-service
    assert.strictEqual(llamadasOrdenes.length, 1);
    const ordenEnviada = llamadasOrdenes[0];
    assert.strictEqual(ordenEnviada.direccionEntrega, 'Av. San Martín 450, Ica');
    assert.strictEqual(ordenEnviada.referencia, 'Frente al parque Bolognesi');
    assert.strictEqual(ordenEnviada.nombreCliente, 'Roberto');
    assert.strictEqual(ordenEnviada.observaciones, 'las papas bien crocantes por favor');
    assert.strictEqual(ordenEnviada.items.length, 2);
    assert.deepStrictEqual(ordenEnviada.items, [
        { productoId: 10, cantidad: 2 },
        { productoId: 30, cantidad: 1 }
    ]);
});

// ─── Escenario 2: Cancelación en cualquier punto del flujo ─────────────────────
test('Escenario 2: El cliente puede cancelar en cualquier paso sin que se cree una orden', async () => {
    // 2.1 Cancelar en confirmación de Ica
    const { bot: bot1, store: store1 } = setupPrueba();
    await bot1.procesar(msgTexto('1'));
    const rCancel1 = await bot1.procesar(msgTexto('cancelar'));
    assert.match(rCancel1, /Operación cancelada/i);
    assert.strictEqual(await store1.get(CELULAR), null);

    // 2.2 Cancelar en catálogo
    const { bot: bot2, store: store2 } = setupPrueba();
    await bot2.procesar(msgTexto('1'));
    await bot2.procesar(msgTexto('si'));
    await bot2.procesar(msgTexto('1'));
    const rCancel2 = await bot2.procesar(msgTexto('cancelar pedido'));
    assert.match(rCancel2, /Operación cancelada/i);
    assert.strictEqual(await store2.get(CELULAR), null);

    // 2.3 Cancelar mientras espera dirección (no debe guardar 'cancelar' como dirección)
    const { bot: bot3, llamadasOrdenes } = setupPrueba();
    await bot3.procesar(msgTexto('1'));
    await bot3.procesar(msgTexto('si'));
    await bot3.procesar(msgTexto('1'));
    await bot3.procesar(msgTexto('confirmar')); // Pasa a ESPERANDO_DIRECCION
    const rCancel3 = await bot3.procesar(msgTexto('salir'));
    assert.match(rCancel3, /Operación cancelada/i);
    assert.strictEqual(llamadasOrdenes.length, 0, 'no crea orden');

    // 2.4 Escribir "menu" mientras espera referencia (vuelve al menú sin crear orden)
    const { bot: bot4, llamadasOrdenes: llamadas4 } = setupPrueba();
    await bot4.procesar(msgTexto('1'));
    await bot4.procesar(msgTexto('si'));
    await bot4.procesar(msgTexto('1'));
    await bot4.procesar(msgTexto('confirmar'));
    await bot4.procesar(msgTexto('Calle Lima 123')); // Pasa a ESPERANDO_REFERENCIA
    const rMenu = await bot4.procesar(msgTexto('menu'));
    assert.match(rMenu, /Bienvenido a San Pollo/i);
    assert.strictEqual(llamadas4.length, 0, 'no crea orden');
});

// ─── Escenario 3: Vaciar carrito y gestión de productos ─────────────────────────
test('Escenario 3: Vaciar carrito y quitar productos', async () => {
    const { bot } = setupPrueba();
    await bot.procesar(msgTexto('1'));
    await bot.procesar(msgTexto('si'));
    await bot.procesar(msgTexto('1'));
    await bot.procesar(msgTexto('2'));

    // Vaciar carrito
    const rVaciar = await bot.procesar(msgTexto('vaciar carrito'));
    assert.match(rVaciar, /Se vació tu carrito/i);

    // Verificar carrito
    const rVer = await bot.procesar(msgTexto('carrito'));
    assert.match(rVer, /Tu carrito está vacío/i);
});

// ─── Escenario 4: Consulta de estado de pedido (Opción 2) ──────────────────────
test('Escenario 4: Consultar estado de pedido existente y no existente', async () => {
    const { bot } = setupPrueba();

    // 4.1 Iniciar consulta
    const r1 = await bot.procesar(msgTexto('2'));
    assert.match(r1, /Código de Pedido/i);

    // 4.2 Enviar código existente #101
    const r2 = await bot.procesar(msgTexto('#101'));
    assert.match(r2, /ESTADO DE TU PEDIDO N\.° 1/i);
    assert.match(r2, /En preparación en cocina/i);
    assert.match(r2, /Total:\* S\/ 55\.00/i);
    assert.match(r2, /Av\. San Martín 450/i);
    assert.match(r2, /2x 1\/4 Pollo a la Brasa/i);

    // 4.3 Consultar pedido inexistente
    await bot.procesar(msgTexto('2'));
    const r404 = await bot.procesar(msgTexto('#9999'));
    assert.match(r404, /No encontramos ningún pedido con el número \*#9999\*/i);
});

// ─── Escenario 5: Cliente no es de Ica ─────────────────────────────────────────
test('Escenario 5: Si el cliente responde que no es de Ica, se informa amablemente', async () => {
    const { bot, store } = setupPrueba();
    await bot.procesar(msgTexto('1'));
    const rNo = await bot.procesar(msgTexto('no soy de ica'));
    assert.match(rNo, /delivery de San Pollo cubre solo \*Ica\*/i);
    assert.match(rNo, /Puedes llamarnos/i);
    const estado = await store.get(CELULAR);
    assert.strictEqual(estado.estado, 'MENU');
});

// ─── Escenario 6: Rechazo de comprobante y reintento con nueva captura ──────────
test('Escenario 6: Si el comprobante fue rechazado, el bot informa el motivo y acepta nueva captura', async () => {
    const { bot, store } = setupPrueba();

    // Simular que el cliente tenía pedido confirmado con comprobante rechazado
    await store.set(CELULAR, {
        estado: 'PEDIDO_CONFIRMADO',
        comprobanteRecibido: false,
        motivoRechazo: 'El monto en la captura indica S/ 20 y el total es S/ 55',
        pedido: { id: 101, numeroCliente: 1, total: 55.0 }
    });

    // Cliente escribe "¿por qué?" o "hola"
    const rAviso = await bot.procesar(msgTexto('hola'));
    assert.match(rAviso, /Tu comprobante anterior no pudo ser validado/i);
    assert.match(rAviso, /El monto en la captura indica S\/ 20/i);
    assert.match(rAviso, /nueva foto o captura/i);

    // Cliente envía nueva captura válida
    const rNuevaCaptura = await bot.procesar(msgImagen('img-nueva'));
    assert.match(rNuevaCaptura, /Recibimos el comprobante de tu pedido N\.° \*1\*/i);

    // Cliente escribe "Okok" tras nueva captura -> No vuelve a pedir pago
    const rOk = await bot.procesar(msgTexto('Okok'));
    assert.doesNotMatch(rOk, /Paga por/i);
    assert.match(rOk, /gusto|revis|administrador/i);
});

// ─── Escenario 7: Mensajes multimedia que NO son comprobantes ───────────────────
test('Escenario 7: Notas de voz, ubicaciones GPS, stickers y tarjetas de contacto', async () => {
    const { bot, store } = setupPrueba();

    // 7.1 Nota de voz (PTT o Audio)
    const msgAudio = { from: FROM, id: 'audio-1', type: 'ptt', hasMedia: true };
    const rAudio = await bot.procesar(msgAudio);
    assert.match(rAudio, /no puedo procesar notas de voz/i);

    // 7.2 Ubicación GPS
    const msgLoc = { from: FROM, id: 'loc-1', type: 'location', hasMedia: true };
    const rLoc = await bot.procesar(msgLoc);
    assert.match(rLoc, /Recibí tu ubicación/i);
    assert.match(rLoc, /dirección exacta en texto/i);

    // 7.3 Tarjeta de contacto (vCard)
    const msgVcard = { from: FROM, id: 'vcard-1', type: 'vcard', hasMedia: true };
    const rVcard = await bot.procesar(msgVcard);
    assert.match(rVcard, /tarjeta de contacto/i);

    // 7.4 Sticker enviado en catálogo -> agradece con cortesía
    const msgSticker1 = { from: FROM, id: 'sticker-1', type: 'sticker', hasMedia: true };
    const rSticker1 = await bot.procesar(msgSticker1);
    assert.match(rSticker1, /¡Gracias por tu sticker!/i);

    // 7.5 Sticker enviado cuando se espera comprobante de pago -> avisa que sticker no es válido
    await store.set(CELULAR, {
        estado: 'PEDIDO_CONFIRMADO',
        pedido: { id: 101, numeroCliente: 1, total: 55.0 }
    });
    const msgSticker2 = { from: FROM, id: 'sticker-2', type: 'sticker', hasMedia: true };
    const rSticker2 = await bot.procesar(msgSticker2);
    assert.match(rSticker2, /un sticker no es válido como comprobante/i);
});

// ─── Escenario 8: Privacidad en la consulta de pedidos (un cliente no puede ver pedido ajeno) ──
test('Escenario 8: Protección de privacidad - Cliente A no puede consultar pedido de Cliente B', async () => {
    const { bot } = setupPrueba({
        ordenesMock: {
            obtenerResp: id => {
                if (id === '202') {
                    return {
                        id: 202,
                        numeroCliente: 5,
                        estado: 'EN_CAMINO',
                        telefonoCliente: '51911223344', // Pertenece a OTRO celular
                        total: 120.0,
                        direccionEntrega: 'Av. Privada Secreta 999, Ica'
                    };
                }
                return null;
            }
        }
    });

    // Iniciar consulta de pedido
    await bot.procesar(msgTexto('2'));

    // Consultar pedido 202 que es de otro cliente
    const rEspia = await bot.procesar(msgTexto('#202'));

    // NO debe mostrar la dirección ajena
    assert.doesNotMatch(rEspia, /Av\. Privada Secreta/i);
    assert.doesNotMatch(rEspia, /S\/ 120/i);
    assert.match(rEspia, /asociado a tu número de WhatsApp/i);
});

// ─── Escenario 9: Sanitización de inputs y prevención de inyecciones (XSS, scripts, cadenas enormes) ──
test('Escenario 9: Sanitización de scripts HTML, saltos de línea infinitos y recorte de longitudes', async () => {
    const { bot, llamadasOrdenes } = setupPrueba();

    await bot.procesar(msgTexto('1'));
    await bot.procesar(msgTexto('si'));
    await bot.procesar(msgTexto('1'));

    // Inyección de script y saltos de línea en nota
    await bot.procesar(msgTexto('nota: <script>alert("hack")</script> sin ensalada \n\n\n\n por favor'));

    // Inyección en nombre
    await bot.procesar(msgTexto('Mi nombre es <b>Juan</b> <iframe src="evil.com">'));

    await bot.procesar(msgTexto('confirmar'));

    // Dirección con tags HTML y excesivamente larga (>300 chars)
    const direccionLarga = 'Calle Las Flores 123 '.repeat(20) + '<script>bad()</script>';
    await bot.procesar(msgTexto(direccionLarga));

    // Referencia
    await bot.procesar(msgTexto('Portón verde <style>body{color:red}</style>'));

    assert.strictEqual(llamadasOrdenes.length, 1);
    const orden = llamadasOrdenes[0];

    // Verificar que los tags HTML fueron neutralizados
    assert.doesNotMatch(orden.observaciones, /<script>/i);
    assert.match(orden.observaciones, /sin ensalada/i);

    assert.doesNotMatch(orden.nombreCliente, /<b>|<iframe/i);
    assert.match(orden.nombreCliente, /Juan/i);

    assert.doesNotMatch(orden.direccionEntrega, /<script>/i);
    assert.ok(orden.direccionEntrega.length <= 250, 'la dirección no sobrepasa el límite seguro de BD');

    assert.doesNotMatch(orden.referencia, /<style>/i);
    assert.match(orden.referencia, /Portón verde/i);
});

// ─── Escenario 10: Pedidos con cantidades desorbitadas ─────────────────────────
test('Escenario 10: Pedidos mayores a 50 unidades dirigen al asesor sin saturar el sistema', async () => {
    const { bot } = setupPrueba();

    await bot.procesar(msgTexto('1'));
    await bot.procesar(msgTexto('si'));

    const rExceso = await bot.procesar(msgTexto('100 de 1'));
    assert.match(rExceso, /Para pedidos mayores a 50 unidades/i);
    assert.match(rExceso, /asesor/i);
});

// ─── Escenario 11: Inputs vacíos, espacios en blanco o solo emojis sin errores ─
test('Escenario 11: Manejo de solo emojis, espacios en blanco y caracteres extraños', async () => {
    const { bot } = setupPrueba();

    // Solo espacios en MENU -> ignora sin explotar
    const rEspacios = await bot.procesar(msgTexto('     '));
    assert.strictEqual(rEspacios, null);

    // Solo emojis en MENU -> ignora sin explotar
    const rEmojis = await bot.procesar(msgTexto('🍗🍗🍗🔥🔥'));
    assert.strictEqual(rEmojis, null);

    // Emojis en confirmación de Ica -> repregunta amablemente
    await bot.procesar(msgTexto('1'));
    const rIcaEmoji = await bot.procesar(msgTexto('🐔🎉'));
    assert.match(rIcaEmoji, /¿Eres de Ica\?/i);
});

