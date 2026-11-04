/**
 * Humanización de los envíos salientes (S2): antes de mandar el texto el servicio marca
 * visto y muestra el estado "escribiendo". La duración es proporcional al largo del
 * mensaje, acotada entre un mínimo y un máximo configurables.
 *
 * El invariante es que el bot nunca contesta instantáneamente y que un mensaje muy largo
 * no deja el indicador encendido más del máximo permitido.
 */
function duracionEscribiendo(texto, { typingMinMs, typingMaxMs, typingMsPorCaracter }) {
    const largo = String(texto ?? '').length;
    const proporcional = Math.round(largo * typingMsPorCaracter);
    return Math.min(Math.max(proporcional, typingMinMs), typingMaxMs);
}

module.exports = { duracionEscribiendo };
