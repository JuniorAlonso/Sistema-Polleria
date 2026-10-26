const config = require('../config');

const ESTADOS_DELIVERY = [
    'EN_PREPARACION',
    'PREPARANDO',
    'LISTO_PARA_ENTREGAR',
    'EN_CAMINO',
    'EN_PUERTA',
    'ENTREGADO'
];

const FIRMA = 'San Pollo de Ica';

// "MARÍA garcía" → "María"
function primerNombre(nombreCliente) {
    const nombre = String(nombreCliente || '').trim().split(/\s+/)[0];
    if (!nombre) return null;
    return nombre.charAt(0).toLocaleUpperCase('es-PE') + nombre.slice(1).toLocaleLowerCase('es-PE');
}

function saludo(nombreCliente) {
    const nombre = primerNombre(nombreCliente);
    return nombre ? `Hola, ${nombre}.` : 'Hola.';
}

function formatearMonto(monto) {
    return Number(monto).toFixed(2);
}

// 987654321 → 987 654 321
function formatearTelefono(telefono) {
    const digitos = String(telefono).replace(/\D/g, '');
    return digitos.length === 9 ? digitos.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3') : String(telefono);
}

// El cliente ve su propio número de pedido (1, 2, 3...), nunca el ID interno de la orden
function numeroVisible({ numeroPedido, ordenId }) {
    return numeroPedido || ordenId;
}

// RF30: confirmación de pago de delivery
function mensajePago({ ordenId, numeroPedido, nombreCliente, montoTotal, tiempoEstimado }) {
    const numero = numeroVisible({ numeroPedido, ordenId });
    const lineas = [
        saludo(nombreCliente),
        '',
        `Confirmamos el pago de S/ ${formatearMonto(montoTotal)} por tu pedido N.° ${numero}. ` +
            'Ya está registrado y pasará a cocina en breve.'
    ];

    if (tiempoEstimado) {
        lineas.push('', `Tiempo estimado de entrega: ${tiempoEstimado}.`);
    }

    lineas.push(
        '',
        `Si necesitas ayuda con tu pedido, puedes llamarnos al ${config.telefonoContacto}.`,
        '',
        FIRMA
    );

    return lineas.join('\n');
}

// RF31: cambio de estado de delivery
function mensajeEstado({ ordenId, numeroPedido, nombreCliente, estadoNuevo, repartidorNombre, repartidorTelefono, mensaje }) {
    const numero = numeroVisible({ numeroPedido, ordenId });
    let cuerpo;

    switch (estadoNuevo) {
        case 'EN_PREPARACION':
        case 'PREPARANDO':
            cuerpo = `Tu pedido N.° ${numero} ya está en preparación. Te avisaremos cuando salga a reparto o esté listo.`;
            break;

        case 'LISTO':
        case 'LISTO_PARA_ENTREGAR':
            cuerpo = `¡Tu pedido N.° ${numero} ya está listo! Si elegiste Recojo en Tienda, ya puedes acercarte a recogerlo a nuestro local. Recuerda que tienes hasta 1 hora para retirarlo.`;
            break;

        case 'EN_CAMINO':
            if (repartidorNombre) {
                const contacto = repartidorTelefono ? ` (${formatearTelefono(repartidorTelefono)})` : '';
                cuerpo = `Tu pedido N.° ${numero} ya salió a reparto. Te lo lleva ${repartidorNombre}${contacto}.`;
            } else {
                cuerpo = `Tu pedido N.° ${numero} ya salió a reparto y llegará en los próximos minutos.`;
            }
            break;

        case 'EN_PUERTA':
            cuerpo = `¡El repartidor ya está en tu puerta con tu pedido N.° ${numero}! Por favor sal a recibirlo.`;
            break;

        case 'ENTREGADO':
            cuerpo = `Tu pedido N.° ${numero} fue entregado. ¡Muchas gracias por elegir San Pollo!\n\n` +
                'Si tienes un momento, nos ayudaría mucho conocer tu opinión sobre el pedido.';
            break;

        default:
            return null;
    }

    // orders-service puede mandar el texto ya redactado (p. ej. recojo listo con plazo y ticket);
    // si viene, reemplaza el cuerpo genérico del estado.
    const personalizado = typeof mensaje === 'string' ? mensaje.trim() : '';
    if (personalizado) {
        cuerpo = personalizado;
    }

    return [saludo(nombreCliente), '', cuerpo, '', FIRMA].join('\n');
}

// T6d (S6): aviso al cliente cuando el administrador rechaza el comprobante de Yape. El
// rechazo deja el pedido impago esperando un comprobante válido, así que el mensaje dice
// qué pasó, el motivo del admin y cómo completar el pago.
function mensajeComprobanteRechazado({ ordenId, numeroPedido, nombreCliente, motivo }) {
    const numero = numeroVisible({ numeroPedido, ordenId });
    return [
        saludo(nombreCliente),
        '',
        `No pudimos validar el comprobante de Yape de tu pedido N.° ${numero}.`,
        `Motivo: ${motivo}`,
        '',
        'Puedes enviar un comprobante nuevo por este mismo chat para completar el pago.',
        '',
        FIRMA
    ].join('\n');
}

// Código para ver los pedidos sin iniciar sesión
function mensajeCodigo({ codigo }) {
    return [
        `Tu código para ver tus pedidos en ${FIRMA} es ${codigo}.`,
        '',
        'Vence en 5 minutos. Si no lo solicitaste, puedes ignorar este mensaje.'
    ].join('\n');
}

module.exports = {
    ESTADOS_DELIVERY,
    mensajePago,
    mensajeEstado,
    mensajeComprobanteRechazado,
    mensajeCodigo
};
