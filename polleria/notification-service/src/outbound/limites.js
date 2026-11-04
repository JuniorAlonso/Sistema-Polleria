/**
 * Presupuesto de envíos y ventana horaria (T4b, S8). Todo vive en memoria del proceso.
 *
 * - Presupuesto por hora y por día: cuenta los envíos que SALIERON bien. Al agotarse, la
 *   cola se PAUSA (no descarta) y se reanuda sola cuando empieza una hora o un día nuevos.
 *   La ventana se evalúa en America/Lima; los contadores se reinician según reloj local.
 * - Ventana horaria `[horaDesde, horaHasta)`: fuera de ella la cola espera, nunca descarta.
 *   Si `horaDesde > horaHasta` la ventana cruza la medianoche; si son iguales queda abierta
 *   las 24 h.
 *
 * El reloj (`ahora`) es inyectable para que los tests sean deterministas.
 */

const MS_HORA = 3600000;
const MS_DIA = 24 * MS_HORA;

function obtenerHoraPeru(t) {
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Lima',
            hour: 'numeric',
            hour12: false
        });
        const hora = parseInt(formatter.format(new Date(t)), 10);
        return hora % 24;
    } catch {
        const d = new Date(t);
        const utc = d.getUTCHours();
        return (utc - 5 + 24) % 24;
    }
}

function dentroDeVentana(hora, { horaDesde, horaHasta, operativoTodoElDia }) {
    if (operativoTodoElDia || horaDesde === horaHasta) return true;
    if (horaDesde < horaHasta) return hora >= horaDesde && hora < horaHasta;
    return hora >= horaDesde || hora < horaHasta;
}

function claveHora(t) {
    const d = new Date(t);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
}

function claveDia(t) {
    const d = new Date(t);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function msHastaProximaHora(t) {
    const proxima = new Date(t);
    proxima.setMinutes(0, 0, 0);
    proxima.setHours(proxima.getHours() + 1);
    return Math.max(1, proxima.getTime() - t);
}

function msHastaProximoDia(t) {
    const proximo = new Date(t);
    proximo.setHours(24, 0, 0, 0);
    return Math.max(1, proximo.getTime() - t);
}

function msHastaProximaVentana(t, { horaDesde }) {
    const inicioHoy = new Date(t);
    inicioHoy.setMinutes(0, 0, 0);
    inicioHoy.setHours(horaDesde);
    if (t < inicioHoy.getTime()) return Math.max(1, inicioHoy.getTime() - t);

    const inicioManana = new Date(inicioHoy);
    inicioManana.setDate(inicioManana.getDate() + 1);
    return Math.max(1, inicioManana.getTime() - t);
}

class LimitesDeEnvio {
    constructor({ ajustes, ahora = () => Date.now() }) {
        this.ajustes = ajustes;
        this.ahora = ahora;
        this._claveHora = null;
        this._claveDia = null;
        this.enviadosHora = 0;
        this.enviadosDia = 0;
    }

    _cfg() {
        return typeof this.ajustes.obtener === 'function' ? this.ajustes.obtener() : this.ajustes;
    }

    _sincronizar(t) {
        const hora = claveHora(t);
        const dia = claveDia(t);
        if (hora !== this._claveHora) {
            this._claveHora = hora;
            this.enviadosHora = 0;
        }
        if (dia !== this._claveDia) {
            this._claveDia = dia;
            this.enviadosDia = 0;
        }
    }

    /** null si se puede enviar; si no, { motivo, esperarMs, detalle }. */
    motivoDePausa(t = this.ahora()) {
        const cfg = this._cfg();
        this._sincronizar(t);
        const hora = obtenerHoraPeru(t);

        if (!dentroDeVentana(hora, cfg)) {
            return {
                motivo: 'fuera-de-ventana',
                esperarMs: cfg.operativoTodoElDia ? MS_HORA : msHastaProximaVentana(t, cfg),
                detalle: `Fuera de la ventana de envío (${cfg.horaDesde}:00-${cfg.horaHasta}:00 en Perú UTC-5, hora actual: ${hora}:00)`
            };
        }
        if (this.enviadosHora >= cfg.presupuestoHora) {
            return {
                motivo: 'presupuesto-hora',
                esperarMs: msHastaProximaHora(t),
                detalle: `Presupuesto por hora agotado (${this.enviadosHora}/${cfg.presupuestoHora})`
            };
        }
        if (this.enviadosDia >= cfg.presupuestoDia) {
            return {
                motivo: 'presupuesto-dia',
                esperarMs: msHastaProximoDia(t),
                detalle: `Presupuesto diario agotado (${this.enviadosDia}/${cfg.presupuestoDia})`
            };
        }
        return null;
    }

    /** Cuenta un envío exitoso en la hora y el día vigentes. */
    registrarEnvio(t = this.ahora()) {
        this._sincronizar(t);
        this.enviadosHora += 1;
        this.enviadosDia += 1;
    }
}

module.exports = {
    MS_HORA,
    MS_DIA,
    obtenerHoraPeru,
    dentroDeVentana,
    msHastaProximaHora,
    msHastaProximoDia,
    msHastaProximaVentana,
    LimitesDeEnvio
};
