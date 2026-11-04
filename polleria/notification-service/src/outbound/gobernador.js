const { CircuitBreaker } = require('./breaker');
const { LimitesDeEnvio, dentroDeVentana, obtenerHoraPeru } = require('./limites');

/**
 * Gobernador de envíos (T4b, S2/S8): coordina el presupuesto por hora/día, la ventana
 * horaria y el circuit breaker. La cola pregunta `motivoDePausa()` antes de cada envío y
 * el servicio reporta el resultado con `registrarExito()` / `registrarFallo(error)`.
 *
 * Todo el estado vive en memoria; los valores salen de los ajustes editables en caliente.
 * El orden de prioridad al pausar es: circuit breaker (riesgo de baneo) → ventana horaria
 * → presupuesto. El motivo viaja en /status junto con el detalle legible.
 */
class Gobernador {
    constructor({ ajustes, ahora = () => Date.now() }) {
        this.ajustes = ajustes;
        this.ahora = ahora;
        this.limites = new LimitesDeEnvio({ ajustes, ahora });
        this.breaker = new CircuitBreaker({ ajustes, ahora });
        this.ultimoMotivo = null;
    }

    _cfg() {
        return typeof this.ajustes.obtener === 'function' ? this.ajustes.obtener() : this.ajustes;
    }

    /** null si se puede enviar; si no, { motivo, esperarMs, detalle }. */
    motivoDePausa() {
        const t = this.ahora();
        this.ultimoMotivo = this.breaker.motivoDePausa(t) || this.limites.motivoDePausa(t);
        return this.ultimoMotivo;
    }

    /** Un mensaje salió bien: cuenta presupuesto y cierra el breaker. */
    registrarExito() {
        const t = this.ahora();
        this.limites.registrarEnvio(t);
        this.breaker.registrarExito(t);
    }

    /** El canal respondió aunque el envío no haya salido (p. ej. número sin WhatsApp). */
    registrarCanalVivo() {
        this.breaker.registrarExito(this.ahora());
    }

    /** @returns {boolean} true si el error era una señal de bloqueo. */
    registrarFallo(error) {
        return this.breaker.registrarFallo(this.ahora(), error);
    }

    /** Vista consistente para GET /status. */
    estado() {
        const t = this.ahora();
        const pausa = this.motivoDePausa();
        const cfg = this._cfg();
        return {
            pausada: pausa !== null,
            motivo: pausa ? pausa.motivo : null,
            detalle: pausa ? pausa.detalle : null,
            presupuestoHora: { enviados: this.limites.enviadosHora, limite: cfg.presupuestoHora },
            presupuestoDia: { enviados: this.limites.enviadosDia, limite: cfg.presupuestoDia },
            ventana: {
                horaDesde: cfg.horaDesde,
                horaHasta: cfg.horaHasta,
                operativoTodoElDia: Boolean(cfg.operativoTodoElDia),
                abierta: dentroDeVentana(obtenerHoraPeru(t), cfg)
            },
            breaker: this.breaker.estado(t)
        };
    }
}

function crearGobernador({ ajustes, ahora } = {}) {
    return new Gobernador({ ajustes, ahora });
}

module.exports = { Gobernador, crearGobernador };
