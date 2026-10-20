/**
 * Textos y formato del bot de pedidos (T3a/T3b, S1/S4/S12).
 *
 * La carta ya NO tiene precios escritos a mano: se arma con los productos reales que
 * devuelve orders-service. Los números de contacto salen del store de ajustes en
 * memoria (T5); si no hay ninguno configurado, se dice tal cual y no se inventa un
 * número inexistente.
 *
 * T3b agrega el carrito: la carta se numera para poder agregar productos por su número
 * y el resumen muestra SOLO el subtotal. El bot no calcula el envío (S12): el total
 * final sale de orders-service al crear la orden.
 */

function getMainMenu() {
    return (
        '🍗 *¡Bienvenido a San Pollo!* 🍗\n\n' +
        'Por favor, responde enviando solo el número de la opción que deseas:\n\n' +
        '1️⃣.- Hacer un Pedido\n' +
        '2️⃣.- Consultar estado de mi Pedido\n' +
        '3️⃣.- Horarios de Atención y Ubicación\n' +
        '4️⃣.- Hablar con un Asesor\n\n' +
        '_Escribe un número del 1 al 4_'
    );
}

const PREGUNTA_ICA =
    'Para continuar con tu pedido, confírmanos por favor que el delivery es en *Ica*.\n\n' +
    '¿Eres de Ica? Responde *sí* o *no*.';

const SOLO_ICA =
    'Lo sentimos: el delivery de San Pollo cubre solo *Ica*, ' +
    'así que no podemos tomar tu pedido por WhatsApp.';

const PREGUNTA_DIRECCION =
    '¿A qué *dirección* te llevamos tu pedido? ' +
    'Indícame calle, número y distrito (por ejemplo: Av. Grau 123, Ica).';

const PREGUNTA_REFERENCIA =
    '¿Tienes alguna *referencia* para llegar? (frente a, al lado de, color de la fachada)\n' +
    'Si no tienes, escribe *sin referencia*.';

const CARRITO_VACIO =
    '🛒 Tu carrito está vacío. Escribe *carta* para ver los productos y agrega uno con su número.';

const MENSAJE_PEDIDO_FALLIDO =
    'No pudimos registrar tu pedido en este momento: el sistema de pedidos no respondió.\n' +
    'Tu carrito sigue guardado. Escribe *confirmar* para reintentar.';

// T6b: recepción del comprobante de Yape.
const MENSAJE_PIDE_IMAGEN_COMPROBANTE =
    '📸 Necesito una *imagen*: envía una foto o captura de tu comprobante de Yape, por favor.';

const MENSAJE_COMPROBANTE_FALLO_SUBIDA =
    'No pudimos guardar la imagen de tu comprobante en este momento.\n' +
    'Vuelve a enviarla, por favor. 🙏';

const MENSAJE_COMPROBANTE_FALLO_REGISTRO =
    'Recibimos tu imagen, pero no pudimos registrar el comprobante en el sistema de pagos.\n' +
    'Vuelve a enviarla, por favor. 🙏';

function mensajeSinPedidoConfirmado() {
    return (
        'Todavía no tengo un *pedido confirmado* tuyo, así que no puedo recibir el comprobante.\n' +
        'Primero completa tu pedido y, cuando te dé el número, envíame la imagen de tu Yape.'
    );
}

function mensajeComprobanteRecibido(pedido) {
    return (
        `✅ Recibimos el comprobante de tu pedido N.° *${numeroDePedido(pedido)}*.\n` +
        'Un administrador lo va a verificar y te avisamos por este chat.'
    );
}

function formatearTelefono(numero) {
    const digitos = String(numero).replace(/\D/g, '');
    if (digitos.length === 11 && digitos.startsWith('51')) {
        const n = digitos.slice(2);
        return `+51 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
    }
    return `+${digitos}`;
}

function formatearPrecio(precio) {
    const valor = Number(precio);
    return Number.isFinite(valor) ? valor.toFixed(2) : String(precio);
}

/** Línea de contacto: asesor y, si no hay, respaldo; sin ninguno no se inventa uno. */
function lineaContacto(ajustes) {
    const valores = ajustes && typeof ajustes.obtener === 'function' ? ajustes.obtener() : {};
    const numero = valores.numeroAsesor || valores.numeroRespaldo;
    if (!numero) {
        return 'En este momento no tenemos un número de asesor configurado; inténtalo más tarde.';
    }
    return `Puedes llamarnos al *${formatearTelefono(numero)}*.`;
}

/** Respuesta de la opción 4 (hablar con un asesor). */
function respuestaAsesor(ajustes) {
    return `👤 Un asesor de nuestro equipo te atenderá. ${lineaContacto(ajustes)}`;
}

/** Carta real de orders-service, numerada para poder agregar por número (T3b). */
function formatearCatalogo(productos) {
    const lineas = productos.map((p, i) => {
        const descripcion = p.descripcion ? ` — ${p.descripcion}` : '';
        return `${i + 1}. ${p.nombre}${descripcion}: *S/ ${formatearPrecio(p.precio)}*`;
    });
    return (
        `*NUESTRA CARTA*\n\n${lineas.join('\n')}\n\n` +
        'Responde con el *número* del producto para agregarlo a tu carrito.\n' +
        'Escribe *carrito* para verlo o *confirmar* para terminar tu pedido.'
    );
}

/** Resumen del carrito: SOLO el subtotal de los ítems, sin calcular el envío (S12). */
function formatearCarrito(carrito) {
    if (!carrito || !carrito.length) return CARRITO_VACIO;

    const lineas = carrito.map((item, i) => {
        const subtotal = Number(item.precio) * item.cantidad;
        return `${i + 1}. ${item.nombre} x${item.cantidad} — S/ ${formatearPrecio(subtotal)}`;
    });
    const subtotal = carrito.reduce((acc, item) => acc + Number(item.precio) * item.cantidad, 0);

    return (
        `🛒 *TU CARRITO*\n\n${lineas.join('\n')}\n\n` +
        `*Subtotal:* S/ ${formatearPrecio(subtotal)}\n` +
        '_El costo de envío se suma al confirmar el pedido._\n\n' +
        'Escribe *confirmar* para terminar, *quitar <número>* para quitar un producto o *carta* para ver la carta.'
    );
}

/** Confirmación final: número de pedido y total que devuelve orders-service. */
function mensajePedidoCreado(pedido) {
    const numero = numeroDePedido(pedido);
    return (
        '✅ *¡Pedido registrado!*\n\n' +
        `Tu pedido N.° *${numero}* quedó registrado por un total de *S/ ${formatearPrecio(pedido.total)}*.\n` +
        'El equipo de San Pollo coordina el pago contigo por este chat.'
    );
}

/** El pedido ya se creó (idempotencia de T3b): se recuerda y se pide el comprobante (T6b). */
function mensajePedidoYaConfirmado(pedido) {
    return (
        `Tu pedido N.° *${numeroDePedido(pedido)}* ya está registrado. ` +
        'Envíame la *imagen* de tu comprobante de Yape para que un administrador lo verifique. 📸'
    );
}

function numeroDePedido(pedido) {
    if (!pedido) return '';
    return pedido.numeroCliente != null ? pedido.numeroCliente : pedido.id;
}

/** orders-service caído: no se inventa carta, se ofrece el contacto configurado. */
function mensajeSinServicio(ajustes) {
    return (
        'En este momento no podemos tomar tu pedido: la carta no está disponible. ' +
        'Vuelve a intentarlo en unos minutos.\n\n' +
        lineaContacto(ajustes)
    );
}

function mensajeSinProductos(ajustes) {
    return (
        'La carta no tiene productos disponibles en este momento.\n\n' +
        lineaContacto(ajustes)
    );
}

module.exports = {
    getMainMenu,
    PREGUNTA_ICA,
    SOLO_ICA,
    PREGUNTA_DIRECCION,
    PREGUNTA_REFERENCIA,
    CARRITO_VACIO,
    MENSAJE_PEDIDO_FALLIDO,
    MENSAJE_PIDE_IMAGEN_COMPROBANTE,
    MENSAJE_COMPROBANTE_FALLO_SUBIDA,
    MENSAJE_COMPROBANTE_FALLO_REGISTRO,
    formatearTelefono,
    formatearPrecio,
    lineaContacto,
    respuestaAsesor,
    formatearCatalogo,
    formatearCarrito,
    mensajePedidoCreado,
    mensajePedidoYaConfirmado,
    mensajeSinPedidoConfirmado,
    mensajeComprobanteRecibido,
    numeroDePedido,
    mensajeSinServicio,
    mensajeSinProductos
};
