const dormirReal = ms => new Promise(resolve => setTimeout(resolve, ms));

// Un ajuste puede ser un valor fijo o una función para leerlo en caliente (S8).
const resolver = valor => (typeof valor === 'function' ? valor() : valor);

/**
 * Cola FIFO secuencial (RNF10).
 * Procesa un trabajo a la vez y garantiza al menos `intervaloMs` (base, con jitter)
 * entre el fin de un trabajo y el inicio del siguiente.
 * Si un trabajo falla, se registra el error y la cola continúa.
 *
 * El azar y los timers se inyectan (`azar`, `dormir`, `ahora`) para que los tests sean
 * deterministas: el jitter usa `azar()` en vez de `Math.random()` y el tiempo no depende
 * del reloj real. Con `jitterPct = 0` el delay vuelve a ser exactamente `intervaloMs`.
 *
 * T4b: si se inyecta un `gobernador` (presupuesto, ventana horaria y circuit breaker), la
 * cola consulta `gobernador.motivoDePausa()` antes de tomar un trabajo. Si hay pausa, el
 * trabajo NO se descarta: la cola se detiene y programa una reanudación para `esperarMs`.
 */
class ColaEnvios {
    constructor({
        intervaloMs,
        jitterPct = 0,
        procesar,
        azar = Math.random,
        dormir = dormirReal,
        ahora = () => Date.now(),
        gobernador = null
    }) {
        this.intervaloMs = intervaloMs;
        this.jitterPct = jitterPct;
        this.procesar = procesar;
        this.azar = azar;
        this.dormir = dormir;
        this.ahora = ahora;
        this.gobernador = gobernador;
        this.trabajos = [];
        this.procesando = false;
        this.ultimoEnvio = 0;
        this.reanudacionPendiente = false;
    }

    // Espera efectiva: base ± un porcentaje aleatorio configurable (jitter).
    _esperaConJitter() {
        const base = resolver(this.intervaloMs);
        const pct = resolver(this.jitterPct);
        if (!pct) return Math.round(base);
        const factor = 1 + (this.azar() * 2 - 1) * (pct / 100);
        return Math.max(0, Math.round(base * factor));
    }

    add(trabajo) {
        this.trabajos.push(trabajo);
        this._ejecutar();
    }

    get pendientes() {
        return this.trabajos.length + (this.procesando ? 1 : 0);
    }

    // Para GET /status: qué está haciendo la cola ahora mismo.
    get procesandoAhora() {
        return this.procesando;
    }

    get ultimoEnvioEn() {
        return this.ultimoEnvio || null;
    }

    async _ejecutar() {
        if (this.procesando) return;
        this.procesando = true;

        try {
            while (this.trabajos.length > 0) {
                const pausa = this._motivoDePausa();
                if (pausa) {
                    // No se toma el trabajo: queda pendiente y la cola se reanuda al vencer la pausa.
                    this._programarReanudacion(pausa.esperarMs);
                    return;
                }

                const trabajo = this.trabajos.shift();

                if (this.ultimoEnvio > 0) {
                    const espera = this.ultimoEnvio + this._esperaConJitter() - this.ahora();
                    if (espera > 0) {
                        await this.dormir(espera);
                    }
                }

                try {
                    await this.procesar(trabajo);
                } catch (error) {
                    console.error('❌ Error inesperado en la cola de envíos:', error.message);
                }

                this.ultimoEnvio = this.ahora();
            }
        } finally {
            this.procesando = false;
        }
    }

    // Pausa global (gobernador): presupuesto agotado, fuera de ventana o breaker abierto.
    _motivoDePausa() {
        if (!this.gobernador || typeof this.gobernador.motivoDePausa !== 'function') return null;
        return this.gobernador.motivoDePausa();
    }

    // Una sola reanudación programada a la vez; al despertar se reintenta si aún hay trabajo.
    _programarReanudacion(esperarMs) {
        if (this.reanudacionPendiente) return;
        this.reanudacionPendiente = true;
        this.dormir(Math.max(1, esperarMs))
            .catch(() => {})
            .then(() => {
                this.reanudacionPendiente = false;
                if (this.trabajos.length > 0) this._ejecutar();
            });
    }
}

module.exports = { ColaEnvios };
