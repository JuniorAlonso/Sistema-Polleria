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
    lineaContacto,
    respuestaAsesor,
    mensajeSinServicio,
    mensajeSinProductos
} = require('./menu');
const { MemoryConversationStore } = require('./conversation');
const { DedupMensajes } = require('./dedup');
const { crearCatalogo } = require('../pedidos/catalogo');
const { normalizarTelefono } = require('../notifications/phone');

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
    return normalizarTelefono(from) || String(from || '');
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
    constructor({ catalogo, ajustes, conversacion, dedup, ordenes, ahora } = {}) {
        this.catalogo = catalogo || crearCatalogo();
        this.ajustes = ajustes || null;
        this.conversacion = conversacion || new MemoryConversationStore();
        this.dedup = dedup || new DedupMensajes({ ahora });
        // Cliente de orders-service (T3b). Si no se inyecta, confirmar falla de forma
        // explícita en vez de inventar una orden.
        this.ordenes = ordenes || null;
    }

    /** Devuelve el texto a enviar o null si el mensaje no amerita respuesta. */
    async procesar(msg) {
        const id = idDeMensaje(msg);
        if (!this.dedup.registrar(id)) {
            // Reentrega de WhatsApp: el mismo paso ya se ejecutó, no se repite.
            return null;
        }
        const clave = claveDeUsuario(msg.from);
        const guardado = (await this.conversacion.get(clave)) || { estado: ESTADO_MENU };
        return this._resolver(msg, clave, guardado);
    }

    async _resolver(msg, clave, guardado) {
        const texto = textoDe(msg);
        const estado = guardado.estado || ESTADO_MENU;

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
            // Idempotencia (T3b): el pedido ya se creó; se recuerda sin crear otro.
            return mensajePedidoYaConfirmado(guardado.pedido);
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
            const orden = await this.ordenes.crear(datos);
            const pedido = { id: orden.id, numeroCliente: orden.numeroCliente, total: orden.total };
            await this.conversacion.set(clave, { estado: ESTADO_PEDIDO_CONFIRMADO, pedido });
            return mensajePedidoCreado(pedido);
        } catch (error) {
            // Fallo explícito: no se inventa número de pedido y el carrito no se pierde.
            return this._falloPedido(clave, guardado);
        }
    }

    async _falloPedido(clave, guardado) {
        await this.conversacion.set(clave, { ...guardado, estado: ESTADO_CATALOGO });
        return MENSAJE_PEDIDO_FALLIDO;
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
