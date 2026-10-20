/**
 * Ajustes anti-baneo EN MEMORIA (S8).
 *
 * Los valores por defecto salen de `src/config.js` (variables de entorno) y se pueden
 * editar en caliente; viven solo en el proceso y se pierden al reiniciar, que es
 * exactamente lo pedido. No hay persistencia: no escribir tablas ni archivos de estado.
 *
 * T4 expone el store y su uso (delay, jitter, humanización). T4b agrega el presupuesto
 * por hora/día, la ventana horaria y el backoff del circuit breaker al mismo store. La
 * API HTTP del panel es T5: no agregar rutas aquí.
 */

const { antiBaneo: VALORES_POR_DEFECTO } = require('../config');

const CAMPOS_AJUSTES = [
    'intervaloMs',
    'jitterPct',
    'typingMinMs',
    'typingMaxMs',
    'typingMsPorCaracter',
    'presupuestoHora',
    'presupuestoDia',
    'horaDesde',
    'horaHasta',
    'breakerBaseMs',
    'breakerMaxMs'
];

function validarNumericos(valores) {
    for (const campo of CAMPOS_AJUSTES) {
        const valor = valores[campo];
        if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0) {
            throw new RangeError(`${campo} debe ser un número mayor o igual a 0`);
        }
    }
    if (valores.jitterPct > 100) {
        throw new RangeError('jitterPct debe estar entre 0 y 100');
    }
    if (valores.typingMaxMs < valores.typingMinMs) {
        throw new RangeError('typingMaxMs no puede ser menor que typingMinMs');
    }

    // Presupuesto (T4b): al menos un envío por período; si no, la cola quedaría pausada siempre.
    if (!Number.isInteger(valores.presupuestoHora) || valores.presupuestoHora < 1) {
        throw new RangeError('presupuestoHora debe ser un entero mayor o igual a 1');
    }
    if (!Number.isInteger(valores.presupuestoDia) || valores.presupuestoDia < 1) {
        throw new RangeError('presupuestoDia debe ser un entero mayor o igual a 1');
    }

    // Ventana horaria (T4b): horas del día 0-23.
    for (const campo of ['horaDesde', 'horaHasta']) {
        if (!Number.isInteger(valores[campo]) || valores[campo] < 0 || valores[campo] > 23) {
            throw new RangeError(`${campo} debe ser una hora entera entre 0 y 23`);
        }
    }

    // Circuit breaker (T4b): el tope no puede ser menor que la base.
    if (valores.breakerBaseMs < 1) {
        throw new RangeError('breakerBaseMs debe ser mayor o igual a 1');
    }
    if (valores.breakerMaxMs < valores.breakerBaseMs) {
        throw new RangeError('breakerMaxMs no puede ser menor que breakerBaseMs');
    }
}

/** Toma solo los campos conocidos y definidos; el resto se queda con la base. */
function fusionar(parciales, base) {
    const valores = {};
    for (const campo of CAMPOS_AJUSTES) {
        valores[campo] = parciales?.[campo] === undefined ? base[campo] : parciales[campo];
    }
    validarNumericos(valores);
    return valores;
}

class AjustesAntiBaneo {
    constructor(defaults = VALORES_POR_DEFECTO) {
        this._valores = fusionar(defaults, VALORES_POR_DEFECTO);
    }

    obtener() {
        return { ...this._valores };
    }

    /**
     * Edición en caliente (la usará el panel en T5). Devuelve la configuración completa
     * resultante. Lanza RangeError si el cambio deja valores inválidos, sin aplicarlo.
     */
    actualizar(cambios = {}) {
        this._valores = fusionar(cambios, this._valores);
        return this.obtener();
    }
}

function crearAjustes(defaults) {
    return new AjustesAntiBaneo(defaults);
}

module.exports = {
    CAMPOS_AJUSTES,
    AjustesAntiBaneo,
    crearAjustes
};
