/**
 * Motor conversacional del bot de pedidos (T3a/T3b, S1/S4/S12).
 *
 * El bot DEVUELVE el texto y nunca envía por su cuenta: el handler lo encola en la
 * única cola saliente (T4). Este archivo resuelve el estado de cada conversación:
 *
 * - MENU: menú de 4 opciones; la 1 (o un mensaje que pide un pedido) inicia el flujo.
 * - CONFIRMANDO_ICA: primer paso OBLIGATORIO antes de tomar cualquier pedido (S12).
 * - CATALOGO: carta real de orders-service numerada; se agregan productos por número,
 *   se quitan, se ve el carrito y se confirma el pedido.
 * - ESPERANDO_DIRECCION / ESPERANDO_REFERENCIA: antes de crear la orden el bot pide la
 *   dirección y una referencia (el alta de delivery de orders-service exige dirección).
 * - PEDIDO_CONFIRMADO: estado final que recuerda la orden creada (idempotencia T3b).
 * - ESPERANDO_CODIGO_PEDIDO: se conserva el flujo viejo de consulta de pedido.
 *
 * El estado se lee/escribe en un store persistido (misma base que el historial) y el
 * dedup por `message.id` evita ejecutar dos veces la reentrega de un mensaje.
 *
 * El alta (T3b) la hace `ordenes.crear()` contra `POST /ordenes` de orders-service con
 * `tipo: DELIVERY` y `canalOrigen: WHATSAPP`. El bot NO calcula el envío: el total que
 * muestra al confirmar es el que devolvió orders-service.
 */

const {
    getMainMenu,
    PREGUNTA_ICA,
    SOLO_ICA,
    PREGUNTA_DIRECCION,
    PREGUNTA_REFERENCIA,
    formatearCarrito,
    formatearCatalogo,
    mensajePedidoCreado,
    mensajePedidoYaConfirmado,
    MENSAJE_PEDIDO_FALLIDO,
    MENSAJE_PIDE_IMAGEN_COMPROBANTE,
    MENSAJE_COMPROBANTE_FALLO_SUBIDA,
    MENSAJE_COMPROBANTE_FALLO_REGISTRO,
    mensajeSinPedidoConfirmado,
    mensajeComprobanteRecibido,
    lineaContacto,
    respuestaAsesor,
    mensajeSinServicio,
    mensajeSinProductos
} = require('./menu');
const { MemoryConversationStore } = require('./conversation');
const { DedupMensajes } = require('./dedup');
const { crearCatalogo } = require('../pedidos/catalogo');
const { esImagen } = require('../pedidos/almacenamiento');
const { normalizarTelefono } = require('../notifications/phone');
const { crearLogger } = require('../logger');
const logger = crearLogger('Chatbot');

const ESTADO_MENU = 'MENU';
const ESTADO_CONFIRMANDO_ICA = 'CONFIRMANDO_ICA';
const ESTADO_CATALOGO = 'CATALOGO';
const ESTADO_ESPERANDO_DIRECCION = 'ESPERANDO_DIRECCION';
const ESTADO_ESPERANDO_REFERENCIA = 'ESPERANDO_REFERENCIA';
const ESTADO_PEDIDO_CONFIRMADO = 'PEDIDO_CONFIRMADO';
const ESTADO_ESPERANDO_CODIGO = 'ESPERANDO_CODIGO_PEDIDO';

const SALUDOS = ['hola', 'holi', 'buenas', 'menu', 'opciones'];
const AFIRMATIVOS = ['si', 's', 'yes', 'claro', 'confirmo', 'correcto', 'soy de ica'];
const NEGATIVOS = ['no', 'n', 'no soy de ica'];
const CONFIRMAR = ['confirmar', 'confirmo', 'finalizar', 'finalizo', 'terminar', 'termino', 'pagar'];
const VER_CARRITO = ['carrito', 'ver carrito', 'mi carrito'];
const VER_CARTA = ['carta', 'menu', 'catalogo', 'la carta', 'ver carta'];

function sinDiacriticos(texto) {
    return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function textoDe(msg) {
    return sinDiacriticos((msg.body || msg.caption || '').toLowerCase().trim());
}

function textoCrudo(msg) {
    return String(msg.body || msg.caption || '').trim();
}

/** Clave de conversación: el celular normalizado (S12:S1) y, si no, el `from` crudo. */
function claveDeUsuario(from) {
    if (from && typeof from === 'object') {
        const candidato = from.telefonoCliente || from.from || '';
        return normalizarTelefono(candidato) || String(candidato);
    }
    return normalizarTelefono(from) || String(from || '');
}

const TIPOS_MEDIA_IMAGEN = new Set(['image', 'sticker']);
const TIPOS_MEDIA_NO_IMAGEN = new Set(['document', 'video', 'audio', 'ptt', 'vcard', 'multi_vcard', 'location']);

function esMensajeConMedia(msg) {
    if (!msg) return false;
    if (msg.hasMedia) return true;
    const tipo = String(msg.type || '').toLowerCase();
    return TIPOS_MEDIA_IMAGEN.has(tipo) || TIPOS_MEDIA_NO_IMAGEN.has(tipo);
}

function esTipoImagen(msg) {
    const tipo = String((msg && msg.type) || '').toLowerCase();
    return TIPOS_MEDIA_IMAGEN.has(tipo);
}

function idDeMensaje(msg) {
    const id = msg && msg.id;
    if (!id) return null;
    if (typeof id === 'string') return id;
    return id._serialized || id.id || null;
}

/** Pide un pedido, pero no "consultar el estado de mi pedido". */
function esIntentoDePedido(texto) {
    if (/estado|consultar|seguimiento|ubicacion|horario|asesor/.test(texto)) return false;
    return /(pedir|pedido|ordenar|orden|comprar|delivery)/.test(texto);
}

function esAfirmativo(texto) {
    if (AFIRMATIVOS.includes(texto)) return true;
    return AFIRMATIVOS.includes(texto.split(/\s+/)[0]);
}

function esNegativo(texto) {
    if (NEGATIVOS.includes(texto)) return true;
    return NEGATIVOS.includes(texto.split(/\s+/)[0]);
}

class BotPedidos {
    constructor({ catalogo, ajustes, conversacion, dedup, ordenes, almacenamiento, pagos, ahora, dormir } = {}) {
        this.catalogo = catalogo || crearCatalogo();
        this.ajustes = ajustes || null;
        this.conversacion = conversacion || new MemoryConversationStore();
        this.dedup = dedup || new DedupMensajes({ ahora });
        // Cliente de orders-service (T3b). Si no se inyecta, confirmar falla de forma
        // explícita en vez de inventar una orden.
        this.ordenes = ordenes || null;
        // Comprobante de Yape (T6b): almacenamiento en MinIO y registro en payments-service.
        // Inyectables (los tests usan dobles) y opcionales: sin ellos, el bot avisa que no
        // pudo guardar el comprobante en vez de inventar un éxito.
        this.almacenamiento = almacenamiento || null;
        this.pagos = pagos || null;
        this.dormir = dormir || (ms => new Promise(resolve => setTimeout(resolve, ms)));
    }

    /** Devuelve el texto a enviar o null si el mensaje no amerita respuesta. */
    async procesar(msg) {
        const id = idDeMensaje(msg);
        if (!this.dedup.registrar(id)) {
            logger.warn(`Mensaje id=${id || 'sin-id'} descartado por deduplicación (ya procesado)`);
            return null;
        }
        const clave = claveDeUsuario(msg.telefonoCliente || msg.from);
        const guardado = (await this.conversacion.get(clave)) || { estado: ESTADO_MENU };
        const esMedia = esMensajeConMedia(msg);
        logger.info(`Procesando mensaje [id: ${id || 'sin-id'}] de clave="${clave}" (from="${msg && msg.from}") | estado: "${guardado.estado || ESTADO_MENU}" | pedido confirmado: ${guardado.pedido ? '#' + guardado.pedido.id : 'ninguno'} | esMedia: ${esMedia}`);
        return this._resolver(msg, clave, guardado);
    }

    async _resolver(msg, clave, guardado) {
        const texto = textoDe(msg);
        const estado = guardado.estado || ESTADO_MENU;

        // Recepción del comprobante de Yape (T6b): una imagen solo se procesa cuando la
        // conversación tiene un pedido confirmado; cualquier otra cosa pide una imagen.
        if (esMensajeConMedia(msg)) {
            logger.info(`Mensaje de "${clave}" detectado como media (hasMedia=${Boolean(msg && msg.hasMedia)}, type="${msg && msg.type}"). Derivando a receptor de comprobantes.`);
            return this._resolverComprobante(msg, clave, guardado);
        }

        if (estado === ESTADO_ESPERANDO_CODIGO) {
            await this.conversacion.del(clave);
            const codigo = textoCrudo(msg);
            return `Recibí tu código de pedido: *${codigo}*`;
        }

        if (estado === ESTADO_ESPERANDO_DIRECCION) {
            return this._resolverDireccion(msg, clave, guardado);
        }

        if (estado === ESTADO_ESPERANDO_REFERENCIA) {
            return this._resolverReferencia(msg, clave, guardado);
        }

        if (estado === ESTADO_CONFIRMANDO_ICA) {
            return this._resolverIca(texto, clave);
        }

        if (estado === ESTADO_CATALOGO) {
            return this._resolverCatalogo(msg, texto, clave, guardado);
        }

        if (estado === ESTADO_PEDIDO_CONFIRMADO) {
            // Idempotencia (T3b): el pedido ya se creó; se recuerda sin crear otro y se
            // pide la imagen del comprobante (T6b) si lo que llegó no es una imagen.
            return mensajePedidoYaConfirmado(guardado.pedido, this.ajustes);
        }

        // Estado MENU
        if (SALUDOS.includes(texto)) return getMainMenu();

        if (texto === '1' || esIntentoDePedido(texto)) {
            await this.conversacion.set(clave, { estado: ESTADO_CONFIRMANDO_ICA });
            return PREGUNTA_ICA;
        }

        if (texto === '2') {
            await this.conversacion.set(clave, { estado: ESTADO_ESPERANDO_CODIGO });
            return 'Para consultar tu pedido, por favor envíanos tu *Código de Pedido* 🔎 (Ejemplo: #102).';
        }

        if (texto === '3') {
            return (
                '📍 *UBICACIÓN Y HORARIOS*\n\n' +
                '• Dirección: Av. Principal 123, Ica\n' +
                '• Atención: Lunes a Domingo de 12:00 PM a 10:30 PM'
            );
        }

        if (texto === '4') {
            return respuestaAsesor(this.ajustes);
        }

        return null;
    }

    async _resolverIca(texto, clave) {
        if (esAfirmativo(texto)) {
            const resultado = await this._cargarCatalogo();
            if (!resultado.ok) {
                await this.conversacion.set(clave, { estado: ESTADO_MENU });
                return resultado.texto;
            }
            await this.conversacion.set(clave, {
                estado: ESTADO_CATALOGO,
                catalogo: resultado.productos,
                carrito: []
            });
            return resultado.texto;
        }

        if (esNegativo(texto)) {
            await this.conversacion.set(clave, { estado: ESTADO_MENU });
            return `${SOLO_ICA}\n\n${lineaContacto(this.ajustes)}`;
        }

        return PREGUNTA_ICA;
    }

    async _resolverDireccion(msg, clave, guardado) {
        const direccion = textoCrudo(msg);
        if (!direccion) return PREGUNTA_DIRECCION;

        const nuevo = { ...guardado, direccion };
        if (!nuevo.referencia) {
            await this.conversacion.set(clave, { ...nuevo, estado: ESTADO_ESPERANDO_REFERENCIA });
            return PREGUNTA_REFERENCIA;
        }
        return this._crearPedido(clave, nuevo);
    }

    async _resolverReferencia(msg, clave, guardado) {
        const referencia = textoCrudo(msg);
        if (!referencia) return PREGUNTA_REFERENCIA;

        // "sin referencia" y equivalentes quedan como texto explícito, no como dato faltante.
        const nuevo = { ...guardado, referencia };
        return this._crearPedido(clave, nuevo);
    }

    async _resolverCatalogo(msg, texto, clave, guardado) {
        if (VER_CARRITO.includes(texto)) {
            return formatearCarrito(guardado.carrito);
        }

        if (VER_CARTA.includes(texto)) {
            return this._mostrarCatalogo(clave, guardado);
        }

        const quitar = texto.match(/^(?:quitar|borrar|eliminar)\s+(\d+)$/);
        if (quitar) {
            return this._quitarDelCarrito(clave, guardado, Number(quitar[1]));
        }

        // Nombre y notas se capturan del texto original para no perder mayúsculas.
        const crudo = sinDiacriticos(textoCrudo(msg));
        const nota = crudo.match(/^(?:nota|notas|observacion|observaciones)\s*:?\s*(.+)$/i);
        if (nota) {
            const nuevo = { ...guardado, observaciones: nota[1].trim() };
            await this.conversacion.set(clave, nuevo);
            return '📝 Anoté tu indicación. ' + formatearCarrito(nuevo.carrito);
        }

        const nombre = crudo.match(/^(?:mi nombre es|nombre)\s*:?\s*(.+)$/i);
        if (nombre) {
            const nuevo = { ...guardado, nombre: nombre[1].trim() };
            await this.conversacion.set(clave, nuevo);
            return `Gracias, ${nuevo.nombre}. ` + formatearCarrito(nuevo.carrito);
        }

        if (CONFIRMAR.includes(texto)) {
            return this._confirmar(clave, guardado);
        }

        if (/^\d+$/.test(texto)) {
            if (!guardado.catalogo || !guardado.catalogo.length) {
                return this._mostrarCatalogo(clave, guardado);
            }
            return this._agregarAlCarrito(clave, guardado, Number(texto));
        }

        // Cualquier otra cosa: volver a mostrar la carta (con cache, no golpea el servicio).
        return this._mostrarCatalogo(clave, guardado);
    }

    async _agregarAlCarrito(clave, guardado, numero) {
        const catalogo = guardado.catalogo || [];
        const producto = catalogo[numero - 1];
        if (!producto) {
            return `No encontré el producto número ${numero}.\n\n${formatearCatalogo(catalogo)}`;
        }

        const carrito = (guardado.carrito || []).map(i => ({ ...i }));
        const existente = carrito.find(i => i.productoId === producto.id);
        if (existente) {
            existente.cantidad += 1;
        } else {
            carrito.push({
                productoId: producto.id,
                nombre: producto.nombre,
                precio: producto.precio,
                cantidad: 1
            });
        }

        await this.conversacion.set(clave, { ...guardado, carrito });
        return `✅ Agregué *${producto.nombre}* a tu carrito.\n\n${formatearCarrito(carrito)}`;
    }

    async _quitarDelCarrito(clave, guardado, numero) {
        const carrito = (guardado.carrito || []).map(i => ({ ...i }));
        if (!Number.isInteger(numero) || numero < 1 || numero > carrito.length) {
            return `No hay un producto número ${numero} en tu carrito.\n\n${formatearCarrito(carrito)}`;
        }
        carrito.splice(numero - 1, 1);
        await this.conversacion.set(clave, { ...guardado, carrito });
        return formatearCarrito(carrito);
    }

    async _confirmar(clave, guardado) {
        const carrito = guardado.carrito || [];
        if (!carrito.length) {
            return formatearCarrito(carrito);
        }
        if (!guardado.direccion) {
            await this.conversacion.set(clave, { ...guardado, estado: ESTADO_ESPERANDO_DIRECCION });
            return PREGUNTA_DIRECCION;
        }
        if (!guardado.referencia) {
            await this.conversacion.set(clave, { ...guardado, estado: ESTADO_ESPERANDO_REFERENCIA });
            return PREGUNTA_REFERENCIA;
        }
        return this._crearPedido(clave, guardado);
    }

    async _crearPedido(clave, guardado) {
        if (!this.ordenes) {
            logger.warn(`No se pudo crear pedido para ${clave}: cliente de orders-service no inyectado`);
            return this._falloPedido(clave, guardado);
        }

        const datos = {
            tipo: 'DELIVERY',
            canalOrigen: 'WHATSAPP',
            direccionEntrega: guardado.direccion,
            referencia: guardado.referencia,
            telefonoCliente: clave,
            items: guardado.carrito.map(i => ({ productoId: i.productoId, cantidad: i.cantidad }))
        };
        if (guardado.nombre) datos.nombreCliente = guardado.nombre;
        if (guardado.observaciones) datos.observaciones = guardado.observaciones;

        try {
            logger.info(`Creando pedido DELIVERY en orders-service para ${clave}...`);
            const orden = await this.ordenes.crear(datos);
            const pedido = { id: orden.id, numeroCliente: orden.numeroCliente, total: orden.total };
            await this.conversacion.set(clave, { estado: ESTADO_PEDIDO_CONFIRMADO, pedido });
            logger.success(`Pedido creado con éxito: orden #${orden.id} (número cliente #${orden.numeroCliente}, total: S/ ${orden.total}). Estado de ${clave} actualizado a ${ESTADO_PEDIDO_CONFIRMADO}`);
            return mensajePedidoCreado(pedido, this.ajustes);
        } catch (error) {
            logger.error(`Fallo al crear orden para ${clave} en orders-service: ${error.message || error}`);
            // Fallo explícito: no se inventa número de pedido y el carrito no se pierde.
            return this._falloPedido(clave, guardado);
        }
    }

    async _falloPedido(clave, guardado) {
        await this.conversacion.set(clave, { ...guardado, estado: ESTADO_CATALOGO });
        return MENSAJE_PEDIDO_FALLIDO;
    }

    async _descargarMediaConReintento(msg, maxIntentos = 3, esperaMs = 150) {
        if (!msg || typeof msg.downloadMedia !== 'function') {
            logger.warn(`downloadMedia no es una función en msg (tipo: ${msg && msg.type})`);
            return null;
        }
        let ultimoError = null;
        for (let intento = 1; intento <= maxIntentos; intento += 1) {
            try {
                logger.info(`Descargando archivo adjunto (intento ${intento}/${maxIntentos}) para mensaje id=${idDeMensaje(msg)}...`);
                const media = await msg.downloadMedia();
                if (media && media.data) {
                    const tamBytes = Math.round(media.data.length * 0.75);
                    logger.success(`Media descargada exitosamente en intento ${intento}: mimetype="${media.mimetype}", filename="${media.filename || 'sin nombre'}", tamaño: ~${tamBytes} bytes (${media.data.length} caracteres base64)`);
                    return media;
                }
                if (media && media.mimetype && !esImagen(media.mimetype)) {
                    logger.info(`Adjunto no imagen detectado en intento ${intento} (mimetype="${media.mimetype}"). No requiere reintento.`);
                    // Es un adjunto no imagen (p. ej. PDF): no hace falta reintentar.
                    return media;
                }
                logger.warn(`Intento ${intento}/${maxIntentos}: downloadMedia() devolvió datos vacíos o sin campo data`);
            } catch (error) {
                ultimoError = error;
                logger.warn(`Intento ${intento}/${maxIntentos} falló en downloadMedia(): ${error.message || error}`);
            }
            if (intento < maxIntentos) {
                logger.info(`Esperando ${esperaMs * intento}ms antes del reintento ${intento + 1}...`);
                await this.dormir(esperaMs * intento);
            }
        }
        if (ultimoError) throw ultimoError;
        return null;
    }

    /**
     * Comprobante de Yape (T6b): el `ordenId` sale del estado de conversación (el pedido de
     * T3b). Sin pedido confirmado no se acepta nada y se dice qué falta. Con pedido: se
     * descarga la imagen, se verifica que sea imagen, se sube a MinIO y se registra en
     * payments-service. Cualquier fallo se dice y se pide reenviar: nunca un éxito falso.
     */
    async _resolverComprobante(msg, clave, guardado) {
        const pedido = guardado && guardado.estado === ESTADO_PEDIDO_CONFIRMADO ? guardado.pedido : null;
        if (!pedido || pedido.id === undefined || pedido.id === null) {
            logger.warn(`Comprobante recibido de "${clave}", pero NO hay un pedido confirmado en curso. Estado actual: "${guardado ? guardado.estado : 'sin estado'}", pedido: ${JSON.stringify(pedido)}. Se avisará al cliente que primero debe confirmar un pedido.`);
            return mensajeSinPedidoConfirmado();
        }

        logger.info(`Iniciando recepción de comprobante para orden #${pedido.id} (Total: S/ ${pedido.total}, Cliente: ${clave})`);

        if (!this.almacenamiento || !this.pagos) {
            console.error(`❌ Comprobante orden #${pedido.id}: almacenamiento o pagos no configurados`);
            return MENSAJE_COMPROBANTE_FALLO_SUBIDA;
        }

        const tipoMimetypeDeclarado = msg && (msg.mimetype || (msg._data && msg._data.mimetype));
        if (msg && msg.type && TIPOS_MEDIA_NO_IMAGEN.has(String(msg.type).toLowerCase()) && !esImagen(tipoMimetypeDeclarado)) {
            logger.warn(`Comprobante orden #${pedido.id}: adjunto descartado por ser tipo no imagen (type: ${msg.type}, mimetype: ${tipoMimetypeDeclarado}). Se solicitará imagen.`);
            return MENSAJE_PIDE_IMAGEN_COMPROBANTE;
        }

        let media;
        try {
            logger.info(`Comprobante orden #${pedido.id}: descargando archivo de WhatsApp...`);
            media = await this._descargarMediaConReintento(msg);
        } catch (error) {
            console.error(`❌ Comprobante orden #${pedido.id}: fallo en downloadMedia(): ${error.message || error}`);
            return MENSAJE_COMPROBANTE_FALLO_SUBIDA;
        }

        if (!media) {
            if (esTipoImagen(msg) || esImagen(tipoMimetypeDeclarado)) {
                console.error(`❌ Comprobante orden #${pedido.id}: downloadMedia() devolvió vacío para una imagen (type=${msg && msg.type})`);
                return MENSAJE_COMPROBANTE_FALLO_SUBIDA;
            }
            logger.warn(`Comprobante orden #${pedido.id}: no se recibió imagen válida. Pidiendo imagen al cliente.`);
            return MENSAJE_PIDE_IMAGEN_COMPROBANTE;
        }

        if (!esImagen(media.mimetype)) {
            logger.warn(`Comprobante orden #${pedido.id}: archivo descargado tiene mimetype "${media.mimetype}" (no es imagen). Pidiendo imagen al cliente.`);
            return MENSAJE_PIDE_IMAGEN_COMPROBANTE;
        }

        let claveObjeto;
        try {
            const tamBytes = media.data ? Math.round(media.data.length * 0.75) : 0;
            logger.info(`Comprobante orden #${pedido.id}: subiendo imagen a MinIO (tamaño aprox: ~${Math.round(tamBytes / 1024)} KB, mimetype: "${media.mimetype}")...`);
            claveObjeto = await this.almacenamiento.subir({
                ordenId: pedido.id,
                messageId: idDeMensaje(msg),
                archivo: Buffer.from(String(media.data || ''), 'base64'),
                contentType: media.mimetype,
                nombreArchivo: media.filename
            });
            logger.success(`Comprobante orden #${pedido.id}: subido a MinIO exitosamente con clave: "${claveObjeto}"`);
        } catch (error) {
            console.error(`❌ Comprobante orden #${pedido.id}: fallo al subir a MinIO: ${error.message || error}`);
            return MENSAJE_COMPROBANTE_FALLO_SUBIDA;
        }

        try {
            logger.info(`Comprobante orden #${pedido.id}: registrando en payments-service (monto: S/ ${pedido.total}, teléfono: ${clave}, clave: "${claveObjeto}")...`);
            await this.pagos.registrarComprobante({
                ordenId: pedido.id,
                telefono: clave,
                monto: pedido.total,
                comprobanteClave: claveObjeto
            });
            logger.success(`Comprobante orden #${pedido.id}: registrado exitosamente en payments-service.`);
        } catch (error) {
            console.error(`❌ Comprobante orden #${pedido.id}: fallo al registrar en payments-service: ${error.message || error}`);
            return MENSAJE_COMPROBANTE_FALLO_REGISTRO;
        }

        logger.success(`Comprobante orden #${pedido.id}: comprobante verificado y registrado. Notificando al cliente.`);
        return mensajeComprobanteRecibido(pedido);
    }

    async _mostrarCatalogo(clave, guardado) {
        const resultado = await this._cargarCatalogo();
        if (!resultado.ok) {
            await this.conversacion.set(clave, { ...guardado, estado: ESTADO_MENU });
            return resultado.texto;
        }
        await this.conversacion.set(clave, {
            ...guardado,
            estado: ESTADO_CATALOGO,
            catalogo: resultado.productos
        });
        return resultado.texto;
    }

    async _cargarCatalogo() {
        try {
            const productos = await this.catalogo.listar();
            if (!productos.length) {
                return { ok: false, productos: [], texto: mensajeSinProductos(this.ajustes) };
            }
            return { ok: true, productos, texto: formatearCatalogo(productos) };
        } catch (error) {
            // orders-service no respondió: no se inventa catálogo, se ofrece el asesor.
            return { ok: false, productos: [], texto: mensajeSinServicio(this.ajustes) };
        }
    }
}

function crearBot(opciones) {
    return new BotPedidos(opciones);
}

module.exports = {
    BotPedidos,
    crearBot,
    ESTADO_MENU,
    ESTADO_CONFIRMANDO_ICA,
    ESTADO_CATALOGO,
    ESTADO_ESPERANDO_DIRECCION,
    ESTADO_ESPERANDO_REFERENCIA,
    ESTADO_PEDIDO_CONFIRMADO,
    ESTADO_ESPERANDO_CODIGO,
    claveDeUsuario,
    idDeMensaje
};
