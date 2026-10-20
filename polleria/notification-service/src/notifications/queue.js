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
 */
class ColaEnvios {
    constructor({
        intervaloMs,
        jitterPct = 0,
        procesar,
        azar = Math.random,
        dormir = dormirReal,
        ahora = () => Date.now()
    }) {
        this.intervaloMs = intervaloMs;
        this.jitterPct = jitterPct;
        this.procesar = procesar;
        this.azar = azar;
        this.dormir = dormir;
        this.ahora = ahora;
        this.trabajos = [];
        this.procesando = false;
        this.ultimoEnvio = 0;
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

        while (this.trabajos.length > 0) {
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

        this.procesando = false;
    }
}

module.exports = { ColaEnvios };
