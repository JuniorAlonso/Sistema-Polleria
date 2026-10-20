/**
 * Estado de conversación del bot de pedidos (T3a, S1/S14).
 *
 * Reemplaza el `Map` en memoria por un store con la MISMA base que ya usa el historial
 * del servicio (`DATABASE_URL`) y el MISMO fallback en memoria cuando no hay base. La
 * clave es el celular normalizado del cliente, así que el estado sobrevive al reinicio
 * del proceso cuando hay Postgres.
 *
 * Interfaz común: init, get, set, del. `get` devuelve `{ clave, estado }` o `null`.
 */

class MemoryConversationStore {
    constructor() {
        this.filas = new Map();
    }

    async init() {}

    async get(clave) {
        const estado = this.filas.get(clave);
        return estado === undefined ? null : { clave, estado };
    }

    async set(clave, estado) {
        this.filas.set(clave, estado);
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
        return rows[0] ? { clave, estado: rows[0].estado } : null;
    }

    async set(clave, estado) {
        await this.pool.query(
            `INSERT INTO conversation_state (clave, estado, actualizado_en)
             VALUES ($1, $2, now())
             ON CONFLICT (clave) DO UPDATE SET estado = EXCLUDED.estado, actualizado_en = now()`,
            [clave, estado]
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
    crearConversationStore
};
