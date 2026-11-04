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
 * - ESPERANDO_ENTREGA: al confirmar, el cliente elige Delivery o Recojo en tienda.
 * - ESPERANDO_DIRECCION / ESPERANDO_REFERENCIA: solo para delivery (orders-service exige
 *   dirección en el alta de delivery).
 * - ESPERANDO_METODO_PAGO: Yape o efectivo (ContraPago: contra entrega o al recoger). Si
 *   orders-service rechaza el efectivo por una sanción de pedido fantasma (409), solo queda Yape.
 * - ESPERANDO_MONTO_EFECTIVO: con cuánto paga (o "exacto") para que lleven el vuelto.
 * - PEDIDO_CONFIRMADO: estado final que recuerda la orden creada (idempotencia T3b).
 * - ESPERANDO_CODIGO_PEDIDO: se conserva el flujo viejo de consulta de pedido.
 *
 * El estado se lee/escribe en un store persistido (misma base que el historial) y el
 * dedup por `message.id` evita ejecutar dos veces la reentrega de un mensaje.
 *
 * El alta la hace `ordenes.crear()` contra `POST /ordenes` con `canalOrigen: WHATSAPP` y el
 * estado inicial del pago: `PENDIENTE_PAGO` (Yape: la captura llega a la bandeja del cajero)
 * o `PENDIENTE_CONFIRMACION` (efectivo: el cajero llama para confirmar). Ninguno pasa a cocina
 * sin esa validación. El bot NO calcula el envío: el total que muestra es el de orders-service.
 */

const {
    getMainMenu,
    PREGUNTA_ICA,
    SOLO_ICA,
    PREGUNTA_DIRECCION,
    PREGUNTA_REFERENCIA,
    PREGUNTA_ENTREGA,
    preguntaMetodoPago,
    PREGUNTA_MONTO_EFECTIVO,
    MENSAJE_SANCION_CONTRAPAGO,
    MENSAJE_EFECTIVO_SIN_CAPTURA,
    mensajeTicket,
    mensajeTicketNoValido,
    MENSAJE_SIN_TICKET,
    formatearCarrito,
    formatearCatalogo,
    mensajePedidoCreado,
    mensajePedidoYaConfirmado,
    MENSAJE_PEDIDO_FALLIDO,
    mensajePedidoRechazado,
    MENSAJE_PEDIDO_NO_ACTIVO,
    MENSAJE_PIDE_IMAGEN_COMPROBANTE,
    MENSAJE_COMPROBANTE_FALLO_SUBIDA,
    MENSAJE_COMPROBANTE_FALLO_REGISTRO,
    mensajeSinPedidoConfirmado,
    mensajeComprobanteRecibido,
    numeroDePedido,
    lineaContacto,
    respuestaAsesor,
    mensajeSinServicio,
    mensajeSinProductos
} = require('./menu');
const { MemoryConversationStore, liberarConservandoTicket } = require('./conversation');
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
const ESTADO_COMPROBANTE_RECIBIDO = 'COMPROBANTE_RECIBIDO';
const ESTADO_ESPERANDO_CODIGO = 'ESPERANDO_CODIGO_PEDIDO';
const ESTADO_ESPERANDO_ENTREGA = 'ESPERANDO_ENTREGA';
const ESTADO_ESPERANDO_METODO_PAGO = 'ESPERANDO_METODO_PAGO';
const ESTADO_ESPERANDO_MONTO = 'ESPERANDO_MONTO_EFECTIVO';

// Answers for the delivery mode and payment method questions (numbers or words).
const RESPUESTAS_DELIVERY = ['1', 'delivery', 'a domicilio', 'domicilio', 'envio'];
const RESPUESTAS_RECOJO = ['2', 'recojo', 'recoger', 'recojo en tienda', 'tienda', 'en tienda'];
const RESPUESTAS_YAPE = ['1', 'yape', 'plin', 'yape o plin'];
const RESPUESTAS_EFECTIVO = ['2', 'efectivo', 'contrapago', 'contra pago', 'contra entrega', 'contraentrega', 'cash'];

// Asking for the ticket again works in any state (menu option 5 only from the main menu).
const PALABRAS_TICKET = ['ticket', 'mi ticket', 'ver ticket', 'ver mi ticket', 'reenviar ticket',
    'enviame mi ticket', 'envia mi ticket', 'mandame mi ticket', 'codigo de ticket', 'mi codigo de ticket'];

/** Final states whose ticket can no longer be used at the counter. */
const ESTADOS_TICKET_NO_VALIDO = ['CANCELADO', 'PEDIDO_FANTASMA'];

/** Highest cash amount accepted for "paga con": a typo like 5000 should not become the change. */
const MONTO_EFECTIVO_MAXIMO = 1000;

const SALUDOS = ['hola', 'holi', 'buenas', 'menu', 'opciones'];
const AFIRMATIVOS = ['si', 's', 'yes', 'claro', 'confirmo', 'correcto', 'soy de ica'];
const NEGATIVOS = ['no', 'n', 'no soy de ica'];
const CONFIRMAR = ['confirmar', 'confirmo', 'finalizar', 'finalizo', 'terminar', 'termino', 'pagar'];
const VER_CARRITO = ['carrito', 'ver carrito', 'mi carrito'];
const VER_CARTA = ['carta', 'menu', 'catalogo', 'la carta', 'ver carta'];
const AGRADECIMIENTOS = ['ok', 'okok', 'oki', 'okey', 'gracias', 'muchas gracias', 'gracia', 'listo', 'perfecto', 'vale', 'dale', 'chevere', 'genial'];

function esMensajeAgradecimiento(texto) {
    if (!texto) return false;
    const limpio = String(texto || '').toLowerCase().replace(/[¡!¿?.,;:~*_-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!limpio) return false;
    if (AGRADECIMIENTOS.includes(limpio)) return true;
    return AGRADECIMIENTOS.some(p => limpio === p || limpio.startsWith(p + ' ') || limpio.endsWith(' ' + p) || limpio.includes(' ' + p + ' '));
}

const CANCELACIONES = ['cancelar', 'cancela', 'cancelar pedido', 'salir', 'reiniciar', 'abortar', 'anular', 'volver'];

function esCancelacion(texto) {
    if (!texto) return false;
    const limpio = String(texto || '').toLowerCase().replace(/[¡!¿?.,;:~*_-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!limpio) return false;
    if (CANCELACIONES.includes(limpio)) return true;
    return CANCELACIONES.some(c => limpio === c || limpio.startsWith(c + ' ') || limpio.endsWith(' ' + c));
}

// Words that cancel an order already created. "volver", "salir" or "reiniciar" do not: an
// accidental "volver" must never cancel a live (maybe already paid) order.
const CANCELACIONES_DE_PEDIDO = ['cancelar', 'cancela', 'cancelar pedido', 'cancelar mi pedido', 'cancela mi pedido', 'anular', 'anular pedido', 'anular mi pedido'];

/** Order states the customer can still cancel from the chat (before the kitchen starts). */
const ESTADOS_CANCELABLES_DESDE_CHAT = ['PENDIENTE_PAGO', 'PENDIENTE_CONFIRMACION', 'RECIBIDO'];

function esCancelacionDePedido(texto) {
    if (!texto) return false;
    const limpio = String(texto || '').toLowerCase().replace(/[¡!¿?.,;:~*_-]/g, ' ').replace(/\s+/g, ' ').trim();
    return CANCELACIONES_DE_PEDIDO.includes(limpio);
}

/**
 * Reads what the customer typed to look up an order. `POL-<id>` (any case, spaces, dashes)
 * is the global order id printed on the ticket; a bare number is the customer's own order
 * number (N.° 2), which is NOT a global id.
 */
function leerCodigoDePedido(codigo) {
    const compacto = String(codigo || '').toLowerCase().replace(/[\s\-_#.:°º]/g, '');
    const pol = compacto.match(/^pol(\d+)$/);
    if (pol) return { ordenId: pol[1].replace(/^0+(?=\d)/, '') };
    const numero = compacto.match(/^(?:n|nro|numero|pedido)?(\d+)$/);
    if (numero) return { numeroCliente: numero[1].replace(/^0+(?=\d)/, '') };
    return null;
}

function esSaludo(texto) {
    if (!texto) return false;
    const limpio = String(texto || '').toLowerCase().replace(/[¡!¿?.,;:~*_-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!limpio) return false;
    if (SALUDOS.includes(limpio)) return true;
    return SALUDOS.some(s => limpio === s || limpio.startsWith(s + ' ') || limpio.endsWith(' ' + s));
}

function sinDiacriticos(texto) {
    return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function textoDe(msg) {
    return sinDiacriticos((msg.body || msg.caption || '').toLowerCase().trim());
}

function textoCrudo(msg) {
    return String(msg.body || msg.caption || '').trim();
}

function sanitizarTexto(texto, maxLen = 200) {
    if (!texto) return '';
    return String(texto)
        .replace(/<[^>]*>?/gm, '')
        .replace(/[\r\n\t]+/g, ' ')
        .trim()
        .slice(0, maxLen);
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
    if (!texto) return false;
    const limpio = String(texto || '').replace(/[¡!¿?.,;:~*_-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (AFIRMATIVOS.includes(limpio)) return true;
    const primeraPalabra = limpio.split(/\s+/)[0];
    return AFIRMATIVOS.includes(primeraPalabra) || AFIRMATIVOS.some(a => limpio === a || limpio.startsWith(a + ' '));
}

function esNegativo(texto) {
    if (!texto) return false;
    const limpio = String(texto || '').replace(/[¡!¿?.,;:~*_-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (NEGATIVOS.includes(limpio)) return true;
    const primeraPalabra = limpio.split(/\s+/)[0];
    return NEGATIVOS.includes(primeraPalabra) || NEGATIVOS.some(n => limpio === n || limpio.startsWith(n + ' '));
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

        // Recepción del comprobante de Yape (T6b) y tipos multimedia especiales
        if (esMensajeConMedia(msg)) {
            const tipo = String((msg && msg.type) || '').toLowerCase();
            if (tipo === 'ptt' || tipo === 'audio') {
                return '🎙️ Por el momento no puedo procesar notas de voz. Por favor escribe tu mensaje en texto o responde con las opciones del menú. 🍗';
            }
            if (tipo === 'location') {
                return '📍 Recibí tu ubicación. Por favor escribe también la dirección exacta en texto (calle, número y referencia) para que nuestro repartidor pueda llegar con precisión.';
            }
            if (tipo === 'vcard' || tipo === 'multi_vcard') {
                return '👤 Recibí una tarjeta de contacto. Si deseas asistencia directa, puedes escribir *4* para comunicarte con nuestro equipo.';
            }
            if (tipo === 'sticker') {
                if (estado === ESTADO_PEDIDO_CONFIRMADO) {
                    return '📸 Por favor envía una *foto o captura real* de tu transferencia por Yape (un sticker no es válido como comprobante).';
                }
                return '🍗 ¡Gracias por tu sticker! Escribe *hola* para ver el menú o haz tu pedido enviando el número del producto.';
            }

            logger.info(`Mensaje de "${clave}" detectado como media (hasMedia=${Boolean(msg && msg.hasMedia)}, type="${msg && msg.type}"). Derivando a receptor de comprobantes.`);
            return this._resolverComprobante(msg, clave, guardado);
        }

        if (PALABRAS_TICKET.includes(texto) || (texto === '5' && estado === ESTADO_MENU)) {
            return this._enviarTicket(clave, guardado);
        }

        // With a created order, "cancelar" must cancel it in orders-service (or say it can't):
        // only clearing the chat would leave the order alive while telling the customer otherwise.
        const tienePedido = (estado === ESTADO_PEDIDO_CONFIRMADO || estado === ESTADO_COMPROBANTE_RECIBIDO) &&
            guardado.pedido && guardado.pedido.id !== undefined && guardado.pedido.id !== null;
        if (tienePedido && esCancelacionDePedido(texto)) {
            return this._cancelarPedido(clave, guardado);
        }

        // Escape words (salir, volver...) with a created order: back to the menu as before, but
        // without claiming a cancellation the order never had.
        if (tienePedido && esCancelacion(texto)) {
            await liberarConservandoTicket(this.conversacion, clave);
            return `↩️ Volviste al menú. Tu pedido N.° *${numeroDePedido(guardado.pedido)}* sigue activo; ` +
                'si deseas anularlo escribe *cancelar*. Escribe *hola* para ver el menú. 🍗';
        }

        // Cancelación en cualquier estado que no sea MENU (antes de crear el pedido)
        if (esCancelacion(texto) && estado !== ESTADO_MENU && !tienePedido) {
            await liberarConservandoTicket(this.conversacion, clave);
            return '❌ Operación cancelada. Escribe *hola* o *menu* cuando desees iniciar un nuevo pedido o consultar algo. 🍗';
        }

        // Volver al menú principal desde estados previos a confirmación
        if ((['menu', 'inicio', 'volver al menu', 'ver menu'].includes(texto) || esSaludo(texto)) &&
            [ESTADO_CONFIRMANDO_ICA, ESTADO_ESPERANDO_DIRECCION, ESTADO_ESPERANDO_REFERENCIA, ESTADO_ESPERANDO_CODIGO,
                ESTADO_ESPERANDO_ENTREGA, ESTADO_ESPERANDO_METODO_PAGO, ESTADO_ESPERANDO_MONTO].includes(estado)) {
            await this.conversacion.set(clave, { estado: ESTADO_MENU, ultimoPedido: guardado.ultimoPedido });
            return getMainMenu();
        }

        if (estado === ESTADO_ESPERANDO_CODIGO) {
            await liberarConservandoTicket(this.conversacion, clave);
            const codigo = textoCrudo(msg);
            return this._consultarPedido(clave, codigo, guardado);
        }

        if (estado === ESTADO_ESPERANDO_ENTREGA) {
            return this._resolverEntrega(texto, clave, guardado);
        }

        if (estado === ESTADO_ESPERANDO_METODO_PAGO) {
            return this._resolverMetodoPago(texto, clave, guardado);
        }

        if (estado === ESTADO_ESPERANDO_MONTO) {
            return this._resolverMonto(texto, clave, guardado);
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

        if (estado === ESTADO_COMPROBANTE_RECIBIDO || (estado === ESTADO_PEDIDO_CONFIRMADO && guardado.comprobanteRecibido)) {
            if (esMensajeAgradecimiento(texto)) {
                return '¡Con gusto! Te avisaremos por este chat tan pronto tu pedido sea confirmado por el administrador. 🍗';
            }
            return (
                `✅ Ya recibimos el comprobante de tu pedido N.° *${numeroDePedido(guardado.pedido)}*.\n\n` +
                'Un administrador lo está revisando y te confirmaremos en cuanto sea validado por este chat. ⏳'
            );
        }

        if (estado === ESTADO_PEDIDO_CONFIRMADO) {
            if (guardado.motivoRechazo) {
                return (
                    `⚠️ Tu comprobante anterior no pudo ser validado: *${guardado.motivoRechazo}*.\n\n` +
                    `Por favor envíanos una nueva foto o captura clara de tu transferencia por *Yape* para tu pedido N.° *${numeroDePedido(guardado.pedido)}*. 📸`
                );
            }
            // Idempotencia (T3b): el pedido ya se creó; se recuerda sin crear otro y se
            // pide la imagen del comprobante (T6b) si lo que llegó no es una imagen.
            return mensajePedidoYaConfirmado(guardado.pedido, this.ajustes);
        }

        // Estado MENU
        if (esSaludo(texto)) return getMainMenu();

        if (esMensajeAgradecimiento(texto)) {
            return '¡A ti! Que disfrutes tu pedido. Si necesitas algo más o deseas hacer un nuevo pedido, escribe *hola* para ver el menú. 🍗';
        }

        if (texto === '1' || esIntentoDePedido(texto)) {
            await this.conversacion.set(clave, { estado: ESTADO_CONFIRMANDO_ICA });
            return PREGUNTA_ICA;
        }

        if (texto === '2') {
            // Keep the last order: its customer number (N.° 2) resolves to its real id.
            await this.conversacion.set(clave, {
                estado: ESTADO_ESPERANDO_CODIGO,
                ultimoPedido: guardado.pedido || guardado.ultimoPedido
            });
            return 'Para consultar tu pedido, por favor envíanos tu *Código de Pedido* 🔎, el de tu ticket (Ejemplo: *POL-102*), o el número de tu último pedido.';
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
        const crudo = textoCrudo(msg).replace(/^(?:mi direccion es|direccion)\s*:?\s*/i, '');
        const direccion = sanitizarTexto(crudo, 250);
        if (!direccion || direccion.length < 3) return PREGUNTA_DIRECCION;

        return this._confirmar(clave, { ...guardado, direccion });
    }

    async _resolverReferencia(msg, clave, guardado) {
        const crudo = textoCrudo(msg).replace(/^(?:mi referencia es|referencia)\s*:?\s*/i, '');
        const referencia = sanitizarTexto(crudo, 180);
        if (!referencia) return PREGUNTA_REFERENCIA;

        // "sin referencia" y equivalentes quedan como texto explícito, no como dato faltante.
        return this._confirmar(clave, { ...guardado, referencia });
    }

    async _resolverEntrega(texto, clave, guardado) {
        let entrega = null;
        if (RESPUESTAS_DELIVERY.includes(texto)) entrega = 'DELIVERY';
        if (RESPUESTAS_RECOJO.includes(texto)) entrega = 'RECOJO';
        if (!entrega) return PREGUNTA_ENTREGA;
        return this._confirmar(clave, { ...guardado, entrega });
    }

    async _resolverMetodoPago(texto, clave, guardado) {
        if (RESPUESTAS_YAPE.includes(texto)) {
            return this._confirmar(clave, { ...guardado, metodoPago: 'YAPE', montoPagaCon: undefined });
        }
        if (RESPUESTAS_EFECTIVO.includes(texto)) {
            // orders-service already refused cash for this number: do not ask again for the amount.
            if (guardado.sancionContraPago) return MENSAJE_SANCION_CONTRAPAGO;
            return this._confirmar(clave, { ...guardado, metodoPago: 'EFECTIVO' });
        }
        return preguntaMetodoPago(guardado.entrega);
    }

    /** "exacto" means no change is needed; otherwise the bill amount, so the courier brings the change. */
    async _resolverMonto(texto, clave, guardado) {
        if (['exacto', 'monto exacto', 'justo', 'sencillo'].includes(texto)) {
            return this._confirmar(clave, { ...guardado, montoPagaCon: null });
        }
        const numero = texto.replace(',', '.').match(/(\d+(?:\.\d{1,2})?)/);
        const monto = numero ? Number(numero[1]) : NaN;
        const subtotal = (guardado.carrito || []).reduce((acc, i) => acc + Number(i.precio) * i.cantidad, 0);
        if (!Number.isFinite(monto) || monto <= 0 || monto > MONTO_EFECTIVO_MAXIMO) {
            return PREGUNTA_MONTO_EFECTIVO;
        }
        if (monto < subtotal) {
            return `El monto debe cubrir tu pedido (subtotal S/ ${subtotal.toFixed(2)} más el envío si es delivery). ` +
                PREGUNTA_MONTO_EFECTIVO;
        }
        return this._confirmar(clave, { ...guardado, montoPagaCon: monto });
    }

    async _resolverCatalogo(msg, texto, clave, guardado) {
        if (VER_CARRITO.includes(texto)) {
            return formatearCarrito(guardado.carrito);
        }

        if (VER_CARTA.includes(texto)) {
            return this._mostrarCatalogo(clave, guardado);
        }

        if (['vaciar', 'vaciar carrito', 'limpiar carrito', 'borrar todo'].includes(texto)) {
            const nuevo = { ...guardado, carrito: [] };
            await this.conversacion.set(clave, nuevo);
            return '🛒 Se vació tu carrito. Puedes volver a agregar productos de la carta enviando su número.';
        }

        const quitar = texto.match(/^(?:quitar|borrar|eliminar)\s+(\d+)$/);
        if (quitar) {
            return this._quitarDelCarrito(clave, guardado, Number(quitar[1]));
        }

        // Nombre y notas se capturan del texto original para no perder mayúsculas.
        const crudo = sinDiacriticos(textoCrudo(msg));
        const nota = crudo.match(/^(?:nota|notas|observacion|observaciones)\s*:?\s*([\s\S]+)$/i);
        if (nota) {
            const observaciones = sanitizarTexto(nota[1], 250);
            const nuevo = { ...guardado, observaciones };
            await this.conversacion.set(clave, nuevo);
            return '📝 Anoté tu indicación. ' + formatearCarrito(nuevo.carrito);
        }

        const nombre = crudo.match(/^(?:mi nombre es|nombre)\s*:?\s*([\s\S]+)$/i);
        if (nombre) {
            const nombreCliente = sanitizarTexto(nombre[1], 90);
            const nuevo = { ...guardado, nombre: nombreCliente };
            await this.conversacion.set(clave, nuevo);
            return `Gracias, ${nuevo.nombre}. ` + formatearCarrito(nuevo.carrito);
        }

        if (CONFIRMAR.includes(texto)) {
            return this._confirmar(clave, guardado);
        }

        // Cantidad con producto: "2 de 1", "2 del 1", "2 x 1", "2x 1"
        const patronCantidad = texto.match(/^(\d+)\s*(?:de|del|x|\*)\s*(\d+)$/i);
        if (patronCantidad) {
            const numA = Number(patronCantidad[1]);
            const numB = Number(patronCantidad[2]);
            const catalogo = guardado.catalogo || [];
            let cantidad = 1;
            let productoNum = numA;
            if (numB >= 1 && numB <= catalogo.length) {
                cantidad = numA;
                productoNum = numB;
            } else if (numA >= 1 && numA <= catalogo.length) {
                cantidad = numB;
                productoNum = numA;
            }
            if (cantidad > 50) {
                return (
                    '⚠️ Para pedidos mayores a 50 unidades, por favor comunícate directamente con un asesor escribiendo *4* en el menú.\n\n' +
                    lineaContacto(this.ajustes)
                );
            }
            if (cantidad > 0) {
                return this._agregarAlCarrito(clave, guardado, productoNum, cantidad);
            }
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

    async _agregarAlCarrito(clave, guardado, numero, cantidad = 1) {
        const cant = Number.isInteger(cantidad) && cantidad > 0 ? cantidad : 1;
        const catalogo = guardado.catalogo || [];
        const producto = catalogo[numero - 1];
        if (!producto) {
            return `No encontré el producto número ${numero}.\n\n${formatearCatalogo(catalogo)}`;
        }

        const carrito = (guardado.carrito || []).map(i => ({ ...i }));
        const existente = carrito.find(i => i.productoId === producto.id);
        if (existente) {
            existente.cantidad += cant;
        } else {
            carrito.push({
                productoId: producto.id,
                nombre: producto.nombre,
                precio: producto.precio,
                cantidad: cant
            });
        }

        await this.conversacion.set(clave, { ...guardado, carrito });
        const prefijo = cant > 1 ? `${cant}x ` : '';
        return `✅ Agregué *${prefijo}${producto.nombre}* a tu carrito.\n\n${formatearCarrito(carrito)}`;
    }

    async _consultarPedido(clave, codigo, guardado = {}) {
        const leido = leerCodigoDePedido(codigo);
        if (!leido) {
            return (
                'No pude identificar el código de pedido en tu mensaje.\n' +
                'Por favor escribe *2* en el menú y envíanos el código de tu ticket (ejemplo: *POL-102*).'
            );
        }

        if (!this.ordenes || typeof this.ordenes.obtener !== 'function') {
            return `Recibí tu código de pedido: *${codigo}*`;
        }

        // A bare number is the customer's own order number (N.° 2), not the global id: it only
        // resolves to an order this chat created. Anything else needs the POL code.
        let id = leido.ordenId;
        if (!id) {
            const propios = [guardado && guardado.pedido, guardado && guardado.ultimoPedido]
                .filter(p => p && p.id !== undefined && p.id !== null);
            const propio = propios.find(p => p.numeroCliente != null && String(p.numeroCliente) === leido.numeroCliente);
            if (!propio) {
                return (
                    `🔍 No encontramos tu pedido N.° *${leido.numeroCliente}* en este chat.\n\n` +
                    'Por favor envíanos el *código de tu ticket* (ejemplo: *POL-102*): aparece en los mensajes de tu pedido. ' +
                    'Escribe *2* para intentarlo de nuevo o *ticket* para ver el de tu último pedido.'
                );
            }
            id = String(propio.id);
        }
        const codigoVisible = `POL-${id}`;
        const noEncontrado = () => (
            `🔍 No encontramos ningún pedido con el código *${codigoVisible}* asociado a tu número de WhatsApp.\n\n` +
            'Por favor verifica el código de tu ticket o escribe *4* para comunicarte con un asesor.\n\n' +
            lineaContacto(this.ajustes)
        );

        try {
            logger.info(`Consultando estado de pedido #${id} para ${clave}...`);
            const orden = await this.ordenes.obtener(id);
            if (!orden) {
                return noEncontrado();
            }

            // PRIVACIDAD: el bot consulta con la clave interna, así que la orden solo se muestra
            // si su teléfono coincide con el del remitente. Sin alguno de los dos no hay forma de
            // comprobarlo y se responde igual que si no existiera.
            const telOrdenNorm = normalizarTelefono(orden.telefonoCliente || '');
            const telRemitenteNorm = normalizarTelefono(clave);
            if (!telOrdenNorm || !telRemitenteNorm || telOrdenNorm !== telRemitenteNorm) {
                logger.warn(`Consulta denegada por privacidad: ${clave} intentó ver la orden #${id}`);
                return noEncontrado();
            }

            const estadosMap = {
                RECIBIDO: '📥 Recibido',
                PENDIENTE_PAGO: '⏳ Esperando la captura de tu Yape',
                PENDIENTE_CONFIRMACION: '📞 Esperando nuestra llamada de confirmación',
                EN_PREPARACION: '🍳 En preparación en cocina',
                PREPARANDO: '🍳 En preparación en cocina',
                LISTO: '📦 Listo para entregar',
                LISTO_PARA_ENTREGAR: orden.tipo === 'RECOJO'
                    ? '📦 Listo para recoger en tienda (tienes 1 hora; presenta tu ticket)'
                    : '📦 Listo, esperando al repartidor',
                EN_CAMINO: '🛵 En camino a tu dirección',
                EN_PUERTA: '🚪 El repartidor está en tu puerta',
                ENTREGADO: '✅ Entregado. ¡Esperamos que lo disfrutes!',
                CANCELADO: '❌ Cancelado',
                PEDIDO_FANTASMA: '⚠️ Cerrado como no recibido'
            };
            const estadoTexto = estadosMap[orden.estado] || orden.estado || 'En proceso';
            const numPedido = orden.numeroCliente != null ? orden.numeroCliente : orden.id;

            let resumenItems = '';
            if (Array.isArray(orden.items) && orden.items.length > 0) {
                resumenItems = '\n*Detalle del pedido:*\n' + orden.items.map(i => `• ${i.cantidad}x ${i.productoNombre}`).join('\n') + '\n';
            }

            return (
                `🍗 *ESTADO DE TU PEDIDO N.° ${numPedido}*\n\n` +
                `• *Estado:* ${estadoTexto}\n` +
                (orden.total ? `• *Total:* S/ ${Number(orden.total).toFixed(2)}\n` : '') +
                (orden.direccionEntrega ? `• *Dirección:* ${orden.direccionEntrega}\n` : '') +
                resumenItems +
                '\nSi necesitas asistencia con tu entrega, escribe *4* para comunicarte con un asesor.'
            );
        } catch (error) {
            logger.error(`Error al consultar orden #${id} en orders-service: ${error.message || error}`);
            return (
                'En este momento no pudimos consultar el sistema de pedidos. ' +
                'Por favor intenta nuevamente en unos minutos o llámanos para asistirte.\n\n' +
                lineaContacto(this.ajustes)
            );
        }
    }

    /**
     * "cancelar" with an order already created: the current state is read from orders-service.
     * Before the kitchen starts (PENDIENTE_PAGO, PENDIENTE_CONFIRMACION, RECIBIDO) the order is
     * cancelled there and only then the chat is released; otherwise, or if the service refuses
     * or does not answer, the customer is told and the conversation stays as it was.
     */
    async _cancelarPedido(clave, guardado) {
        const pedido = guardado.pedido;
        const numero = numeroDePedido(pedido);
        const sinCancelar = (
            `⚠️ No pudimos cancelar tu pedido N.° *${numero}* en este momento. ` +
            'Por favor intenta de nuevo en unos minutos o comunícate con la pollería.\n\n' +
            lineaContacto(this.ajustes)
        );
        if (!this.ordenes || typeof this.ordenes.obtener !== 'function' || typeof this.ordenes.cancelar !== 'function') {
            return sinCancelar;
        }

        let orden;
        try {
            orden = await this.ordenes.obtener(pedido.id);
        } catch (error) {
            logger.warn(`No se pudo consultar la orden #${pedido.id} para cancelarla: ${error.message || error}`);
            return sinCancelar;
        }

        if (!orden || ESTADOS_TICKET_NO_VALIDO.includes(orden.estado)) {
            // Already cancelled or closed: nothing left to cancel, the chat is free again.
            await liberarConservandoTicket(this.conversacion, clave);
            return (
                `Tu pedido N.° *${numero}* ya no está activo, así que no hay nada que cancelar.\n\n` +
                'Escribe *hola* o *menu* cuando desees hacer un nuevo pedido. 🍗'
            );
        }

        if (!ESTADOS_CANCELABLES_DESDE_CHAT.includes(orden.estado)) {
            return (
                `⚠️ Tu pedido N.° *${numero}* ya está en proceso, así que no se puede cancelar desde este chat.\n\n` +
                'Si necesitas cancelarlo, comunícate con la pollería. ' +
                lineaContacto(this.ajustes)
            );
        }

        try {
            await this.ordenes.cancelar(pedido.id);
        } catch (error) {
            logger.warn(`orders-service no canceló la orden #${pedido.id}: ${error.message || error}`);
            return sinCancelar;
        }

        logger.info(`Orden #${pedido.id} cancelada por el cliente ${clave} desde el chat.`);
        await liberarConservandoTicket(this.conversacion, clave);
        return (
            `❌ Tu pedido N.° *${numero}* fue cancelado.\n\n` +
            'Escribe *hola* o *menu* cuando desees hacer un nuevo pedido o consultar algo. 🍗'
        );
    }

    /**
     * Sends the ticket of the last order made from this chat. The state is read from
     * orders-service; an order of another number is never shown, a cancelled one is not
     * presented as valid, and if the service is down the saved ticket goes out without a state.
     */
    async _enviarTicket(clave, guardado) {
        const pedido = guardado.pedido || guardado.ultimoPedido;
        if (!pedido || pedido.id === undefined || pedido.id === null) {
            return MENSAJE_SIN_TICKET;
        }
        if (!this.ordenes || typeof this.ordenes.obtener !== 'function') {
            return mensajeTicket(pedido);
        }
        try {
            const orden = await this.ordenes.obtener(pedido.id);
            if (!orden) return MENSAJE_SIN_TICKET;
            const telOrden = normalizarTelefono(orden.telefonoCliente || '');
            const telRemitente = normalizarTelefono(clave);
            if (telOrden && telRemitente && telOrden !== telRemitente) {
                logger.warn(`Ticket denegado por privacidad: ${clave} pidió la orden #${pedido.id} de ${telOrden}`);
                return MENSAJE_SIN_TICKET;
            }
            if (ESTADOS_TICKET_NO_VALIDO.includes(orden.estado)) {
                return mensajeTicketNoValido(pedido, orden.estado);
            }
            const actual = {
                ...pedido,
                numeroCliente: orden.numeroCliente != null ? orden.numeroCliente : pedido.numeroCliente,
                total: orden.total != null ? orden.total : pedido.total,
                tipo: orden.tipo || pedido.tipo
            };
            return mensajeTicket(actual, orden.estado);
        } catch (error) {
            logger.warn(`No se pudo consultar la orden #${pedido.id} para el ticket: ${error.message || error}`);
            return mensajeTicket(pedido);
        }
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

    /**
     * Checkout checklist: asks only for what is still missing, in order (delivery mode, address
     * and reference for delivery, payment method, cash amount) and creates the order at the end.
     * Every answer comes back here, so a retry after a failure goes straight to creation.
     */
    async _confirmar(clave, guardado) {
        const carrito = guardado.carrito || [];
        if (!carrito.length) {
            return formatearCarrito(carrito);
        }
        const preguntar = async (estado, texto) => {
            await this.conversacion.set(clave, { ...guardado, estado });
            return texto;
        };
        if (!guardado.entrega) {
            return preguntar(ESTADO_ESPERANDO_ENTREGA, PREGUNTA_ENTREGA);
        }
        if (guardado.entrega === 'DELIVERY' && !guardado.direccion) {
            return preguntar(ESTADO_ESPERANDO_DIRECCION, PREGUNTA_DIRECCION);
        }
        if (guardado.entrega === 'DELIVERY' && !guardado.referencia) {
            return preguntar(ESTADO_ESPERANDO_REFERENCIA, PREGUNTA_REFERENCIA);
        }
        if (!guardado.metodoPago) {
            return preguntar(ESTADO_ESPERANDO_METODO_PAGO, preguntaMetodoPago(guardado.entrega));
        }
        if (guardado.metodoPago === 'EFECTIVO' && guardado.montoPagaCon === undefined) {
            return preguntar(ESTADO_ESPERANDO_MONTO, PREGUNTA_MONTO_EFECTIVO);
        }
        return this._crearPedido(clave, guardado);
    }

    async _crearPedido(clave, guardado) {
        if (!this.ordenes) {
            logger.warn(`No se pudo crear pedido para ${clave}: cliente de orders-service no inyectado`);
            return this._falloPedido(clave, guardado);
        }

        const tipo = guardado.entrega === 'RECOJO' ? 'RECOJO' : 'DELIVERY';
        const efectivo = guardado.metodoPago === 'EFECTIVO';
        // Yape waits for the capture in the cashier inbox (PENDIENTE_PAGO); cash waits for the
        // cashier's confirmation call (PENDIENTE_CONFIRMACION). Neither reaches the kitchen yet.
        const datos = {
            tipo,
            canalOrigen: 'WHATSAPP',
            estadoInicial: efectivo ? 'PENDIENTE_CONFIRMACION' : 'PENDIENTE_PAGO',
            telefonoCliente: clave,
            items: guardado.carrito.map(i => ({ productoId: i.productoId, cantidad: i.cantidad }))
        };
        if (tipo === 'DELIVERY') {
            datos.direccionEntrega = guardado.direccion;
            datos.referencia = guardado.referencia;
        }
        if (efectivo && guardado.montoPagaCon) datos.montoPagaCon = guardado.montoPagaCon;
        if (guardado.nombre) datos.nombreCliente = guardado.nombre;
        if (guardado.observaciones) datos.observaciones = guardado.observaciones;

        try {
            logger.info(`Creando pedido ${tipo} (${datos.estadoInicial}) en orders-service para ${clave}...`);
            const orden = await this.ordenes.crear(datos);
            const pedido = {
                id: orden.id,
                numeroCliente: orden.numeroCliente,
                total: orden.total,
                tipo,
                metodoPago: efectivo ? 'EFECTIVO' : 'YAPE',
                montoPagaCon: orden.montoPagaCon,
                vueltoEstimado: orden.vueltoEstimado
            };
            await this.conversacion.set(clave, { estado: ESTADO_PEDIDO_CONFIRMADO, pedido, ultimoPedido: pedido });
            logger.success(`Pedido creado con éxito: orden #${orden.id} (número cliente #${orden.numeroCliente}, total: S/ ${orden.total}). Estado de ${clave} actualizado a ${ESTADO_PEDIDO_CONFIRMADO}`);
            return mensajePedidoCreado(pedido, this.ajustes);
        } catch (error) {
            const status = error && error.status;
            const detalle = (error && error.detalle) || '';
            if (status === 409 && efectivo && /sanci[oó]n/i.test(detalle)) {
                // orders-service refuses cash for a number sanctioned by a ghost order (S8).
                // Only a 409 that mentions the sanction is one; any other 409 is a plain failure.
                logger.warn(`ContraPago rechazado para ${clave}: número sancionado por pedido fantasma`);
                await this.conversacion.set(clave, {
                    ...guardado,
                    metodoPago: undefined,
                    montoPagaCon: undefined,
                    sancionContraPago: true,
                    estado: ESTADO_ESPERANDO_METODO_PAGO
                });
                return MENSAJE_SANCION_CONTRAPAGO;
            }
            if (status === 400 && efectivo && /no cubre/i.test(detalle)) {
                // The cash amount does not cover the real total (delivery fee included): ask again.
                logger.warn(`Monto de efectivo rechazado para ${clave}: ${detalle}`);
                await this.conversacion.set(clave, {
                    ...guardado,
                    montoPagaCon: undefined,
                    estado: ESTADO_ESPERANDO_MONTO
                });
                return `${detalle}\n\n${PREGUNTA_MONTO_EFECTIVO}`;
            }
            logger.error(`Fallo al crear orden para ${clave} en orders-service: ${error.message || error}`);
            // Fallo explícito: no se inventa número de pedido y el carrito no se pierde.
            if ((status === 400 || status === 409) && detalle) {
                await this.conversacion.set(clave, { ...guardado, estado: ESTADO_CATALOGO });
                return mensajePedidoRechazado(detalle);
            }
            return this._falloPedido(clave, guardado);
        }
    }

    async _falloPedido(clave, guardado) {
        await this.conversacion.set(clave, { ...guardado, estado: ESTADO_CATALOGO });
        return MENSAJE_PEDIDO_FALLIDO;
    }

    async _descargarMediaDirectoPuppeteer(msg) {
        if (!msg || !msg.client || !msg.client.pupPage || msg.client.pupPage.isClosed()) {
            return null;
        }
        const idMsg = String(msg.id?._serialized || msg.id?.id || msg.id || '');
        const partes = idMsg.split('_');
        const stanzaId = partes[partes.length - 1];
        const remitente = String(msg.from || '');

        logger.info(`Intentando extracción directa de media por Puppeteer para stanzaId=${stanzaId}, remitente=${remitente}...`);

        try {
            const res = await msg.client.pupPage.evaluate(async (stanzaId, idMsg, remitente) => {
                const collections = window.require('WAWebCollections') || {};
                const Msg = collections.Msg;
                const Chat = collections.Chat;

                let targetMsg = null;

                // 1. Buscar en Chats activos (cada chat mantiene chat.msgs)
                if (Chat) {
                    const chats = (typeof Chat.getModelsArray === 'function' ? Chat.getModelsArray() : null) || Chat._models || Chat.models || [];
                    if (Array.isArray(chats)) {
                        for (const c of chats) {
                            const msgs = (c.msgs && typeof c.msgs.getModelsArray === 'function' ? c.msgs.getModelsArray() : null) || c.msgs?._models || c.msgs?.models || [];
                            if (Array.isArray(msgs)) {
                                targetMsg = msgs.find(m => {
                                    if (!m || !m.id) return false;
                                    const idStr = m.id._serialized || m.id.id || m.id.$1 || '';
                                    return idStr === idMsg || m.id.id === stanzaId || idStr.endsWith(stanzaId);
                                });
                                if (targetMsg) break;
                            }
                        }
                    }
                }

                // 2. Si no se encontró en Chats, buscar en Msg global
                if (!targetMsg && Msg) {
                    if (typeof Msg.get === 'function') {
                        targetMsg = Msg.get(idMsg) || (remitente.includes('@lid') ? Msg.get(idMsg.replace(/@lid/g, '@c.us')) : null);
                    }
                    if (!targetMsg) {
                        const lista = Msg._models || (typeof Msg.getModelsArray === 'function' ? Msg.getModelsArray() : null) || Msg.models || [];
                        if (Array.isArray(lista)) {
                            targetMsg = lista.find(m => {
                                if (!m || !m.id) return false;
                                const idStr = m.id._serialized || m.id.id || m.id.$1 || '';
                                return idStr === idMsg || m.id.id === stanzaId || idStr.endsWith(stanzaId);
                            });
                        }
                    }
                }

                // 3. Si encontramos el modelo pero no ha descargado, intentar downloadMedia interno
                if (targetMsg && typeof targetMsg.downloadMedia === 'function') {
                    try {
                        await targetMsg.downloadMedia({
                            downloadEvenIfExpensive: true,
                            rmrReason: 1,
                            isUserInitiated: true,
                        });
                    } catch (_) {}
                }

                // 4. Extracción del blob desde cache o forceToBlob
                let blob = null;
                if (targetMsg) {
                    const filehash = targetMsg.mediaObject?.filehash || targetMsg.mediaData?.filehash;
                    if (filehash) {
                        try {
                            blob = window.require('WAWebMediaInMemoryBlobCache')?.InMemoryMediaBlobCache?.get(filehash);
                        } catch (_) {}
                    }
                    if (!blob && targetMsg.mediaObject?.mediaBlob && typeof targetMsg.mediaObject.mediaBlob.forceToBlob === 'function') {
                        try { blob = targetMsg.mediaObject.mediaBlob.forceToBlob(); } catch (_) {}
                    }
                    if (!blob && targetMsg.mediaData?.mediaBlob && typeof targetMsg.mediaData.mediaBlob.forceToBlob === 'function') {
                        try { blob = targetMsg.mediaData.mediaBlob.forceToBlob(); } catch (_) {}
                    }
                }

                // 5. Fallback DOM: si aún no hay blob, buscar cualquier elemento <img> con blob en el chat
                if (!blob) {
                    const imgs = Array.from(document.querySelectorAll(`[data-id*="${stanzaId}"] img[src^="blob:"], img[src^="blob:"]`));
                    if (imgs.length > 0) {
                        const targetImg = imgs[imgs.length - 1];
                        if (targetImg && targetImg.src) {
                            try {
                                const resp = await fetch(targetImg.src);
                                blob = await resp.blob();
                            } catch (_) {}
                        }
                    }
                }

                if (!blob) return null;

                // 6. Convertir blob a base64 usando FileReader
                const base64Data = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const res = String(reader.result || '');
                        const idx = res.indexOf(',');
                        resolve(idx !== -1 ? res.slice(idx + 1) : res);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });

                return {
                    mimetype: targetMsg?.mimetype || targetMsg?.mediaData?.mimetype || blob.type || 'image/jpeg',
                    data: base64Data,
                    filename: targetMsg?.filename || targetMsg?.mediaData?.filename || 'comprobante.jpg',
                    filesize: targetMsg?.size || targetMsg?.mediaData?.size || blob.size
                };
            }, stanzaId, idMsg, remitente);

            if (res && res.data) {
                logger.success(`Extracción directa por Puppeteer exitosa para mensaje ${stanzaId} (${res.data.length} chars base64, mime=${res.mimetype})`);
                return res;
            }
        } catch (pupErr) {
            logger.warn(`Extracción directa por Puppeteer falló para ${stanzaId}: ${pupErr.message}`);
        }
        return null;
    }

    async _descargarMediaConReintento(msg, maxIntentos = 4, esperaMs = 500) {
        if (!msg || typeof msg.downloadMedia !== 'function') {
            logger.warn(`downloadMedia no es una función en msg (tipo: ${msg && msg.type})`);
            return null;
        }
        let ultimoError = null;
        for (let intento = 1; intento <= maxIntentos; intento += 1) {
            try {
                logger.info(`Descargando archivo adjunto (intento ${intento}/${maxIntentos}) para mensaje id=${idDeMensaje(msg)}...`);
                let media = await msg.downloadMedia();

                // Fallback 1: Si downloadMedia() arrojó vacío o null pero existe pupPage, probar extracción directa por Puppeteer
                if ((!media || !media.data) && msg.client && msg.client.pupPage) {
                    try {
                        media = await this._descargarMediaDirectoPuppeteer(msg);
                    } catch (pupErr) {
                        logger.debug(`Fallback Puppeteer no disponible en intento ${intento}: ${pupErr.message}`);
                    }
                }

                // Fallback 2: si aún está vacío o null pero existe downloadMediaStream(), probar extracción por streaming
                if ((!media || !media.data) && typeof msg.downloadMediaStream === 'function') {
                    try {
                        const streamResult = await msg.downloadMediaStream();
                        if (streamResult && streamResult.stream) {
                            const chunks = [];
                            for await (const chunk of streamResult.stream) {
                                chunks.push(chunk);
                            }
                            const buffer = Buffer.concat(chunks);
                            if (buffer.length > 0) {
                                media = {
                                    mimetype: streamResult.mimetype || msg.mimetype || 'image/jpeg',
                                    data: buffer.toString('base64'),
                                    filename: streamResult.filename || msg.filename || 'comprobante.jpg',
                                    filesize: streamResult.filesize || buffer.length
                                };
                            }
                        }
                    } catch (streamErr) {
                        logger.debug(`Fallback downloadMediaStream no disponible en intento ${intento}: ${streamErr.message}`);
                    }
                }

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
                const pausa = esperaMs * intento;
                logger.info(`Esperando ${pausa}ms antes del reintento ${intento + 1}...`);
                await this.dormir(pausa);
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
        const pedido = guardado && (guardado.estado === ESTADO_PEDIDO_CONFIRMADO || guardado.estado === ESTADO_COMPROBANTE_RECIBIDO) ? guardado.pedido : null;
        if (!pedido || pedido.id === undefined || pedido.id === null) {
            logger.warn(`Comprobante recibido de "${clave}", pero NO hay un pedido confirmado en curso. Estado actual: "${guardado ? guardado.estado : 'sin estado'}", pedido: ${JSON.stringify(pedido)}. Se avisará al cliente que primero debe confirmar un pedido.`);
            return mensajeSinPedidoConfirmado();
        }

        if (pedido.metodoPago === 'EFECTIVO') {
            return MENSAJE_EFECTIVO_SIN_CAPTURA;
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
        let pagoRegistrado = null;
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
            pagoRegistrado = await this.pagos.registrarComprobante({
                ordenId: pedido.id,
                telefono: clave,
                monto: pedido.total,
                comprobanteClave: claveObjeto
            });
            logger.success(`Comprobante orden #${pedido.id}: registrado exitosamente en payments-service.`);
        } catch (error) {
            if (error && error.status === 409 && /ya no est[aá] activ/i.test(error.detalle || '')) {
                // The order was cancelled or finished meanwhile: no capture can be registered,
                // so free the conversation (keeping the ticket) for a new order.
                logger.warn(`Comprobante orden #${pedido.id}: la orden ya no está activa (${error.detalle}). Se libera la conversación.`);
                await liberarConservandoTicket(this.conversacion, clave);
                return MENSAJE_PEDIDO_NO_ACTIVO;
            }
            console.error(`❌ Comprobante orden #${pedido.id}: fallo al registrar en payments-service: ${error.message || error}`);
            return MENSAJE_COMPROBANTE_FALLO_REGISTRO;
        }

        if (pagoRegistrado && pagoRegistrado.estado === 'APROBADO') {
            // payments-service returns the payment it already has: an approved one means this
            // capture is not needed and nothing is left to review.
            logger.info(`Comprobante orden #${pedido.id}: el pago ya estaba APROBADO. Se libera la conversación.`);
            await liberarConservandoTicket(this.conversacion, clave);
            return (
                `✅ El pago de tu pedido N.° *${numeroDePedido(pedido)}* ya está confirmado, no necesitas enviar otro comprobante.\n\n` +
                'Te avisaremos por este chat cuando tu pedido avance. Escribe *ticket* para ver su estado. 🍗'
            );
        }

        logger.success(`Comprobante orden #${pedido.id}: comprobante verificado y registrado. Notificando al cliente.`);
        await this.conversacion.set(clave, {
            ...guardado,
            estado: ESTADO_COMPROBANTE_RECIBIDO,
            comprobanteRecibido: true,
            pedido
        });
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
    ESTADO_COMPROBANTE_RECIBIDO,
    ESTADO_ESPERANDO_CODIGO,
    ESTADO_ESPERANDO_ENTREGA,
    ESTADO_ESPERANDO_METODO_PAGO,
    ESTADO_ESPERANDO_MONTO,
    claveDeUsuario,
    idDeMensaje
};
