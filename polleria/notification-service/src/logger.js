/**
 * Utilidad de logging unificada para notification-service.
 * Muestra timestamps precisos, módulo de origen y emojis visuales para facilitar
 * el seguimiento del flujo de mensajes, comprobantes, MinIO y llamadas HTTP.
 */

function obtenerTimestamp() {
    const ahora = new Date();
    const pad = (n, len = 2) => String(n).padStart(len, '0');
    const horas = pad(ahora.getHours());
    const minutos = pad(ahora.getMinutes());
    const segundos = pad(ahora.getSeconds());
    const ms = pad(ahora.getMilliseconds(), 3);
    return `${horas}:${minutos}:${segundos}.${ms}`;
}

function crearLogger(modulo) {
    const prefijo = (emoji) => `[${obtenerTimestamp()}] ${emoji} [${modulo}]`;

    return {
        info(mensaje, ...args) {
            console.log(`${prefijo('ℹ️')} ${mensaje}`, ...args);
        },
        success(mensaje, ...args) {
            console.log(`${prefijo('✅')} ${mensaje}`, ...args);
        },
        warn(mensaje, ...args) {
            console.warn(`${prefijo('⚠️')} ${mensaje}`, ...args);
        },
        error(mensaje, ...args) {
            console.error(`${prefijo('❌')} ${mensaje}`, ...args);
        },
        debug(mensaje, ...args) {
            console.log(`${prefijo('🔍')} ${mensaje}`, ...args);
        },
        custom(emoji, mensaje, ...args) {
            console.log(`${prefijo(emoji)} ${mensaje}`, ...args);
        }
    };
}

module.exports = {
    crearLogger,
    obtenerTimestamp
};
