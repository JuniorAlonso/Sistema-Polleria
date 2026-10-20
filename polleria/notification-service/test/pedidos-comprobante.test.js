const test = require('node:test');
const assert = require('node:assert');

const { crearBot } = require('../src/chatbot/chatbot');
const { MemoryConversationStore } = require('../src/chatbot/conversation');
const { crearCatalogo } = require('../src/pedidos/catalogo');
const { crearAjustes } = require('../src/outbound/ajustes');
const { crearAlmacenamiento } = require('../src/pedidos/almacenamiento');
const { crearClientePagos } = require('../src/pedidos/pagos');

/**
 * T6b (S6/S7) — Comprobante de Yape por WhatsApp: descargar la imagen que llega,
 * subirla a MinIO con el cliente oficial y registrar la evidencia en payments-service.
 *
 * Determinista: sin red real ni MinIO real. El **cliente de almacenamiento** (MinIO) y el
 * **cliente de pagos** (payments-service) se inyectan como dobles; el reloj del nombre de
 * la clave es fijo. Los tests entran por el bot (`procesar`), que es el punto donde vive
 * el flujo, y por los módulos nuevos para fijar su contrato.
 *
 * Cubre solo la recepción: la aprobación/rechazo del ADMIN es T6c.
 */

const CELULAR = '51999888777';
const FROM = `${CELULAR}@c.us`;
const BUCKET = 'polleria-comprobantes';
const TS = 1700000000000;
const PEDIDO = { id: 77, numeroCliente: 3, total: 54 };
const CLAVE_ESPERADA = `comprobantes/yape/77/${TS}-img-1.jpg`;

function catalogoFalso() {
    return crearCatalogo({
        baseUrl: 'http://orders.test',
        ttlMs: 60000,
        ahora: () => TS,
        fetchImpl: async () => ({
            ok: true,
            status: 200,
            json: async () => [{ id: 1, nombre: 'Cuarto de pollo + papas', precio: 18, disponible: true }]
        })
    });
}

function ajustesCon(encima = {}) {
    return crearAjustes({ numeroAsesor: '51999888777', numeroRespaldo: null, ...encima });
}

/** Cliente MinIO doble: registra bucketExists/makeBucket/putObject sin tocar la red. */
function minioFalso({ existe = true, fallarPut = false } = {}) {
    const llamadas = { bucketExists: [], makeBucket: [], putObject: [] };
    let existeAhora = existe;
    return {
        llamadas,
        cliente: {
            async bucketExists(bucket) {
                llamadas.bucketExists.push(bucket);
                return existeAhora;
            },
            async makeBucket(bucket) {
                llamadas.makeBucket.push(bucket);
                existeAhora = true;
            },
            async putObject(bucket, clave, cuerpo, tam, meta) {
                if (fallarPut) throw new Error('S3 no disponible');
                llamadas.putObject.push({ bucket, clave, cuerpo, tam, meta });
            }
        }
    };
}

/** Cliente payments-service doble: registra lo que el bot le manda a /pagos/comprobante. */
function pagosFalso({ fallar = { valor: false } } = {}) {
    const llamadas = [];
    return {
        llamadas,
        fallar,
        cliente: {
            async registrarComprobante(datos) {
                llamadas.push(datos);
                if (fallar.valor) throw new Error('payments-service caído');
            }
        }
    };
}

/** Mensaje entrante de WhatsApp con imagen adjunta. */
function mensajeImagen({ id = 'img-1', mimetype = 'image/jpeg', data = 'Zm90by1kZS1wcnVlYmE=', filename = 'yape.jpg' } = {}) {
    const rastreador = { descargas: 0 };
    return {
        mensaje: {
            from: FROM,
            id,
            hasMedia: true,
            async downloadMedia() {
                rastreador.descargas += 1;
                return { mimetype, data, filename };
            }
        },
        rastreador
    };
}

function mensajeTexto(body, id = 'txt-1') {
    return { from: FROM, body, id, hasMedia: false };
}

function montar({ minio = minioFalso(), pagos = pagosFalso(), conversacion, ahora = () => TS } = {}) {
    const almacenamiento = crearAlmacenamiento({ cliente: minio.cliente, bucket: BUCKET, ahora });
    const bot = crearBot({
        catalogo: catalogoFalso(),
        ajustes: ajustesCon(),
        conversacion: conversacion || new MemoryConversationStore(),
        almacenamiento,
        pagos: pagos.cliente,
        ahora
    });
    return { bot, minio, pagos, almacenamiento };
}

async function storeConfirmado() {
    const store = new MemoryConversationStore();
    await store.set(CELULAR, { estado: 'PEDIDO_CONFIRMADO', pedido: { ...PEDIDO } });
    return store;
}

// ───────────────────────── Módulo de almacenamiento (MinIO) ─────────────────────────

test('el almacenamiento crea el bucket si falta y sube con la clave comprobantes/yape/{ordenId}/{timestamp}-{messageId}.{ext}', async () => {
    const minio = minioFalso({ existe: false });
    const almacenamiento = crearAlmacenamiento({ cliente: minio.cliente, bucket: BUCKET, ahora: () => TS });
    const archivo = Buffer.from('foto-de-yape');

    const clave = await almacenamiento.subir({
        ordenId: 77,
        messageId: 'img-1',
        archivo,
        contentType: 'image/jpeg',
        nombreArchivo: 'yape.jpg'
    });

    assert.strictEqual(clave, CLAVE_ESPERADA, 'usa la convención de clave acordada');
    assert.deepStrictEqual(minio.llamadas.bucketExists, [BUCKET], 'consulta si el bucket existe');
    assert.deepStrictEqual(minio.llamadas.makeBucket, [BUCKET], 'lo crea porque faltaba');
    assert.strictEqual(minio.llamadas.putObject.length, 1);
    const subida = minio.llamadas.putObject[0];
    assert.strictEqual(subida.bucket, BUCKET);
    assert.strictEqual(subida.clave, CLAVE_ESPERADA);
    assert.strictEqual(subida.tam, archivo.length);
    assert.deepStrictEqual(subida.cuerpo, archivo, 'sube los bytes de la imagen');
    assert.strictEqual(subida.meta['Content-Type'], 'image/jpeg');
});

test('el almacenamiento no recrea un bucket que ya existe y deduce la extensión del mimetype', async () => {
    const minio = minioFalso({ existe: true });
    const almacenamiento = crearAlmacenamiento({ cliente: minio.cliente, bucket: BUCKET, ahora: () => TS });

    const clave = await almacenamiento.subir({
        ordenId: 12,
        messageId: 'm2',
        archivo: Buffer.from('png'),
        contentType: 'image/png'
    });

    assert.strictEqual(clave, `comprobantes/yape/12/${TS}-m2.png`);
    assert.deepStrictEqual(minio.llamadas.bucketExists, [BUCKET]);
    assert.deepStrictEqual(minio.llamadas.makeBucket, [], 'no lo vuelve a crear si ya existe');
});

// ───────────────────────── Cliente de payments-service ─────────────────────────

test('el cliente de pagos manda POST /pagos/comprobante con X-Internal-Key y el cuerpo del comprobante', async () => {
    const capturado = [];
    const pagos = crearClientePagos({
        baseUrl: 'http://payments.test',
        internalKey: 'clave-interna',
        fetchImpl: async (url, opciones) => {
            capturado.push({ url, opciones });
            return { ok: true, status: 200, json: async () => ({ id: 5 }) };
        }
    });

    await pagos.registrarComprobante({
        ordenId: 77,
        telefono: CELULAR,
        comprobanteClave: CLAVE_ESPERADA
    });

    assert.strictEqual(capturado.length, 1);
    assert.strictEqual(capturado[0].url, 'http://payments.test/pagos/comprobante');
    assert.strictEqual(capturado[0].opciones.method, 'POST');
    assert.strictEqual(capturado[0].opciones.headers['X-Internal-Key'], 'clave-interna');
    assert.deepStrictEqual(JSON.parse(capturado[0].opciones.body), {
        ordenId: 77,
        telefono: CELULAR,
        comprobanteClave: CLAVE_ESPERADA
    });
});

test('el cliente de pagos lanza si payments-service no responde', async () => {
    const pagos = crearClientePagos({
        baseUrl: 'http://payments.test',
        internalKey: 'clave-interna',
        fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) })
    });

    await assert.rejects(
        () => pagos.registrarComprobante({ ordenId: 77, comprobanteClave: CLAVE_ESPERADA }),
        /payments-service/
    );
});

// ───────────────────────── Flujo del comprobante en el bot ─────────────────────────

// (a) Imagen válida + pedido confirmado → sube, registra y confirma.
test('(a) una imagen con pedido confirmado se sube con la clave esperada, se registra y se confirma', async () => {
    const store = await storeConfirmado();
    const { bot, minio, pagos } = montar({ conversacion: store });
    const { mensaje } = mensajeImagen({ id: 'img-1' });

    const respuesta = await bot.procesar(mensaje);

    assert.strictEqual(minio.llamadas.putObject.length, 1, 'sube exactamente una imagen');
    assert.strictEqual(minio.llamadas.putObject[0].clave, CLAVE_ESPERADA, 'usa la clave del pedido y el mensaje');
    assert.strictEqual(pagos.llamadas.length, 1, 'registra la evidencia una sola vez');
    assert.strictEqual(pagos.llamadas[0].ordenId, PEDIDO.id);
    assert.strictEqual(pagos.llamadas[0].comprobanteClave, CLAVE_ESPERADA);
    assert.strictEqual(pagos.llamadas[0].telefono, CELULAR, 'manda el celular del remitente');
    assert.match(respuesta, /comprobante/i, 'confirma que recibió el comprobante');
    assert.match(respuesta, /administrador/i, 'avisa que un administrador lo va a verificar');
});

// (b) Lo que no es imagen (texto) → no sube ni registra y pide una imagen.
test('(b) un mensaje de texto con el pedido confirmado no sube ni registra y pide una imagen', async () => {
    const store = await storeConfirmado();
    const { bot, minio, pagos } = montar({ conversacion: store });

    const respuesta = await bot.procesar(mensajeTexto('ya pagué, aquí va mi comprobante'));

    assert.match(respuesta, /captura|imagen/i, 'pide la captura o imagen del pago');
    assert.strictEqual(minio.llamadas.putObject.length, 0, 'no sube nada');
    assert.strictEqual(pagos.llamadas.length, 0, 'no registra nada');
    assert.match(respuesta, /ya está registrado/i, 'recuerda que el pedido ya existe');
});

// (b2) Un archivo que no es imagen → no sube ni registra y pide una imagen.
test('(b2) un adjunto que no es imagen no se sube ni se registra y pide una imagen', async () => {
    const store = await storeConfirmado();
    const { bot, minio, pagos } = montar({ conversacion: store });
    const { mensaje, rastreador } = mensajeImagen({ id: 'doc-1', mimetype: 'application/pdf', filename: 'recibo.pdf' });

    const respuesta = await bot.procesar(mensaje);

    assert.strictEqual(rastreador.descargas, 1, 'descarga para poder revisar el tipo');
    assert.match(respuesta, /captura|imagen/i, 'pide la captura o imagen del pago');
    assert.strictEqual(minio.llamadas.putObject.length, 0);
    assert.strictEqual(pagos.llamadas.length, 0);
});

// (c) Falla la subida → no registra, avisa y pide reenviar.
test('(c) si falla la subida a MinIO no se registra y el bot pide reenviar sin inventar éxito', async () => {
    const store = await storeConfirmado();
    const minio = minioFalso({ fallarPut: true });
    const { bot, pagos } = montar({ minio, conversacion: store });
    const { mensaje } = mensajeImagen({ id: 'img-1' });

    const respuesta = await bot.procesar(mensaje);

    assert.strictEqual(pagos.llamadas.length, 0, 'no registra si no pudo subir');
    assert.match(respuesta, /no pudimos/i, 'avisa que falló');
    assert.match(respuesta, /env[ií]a|reenv/i, 'pide reenviar');
    assert.doesNotMatch(respuesta, /administrador/i, 'no promete verificación');
});

// (d) Falla el registro en payments-service → avisa sin inventar éxito.
test('(d) si falla el registro en payments-service el bot lo avisa y no simula el éxito', async () => {
    const store = await storeConfirmado();
    const pagos = pagosFalso({ fallar: { valor: true } });
    const { bot, minio } = montar({ pagos, conversacion: store });
    const { mensaje } = mensajeImagen({ id: 'img-1' });

    const respuesta = await bot.procesar(mensaje);

    assert.strictEqual(minio.llamadas.putObject.length, 1, 'la subida sí ocurrió');
    assert.match(respuesta, /no pudimos/i, 'avisa que falló el registro');
    assert.match(respuesta, /env[ií]a|reenv/i, 'pide reenviar');
    assert.doesNotMatch(respuesta, /administrador/i, 'no dice que quedó recibido para verificar');
});

// (e) Sin pedido confirmado → no acepta el comprobante y dice qué falta.
test('(e) sin pedido confirmado no se acepta el comprobante y se dice qué falta', async () => {
    const store = new MemoryConversationStore();
    await store.set(CELULAR, { estado: 'CATALOGO', carrito: [] });
    const { bot, minio, pagos } = montar({ conversacion: store });
    const { mensaje, rastreador } = mensajeImagen({ id: 'img-sin-pedido' });

    const respuesta = await bot.procesar(mensaje);

    assert.strictEqual(rastreador.descargas, 0, 'ni siquiera descarga la imagen');
    assert.strictEqual(minio.llamadas.putObject.length, 0);
    assert.strictEqual(pagos.llamadas.length, 0);
    assert.match(respuesta, /pedido confirmado/i, 'dice qué falta');
});

test('(e) un comprobante en el menú (sin conversación de pedido) tampoco se acepta', async () => {
    const { bot, minio, pagos } = montar({ conversacion: new MemoryConversationStore() });
    const { mensaje } = mensajeImagen({ id: 'img-menu' });

    const respuesta = await bot.procesar(mensaje);

    assert.match(respuesta, /pedido confirmado/i);
    assert.strictEqual(minio.llamadas.putObject.length, 0);
    assert.strictEqual(pagos.llamadas.length, 0);
});

// PRESERVE — confirmar de nuevo sigue recordando el pedido y no toca almacenamiento ni pagos.
test('PRESERVE: el doble confirmar recuerda el mismo pedido y no dispara subida ni registro', async () => {
    const store = await storeConfirmado();
    const { bot, minio, pagos } = montar({ conversacion: store });

    const respuesta = await bot.procesar(mensajeTexto('confirmar', 'doble-1'));

    assert.match(respuesta, /N\.° \*?3\*?/, 'recuerda el número de pedido');
    assert.strictEqual(minio.llamadas.putObject.length, 0, 'no hay imagen que subir');
    assert.strictEqual(pagos.llamadas.length, 0, 'no hay comprobante que registrar');
});
