/**
 * Ajustes anti-baneo EN MEMORIA (S8).
 *
 * Los valores por defecto salen de `src/config.js` (variables de entorno) y se pueden
 * editar en caliente; viven solo en el proceso y se pierden al reiniciar, que es
 * exactamente lo pedido. No hay persistencia: no escribir tablas ni archivos de estado.
 *
 * T4 expone el store y su uso (delay, jitter, humanización). T4b agrega el presupuesto
 * por hora/día, la ventana horaria y el backoff del circuit breaker al mismo store. T5
 * expone este store por HTTP para el panel (`src/http/app.js`): los números de contacto
 * del asesor y de respaldo (S4/S11) viven en el mismo store y se normalizan con
 * `src/notifications/phone.js`.
 */

const { antiBaneo: VALORES_POR_DEFECTO } = require('../config');
const { normalizarTelefono } = require('../notifications/phone');

const CAMPOS_NUMERICOS = [
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

// Datos de contacto configurables (T5, S4/S11/S13): celular peruano o null si está vacío.
const CAMPOS_TELEFONO = ['numeroAsesor', 'numeroRespaldo', 'numeroYape'];
const CAMPOS_BOOLEANOS = ['operativoTodoElDia'];

const CAMPOS_AJUSTES = [...CAMPOS_NUMERICOS, ...CAMPOS_TELEFONO, ...CAMPOS_BOOLEANOS];

function validarNumericos(valores) {
    for (const campo of CAMPOS_NUMERICOS) {
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

/** Normaliza los teléfonos del store: vacío o ausente → null; formato inválido → RangeError. */
function normalizarTelefonos(valores) {
    for (const campo of CAMPOS_TELEFONO) {
        const bruto = valores[campo];
        if (bruto === undefined || bruto === null || String(bruto).trim() === '') {
            valores[campo] = null;
            continue;
        }
        const numero = normalizarTelefono(bruto);
        if (!numero) {
            throw new RangeError(`${campo} debe ser un celular peruano válido (51 + 9 dígitos)`);
        }
        valores[campo] = numero;
    }
}

function validarBooleanos(valores) {
    for (const campo of CAMPOS_BOOLEANOS) {
        if (valores[campo] !== undefined && typeof valores[campo] !== 'boolean') {
            throw new RangeError(`${campo} debe ser un valor booleano`);
        }
    }
}

/** Toma solo los campos conocidos y definidos; el resto se queda con la base. */
function fusionar(parciales, base) {
    const valores = {};
    for (const campo of CAMPOS_AJUSTES) {
        valores[campo] = parciales?.[campo] === undefined ? base[campo] : parciales[campo];
    }
    validarNumericos(valores);
    normalizarTelefonos(valores);
    validarBooleanos(valores);
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
    CAMPOS_TELEFONO,
    AjustesAntiBaneo,
    crearAjustes
};
