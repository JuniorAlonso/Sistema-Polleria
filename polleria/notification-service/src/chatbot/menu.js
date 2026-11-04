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
        '4️⃣.- Hablar con un Asesor\n' +
        '5️⃣.- Ver mi ticket de pedido\n\n' +
        '_Escribe un número del 1 al 5_'
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

const PREGUNTA_ENTREGA =
    '¿Cómo deseas recibir tu pedido?\n\n' +
    '*1* - Delivery a tu dirección\n' +
    '*2* - Recojo en tienda (Av. Principal 123, Ica)';

/** Payment question. Cash is only offered as ContraPago: on delivery or when picking up. */
function preguntaMetodoPago(entrega) {
    const efectivo = entrega === 'RECOJO' ? 'Efectivo al recoger en tienda' : 'Efectivo contra entrega';
    return (
        '¿Cómo vas a pagar?\n\n' +
        '*1* - Yape (envías la captura por este chat)\n' +
        `*2* - ${efectivo} (te llamamos para confirmar)`
    );
}

const PREGUNTA_MONTO_EFECTIVO =
    '💵 ¿Con cuánto vas a pagar? Escribe el monto del billete (por ejemplo: *50*) para llevarte el vuelto, ' +
    'o escribe *exacto* si pagarás el monto justo.';

const MENSAJE_SANCION_CONTRAPAGO =
    '⚠️ Tu número registra un *pedido no recibido* anteriormente, por eso no podemos aceptar pago en efectivo.\n\n' +
    'Puedes completar tu pedido pagando con *Yape*: responde *1*. O escribe *cancelar* para salir.';

const MENSAJE_EFECTIVO_SIN_CAPTURA =
    'Tu pedido es con *pago en efectivo*, así que no necesitas enviar ninguna captura. ' +
    'Te llamaremos para confirmarlo. 📞';

const CARRITO_VACIO =
    '🛒 Tu carrito está vacío. Escribe *carta* para ver los productos y agrega uno con su número.';

const MENSAJE_PEDIDO_FALLIDO =
    'No pudimos registrar tu pedido en este momento: el sistema de pedidos no respondió.\n' +
    'Tu carrito sigue guardado. Escribe *confirmar* para reintentar.';

/** orders-service rejected the order with a business reason (400/409): say it, keep the cart. */
function mensajePedidoRechazado(detalle) {
    return `No pudimos registrar tu pedido: ${detalle}\n` +
        'Tu carrito sigue guardado. Escribe *confirmar* para reintentar o *cancelar* para salir.';
}

const MENSAJE_PEDIDO_NO_ACTIVO =
    '⚠️ Este pedido *ya no está activo* (fue cancelado o finalizado), así que no podemos registrar el comprobante.\n\n' +
    'Escribe *ticket* para ver su estado o *1* para hacer un pedido nuevo.';

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

/**
 * T6f: el dueño pidió que el cliente pague por Yape al número de la pollería y mande la captura
 * para que un administrador la revise a mano. El número es configuración del panel y puede quedar
 * vacío: si no hay número, no se inventa uno, solo se pide la captura.
 */
function lineaPagoYape(ajustes) {
    // El bot recibe el store en memoria, no un objeto plano: se lee igual que `lineaContacto`.
    const valores = ajustes && typeof ajustes.obtener === 'function' ? ajustes.obtener() : {};
    const numero = valores.numeroYape;
    if (!numero) {
        return 'Para completar el pago, envíame la *captura* de tu Yape. 📸';
    }
    return 'Paga por *Yape* al *' + formatearTelefono(numero) + '* y envíame la *captura* por este chat '
        + 'para que un administrador la revise. 📸';
}

/** Minutes the customer has to send the Yape capture or answer the confirmation call (backend rule). */
const MINUTOS_VALIDACION_PAGO = 15;

/** Cash line: amount to pay and the change the courier/cashier will bring. */
function lineaEfectivo(pedido) {
    const lugar = pedido.tipo === 'RECOJO' ? 'al recoger tu pedido en tienda' : 'al repartidor cuando llegue';
    let linea = `💵 Pagarás *S/ ${formatearPrecio(pedido.total)}* en efectivo ${lugar}.`;
    const pagaCon = Number(pedido.montoPagaCon);
    if (Number.isFinite(pagaCon) && pagaCon > 0) {
        const vuelto = Number(pedido.vueltoEstimado);
        linea += Number.isFinite(vuelto) && vuelto > 0
            ? ` Pagas con S/ ${formatearPrecio(pagaCon)}: tu vuelto será *S/ ${formatearPrecio(vuelto)}*.`
            : ` Ten en cuenta que el total es S/ ${formatearPrecio(pedido.total)}.`;
    }
    return linea;
}

/** Next payment step: cash orders wait for the cashier's call, Yape orders for the capture. */
function lineaSiguientePaso(pedido, ajustes) {
    if (pedido.metodoPago === 'EFECTIVO') {
        return (
            `📞 En los próximos ${MINUTOS_VALIDACION_PAGO} minutos te llamaremos para confirmar tu pedido; ` +
            'si no logramos confirmarlo, se cancelará.\n\n' +
            lineaEfectivo(pedido)
        );
    }
    return (
        lineaPagoYape(ajustes) + '\n' +
        `⏳ Tienes *${MINUTOS_VALIDACION_PAGO} minutos* para enviar la captura; pasado ese plazo el pedido se cancela.`
    );
}

/** Ticket code: the same POL-<order id> the cashier checks at the pickup counter. */
function codigoTicket(pedido) {
    return `POL-${pedido.id}`;
}

const ESTADOS_TICKET = {
    RECIBIDO: 'Recibido',
    PENDIENTE_PAGO: 'Esperando la captura de tu Yape',
    PENDIENTE_CONFIRMACION: 'Esperando nuestra llamada de confirmación',
    EN_PREPARACION: 'En preparación',
    PREPARANDO: 'En preparación',
    LISTO: 'Listo',
    LISTO_PARA_ENTREGAR: 'Listo',
    EN_CAMINO: 'En camino',
    EN_PUERTA: 'El repartidor está en tu puerta',
    ENTREGADO: 'Entregado'
};

/**
 * Ticket the customer shows at the counter (pickup) or to the courier. `estado` is the current
 * state read from orders-service; without it (service down) no state is shown.
 */
function mensajeTicket(pedido, estado) {
    const recojo = pedido.tipo === 'RECOJO';
    let estadoTexto = estado ? ESTADOS_TICKET[estado] || estado : null;
    if (recojo && (estado === 'LISTO' || estado === 'LISTO_PARA_ENTREGAR')) {
        estadoTexto = 'Listo para recoger en tienda (tienes 1 hora)';
    }
    const lineas = [
        '🎫 *TU TICKET DE PEDIDO*',
        '',
        `Código: *${codigoTicket(pedido)}*`,
        `Pedido N.° *${numeroDePedido(pedido)}* — ${recojo ? 'Recojo en tienda' : 'Delivery'}`
    ];
    if (pedido.total !== undefined && pedido.total !== null) {
        lineas.push(`Total: S/ ${formatearPrecio(pedido.total)}`);
    }
    if (pedido.metodoPago) {
        lineas.push(`Pago: ${pedido.metodoPago === 'EFECTIVO' ? 'Efectivo' : 'Yape'}`);
    }
    if (estadoTexto) lineas.push(`Estado: ${estadoTexto}`);
    lineas.push('');
    lineas.push(recojo
        ? 'Presenta este código en caja al recoger tu pedido. 🧾'
        : 'Presenta este código si el repartidor te lo pide. 🧾');
    lineas.push('Escribe *ticket* cuando quieras volver a verlo.');
    return lineas.join('\n');
}

function mensajeTicketNoValido(pedido, estado) {
    const motivo = estado === 'CANCELADO' ? 'fue cancelado' : 'se cerró como no recibido';
    return (
        `Tu último pedido (*${codigoTicket(pedido)}*) ${motivo}, así que su ticket ya no es válido.\n` +
        'Escribe *1* para hacer un nuevo pedido.'
    );
}

const MENSAJE_SIN_TICKET =
    'No encontramos un pedido reciente hecho desde este WhatsApp, así que no hay ticket que enviarte.\n' +
    'Escribe *1* para hacer un pedido o *2* para consultar uno con su número.';

/** Final confirmation: order number, total, the next payment step and the ticket. */
function mensajePedidoCreado(pedido, ajustes) {
    const numero = numeroDePedido(pedido);
    const entrega = pedido.tipo === 'RECOJO' ? 'para *recojo en tienda*' : 'para *delivery*';
    return (
        '✅ *¡Pedido registrado!*\n\n' +
        `Tu pedido N.° *${numero}* ${entrega} quedó registrado por un total de *S/ ${formatearPrecio(pedido.total)}*.\n` +
        'El equipo de San Pollo coordina el pago contigo por este chat.\n\n' +
        lineaSiguientePaso(pedido, ajustes) + '\n\n' +
        mensajeTicket(pedido)
    );
}

/** El pedido ya se creó (idempotencia de T3b): se recuerda el siguiente paso del pago. */
function mensajePedidoYaConfirmado(pedido, ajustes) {
    return (
        `Tu pedido N.° *${numeroDePedido(pedido)}* ya está registrado.\n\n` +
        lineaSiguientePaso(pedido, ajustes)
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
    PREGUNTA_ENTREGA,
    preguntaMetodoPago,
    PREGUNTA_MONTO_EFECTIVO,
    MENSAJE_SANCION_CONTRAPAGO,
    MENSAJE_EFECTIVO_SIN_CAPTURA,
    MINUTOS_VALIDACION_PAGO,
    codigoTicket,
    mensajeTicket,
    mensajeTicketNoValido,
    MENSAJE_SIN_TICKET,
    CARRITO_VACIO,
    MENSAJE_PEDIDO_FALLIDO,
    mensajePedidoRechazado,
    MENSAJE_PEDIDO_NO_ACTIVO,
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
