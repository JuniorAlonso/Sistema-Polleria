/**
 * Motor conversacional del bot de pedidos (T3a, S1/S4/S12).
 *
 * El bot DEVUELVE el texto y nunca envía por su cuenta: el handler lo encola en la
 * única cola saliente (T4). Este archivo resuelve el estado de cada conversación:
 *
 * - MENU: menú de 4 opciones; la 1 (o un mensaje que pide un pedido) inicia el flujo.
 * - CONFIRMANDO_ICA: primer paso OBLIGATORIO antes de tomar cualquier pedido (S12).
 * - CATALOGO: muestra la carta real de orders-service (T3a termina aquí, sin carrito).
 * - ESPERANDO_CODIGO_PEDIDO: se conserva el flujo viejo de consulta de pedido.
 *
 * El estado se lee/escribe en un store persistido (misma base que el historial) y el
 * dedup por `message.id` evita ejecutar dos veces la reentrega de un mensaje.
 */

const {
    getMainMenu,
    PREGUNTA_ICA,
    SOLO_ICA,
    lineaContacto,
    respuestaAsesor,
    formatearCatalogo,
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
const ESTADO_ESPERANDO_CODIGO = 'ESPERANDO_CODIGO_PEDIDO';

const SALUDOS = ['hola', 'holi', 'buenas', 'menu', 'opciones'];
const AFIRMATIVOS = ['si', 's', 'yes', 'claro', 'confirmo', 'correcto', 'soy de ica'];
const NEGATIVOS = ['no', 'n', 'no soy de ica'];

function sinDiacriticos(texto) {
    return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function textoDe(msg) {
    return sinDiacriticos((msg.body || msg.caption || '').toLowerCase().trim());
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
    constructor({ catalogo, ajustes, conversacion, dedup, ahora } = {}) {
        this.catalogo = catalogo || crearCatalogo();
        this.ajustes = ajustes || null;
        this.conversacion = conversacion || new MemoryConversationStore();
        this.dedup = dedup || new DedupMensajes({ ahora });
    }

    /** Devuelve el texto a enviar o null si el mensaje no amerita respuesta. */
    async procesar(msg) {
        const id = idDeMensaje(msg);
        if (!this.dedup.registrar(id)) {
            // Reentrega de WhatsApp: el mismo paso ya se ejecutó, no se repite.
            return null;
        }
        const clave = claveDeUsuario(msg.from);
        const guardado = await this.conversacion.get(clave);
        const estado = guardado ? guardado.estado : ESTADO_MENU;
        return this._resolver(msg, clave, estado);
    }

    async _resolver(msg, clave, estado) {
        const texto = textoDe(msg);

        if (estado === ESTADO_ESPERANDO_CODIGO) {
            await this.conversacion.del(clave);
            const codigo = (msg.body || msg.caption || '').trim();
            return `Recibí tu código de pedido: *${codigo}*`;
        }

        if (estado === ESTADO_CONFIRMANDO_ICA) {
            return this._resolverIca(texto, clave);
        }

        if (estado === ESTADO_CATALOGO) {
            const resultado = await this._cargarCatalogo();
            return resultado.texto;
        }

        // Estado MENU
        if (SALUDOS.includes(texto)) return getMainMenu();

        if (texto === '1' || esIntentoDePedido(texto)) {
            await this.conversacion.set(clave, ESTADO_CONFIRMANDO_ICA);
            return PREGUNTA_ICA;
        }

        if (texto === '2') {
            await this.conversacion.set(clave, ESTADO_ESPERANDO_CODIGO);
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
            await this.conversacion.set(clave, resultado.ok ? ESTADO_CATALOGO : ESTADO_MENU);
            return resultado.texto;
        }

        if (esNegativo(texto)) {
            await this.conversacion.set(clave, ESTADO_MENU);
            return `${SOLO_ICA}\n\n${lineaContacto(this.ajustes)}`;
        }

        return PREGUNTA_ICA;
    }

    async _cargarCatalogo() {
        try {
            const productos = await this.catalogo.listar();
            if (!productos.length) {
                return { ok: false, texto: mensajeSinProductos(this.ajustes) };
            }
            return { ok: true, texto: formatearCatalogo(productos) };
        } catch (error) {
            // orders-service no respondió: no se inventa catálogo, se ofrece el asesor.
            return { ok: false, texto: mensajeSinServicio(this.ajustes) };
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
    ESTADO_ESPERANDO_CODIGO,
    claveDeUsuario,
    idDeMensaje
};
