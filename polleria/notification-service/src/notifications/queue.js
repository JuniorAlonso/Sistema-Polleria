const dormir = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Cola FIFO secuencial (RNF10).
 * Procesa un trabajo a la vez y garantiza al menos `intervaloMs`
 * entre el fin de un trabajo y el inicio del siguiente.
 * Si un trabajo falla, se registra el error y la cola continúa.
 */
class ColaEnvios {
    constructor({ intervaloMs, procesar }) {
        this.intervaloMs = intervaloMs;
        this.procesar = procesar;
        this.trabajos = [];
        this.procesando = false;
        this.ultimoEnvio = 0;
    }

    add(trabajo) {
        this.trabajos.push(trabajo);
        this._ejecutar();
    }

    get pendientes() {
        return this.trabajos.length + (this.procesando ? 1 : 0);
    }

    async _ejecutar() {
        if (this.procesando) return;
        this.procesando = true;

        while (this.trabajos.length > 0) {
            const trabajo = this.trabajos.shift();

            const espera = this.ultimoEnvio + this.intervaloMs - Date.now();
            if (this.ultimoEnvio > 0 && espera > 0) {
                await dormir(espera);
            }

            try {
                await this.procesar(trabajo);
            } catch (error) {
                console.error('❌ Error inesperado en la cola de envíos:', error.message);
            }

            this.ultimoEnvio = Date.now();
        }

        this.procesando = false;
    }
}

module.exports = { ColaEnvios };
