/**
 * Ajustes anti-baneo EN MEMORIA (S8).
 *
 * Los valores por defecto salen de `src/config.js` (variables de entorno) y se pueden
 * editar en caliente; viven solo en el proceso y se pierden al reiniciar, que es
 * exactamente lo pedido. No hay persistencia: no escribir tablas ni archivos de estado.
 *
 * T4 solo expone el store y su uso. La API HTTP del panel es T5: no agregar rutas aquí.
 */

const { antiBaneo: VALORES_POR_DEFECTO } = require('../config');

const CAMPOS_AJUSTES = [
    'intervaloMs',
    'jitterPct',
    'typingMinMs',
    'typingMaxMs',
    'typingMsPorCaracter'
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
