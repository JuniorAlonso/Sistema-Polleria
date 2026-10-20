/**
 * Serialización por conversación (T3c, S10/S14).
 *
 * El handler se invoca por cada evento de mensaje sin esperar al anterior. El dedup por
 * `message.id` (T3a) cubre la reentrega del MISMO mensaje, pero no dos mensajes
 * distintos del mismo cliente: dos «confirmar» casi simultáneos podían leer el mismo
 * estado y abrir dos pedidos. Lo mismo aplica al comprobante de Yape (T6), que tampoco
 * se debe duplicar.
 *
 * Este serializador encadena las tareas de una MISMA clave (el celular normalizado) para
 * que se ejecuten una por una y en orden de llegada. Un mensaje que llega mientras el
 * anterior se procesa **espera** (no se descarta ni corre en paralelo) y, al arrancar, ve
 * el estado que dejó el anterior.
 *
 * La serialización es **por clave**, no global: una conversación lenta no frena a otros
 * clientes. Cuando la cadena de una conversación termina, su entrada se elimina para no
 * acumular clientes que no vuelven a escribir. Sin dependencias nuevas.
 *
 * `ejecutar` nunca encadena sobre un rechazo previo: si una tarea falla, la siguiente de
 * esa conversación igual corre.
 */
class SerializadorConversaciones {
    constructor() {
        this.cadenas = new Map();
    }

    /**
     * Ejecuta `tarea` en orden dentro de la conversación `clave` y devuelve el resultado.
     * La tarea empieza cuando termina la anterior de la misma clave, haya fallado o no.
     */
    ejecutar(clave, tarea) {
        const previo = this.cadenas.get(clave) || Promise.resolve();
        const actual = previo.then(
            () => tarea(),
            () => tarea()
        );

        this.cadenas.set(clave, actual);

        const limpiar = () => {
            // Solo borra si esta sigue siendo la última cadena de la conversación: una
            // tarea más nueva ya habría reemplazado la entrada.
            if (this.cadenas.get(clave) === actual) {
                this.cadenas.delete(clave);
            }
        };
        actual.then(limpiar, limpiar);

        return actual;
    }

    /** Conversaciones con una cadena viva (observabilidad y limpieza). */
    get tamanio() {
        return this.cadenas.size;
    }
}

module.exports = { SerializadorConversaciones };
