/**
 * Estado de conversación del bot de pedidos (T3a, S1/S14).
 *
 * Reemplaza el `Map` en memoria por un store con la MISMA base que ya usa el historial
 * del servicio (`DATABASE_URL`) y el MISMO fallback en memoria cuando no hay base. La
 * clave es el celular normalizado del cliente, así que el estado sobrevive al reinicio
 * del proceso cuando hay Postgres.
 *
 * Interfaz común: init, get, set, del. `get` devuelve `{ clave, estado, ... }` o `null`.
 *
 * Desde T3b el estado ya no es solo el nombre del paso: también guarda el carrito, la
 * dirección, la referencia, las notas y, al confirmar, el pedido creado. Por eso `set`
 * acepta un objeto además del string de antes (`set(clave, 'MENU')` sigue funcionando y
 * `get(...).estado` sigue devolviendo el string). Se serializa a JSON en la misma columna,
 * así que el carrito sobrevive al reinicio igual que el estado.
 */

/** Acepta el string de estado viejo o el objeto nuevo y devuelve siempre un objeto plano. */
function normalizarEstado(valor) {
    if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
        return { ...valor };
    }
    return { estado: valor };
}

function serializar(valor) {
    return JSON.stringify(normalizarEstado(valor));
}

/** Lee una fila que puede ser JSON (T3b) o el string de estado plano (T3a). */
function deserializar(texto) {
    if (typeof texto !== 'string') return normalizarEstado(texto);
    if (texto.trim().startsWith('{')) {
        try {
            return normalizarEstado(JSON.parse(texto));
        } catch {
            // Valor viejo que no era JSON: se trata como estado plano.
        }
    }
    return { estado: texto };
}

class MemoryConversationStore {
    constructor() {
        this.filas = new Map();
    }

    async init() {}

    async get(clave) {
        const estado = this.filas.get(clave);
        return estado === undefined ? null : { clave, ...normalizarEstado(estado) };
    }

    async set(clave, estado) {
        this.filas.set(clave, normalizarEstado(estado));
    }

    async del(clave) {
        this.filas.delete(clave);
    }
}

class PostgresConversationStore {
    constructor(databaseUrl, { pool } = {}) {
        if (pool) {
            this.pool = pool;
        } else {
            const { Pool } = require('pg');
            this.pool = new Pool({ connectionString: databaseUrl });
        }
    }

    async init() {
        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS conversation_state (
                clave          TEXT PRIMARY KEY,
                estado         TEXT NOT NULL,
                actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);
    }

    async get(clave) {
        const { rows } = await this.pool.query(
            'SELECT estado FROM conversation_state WHERE clave = $1',
            [clave]
        );
        return rows[0] ? { clave, ...deserializar(rows[0].estado) } : null;
    }

    async set(clave, estado) {
        await this.pool.query(
            `INSERT INTO conversation_state (clave, estado, actualizado_en)
             VALUES ($1, $2, now())
             ON CONFLICT (clave) DO UPDATE SET estado = EXCLUDED.estado, actualizado_en = now()`,
            [clave, serializar(estado)]
        );
    }

    async del(clave) {
        await this.pool.query('DELETE FROM conversation_state WHERE clave = $1', [clave]);
    }
}

function crearConversationStore(databaseUrl) {
    return databaseUrl ? new PostgresConversationStore(databaseUrl) : new MemoryConversationStore();
}

module.exports = {
    MemoryConversationStore,
    PostgresConversationStore,
    crearConversationStore,
    normalizarEstado,
    serializar,
    deserializar
};
