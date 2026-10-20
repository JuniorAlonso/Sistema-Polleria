/**
 * Textos y formato del bot de pedidos (T3a, S12).
 *
 * La carta ya NO tiene precios escritos a mano: se arma con los productos reales que
 * devuelve orders-service. Los números de contacto salen del store de ajustes en
 * memoria (T5); si no hay ninguno configurado, se dice tal cual y no se inventa un
 * número inexistente.
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

/** Carta real de orders-service, sin precios hardcodeados. */
function formatearCatalogo(productos) {
    const lineas = productos.map(p => {
        const descripcion = p.descripcion ? ` — ${p.descripcion}` : '';
        return `• ${p.nombre}${descripcion}: *S/ ${formatearPrecio(p.precio)}*`;
    });
    return `*NUESTRA CARTA*\n\n${lineas.join('\n')}\n\n¿Qué te gustaría pedir?`;
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
    formatearTelefono,
    formatearPrecio,
    lineaContacto,
    respuestaAsesor,
    formatearCatalogo,
    mensajeSinServicio,
    mensajeSinProductos
};
