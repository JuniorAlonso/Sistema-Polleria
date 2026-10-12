/**
 * Persistencia del NotificationLog (RF32).
 * - PostgresStore: se usa cuando existe DATABASE_URL.
 * - MemoryStore: respaldo para desarrollo, el historial se pierde al reiniciar.
 * Ambos exponen la misma interfaz: init, create, update, findAll, findPendientes.
 */

const ESTADOS_LOG = ['EN_COLA', 'ENVIADO', 'ERROR'];

class MemoryStore {
    constructor() {
        this.logs = [];
        this.secuencia = 0;
    }

    async init() {}

    async create({ ordenId, destinatario, tipo, mensaje }) {
        this.secuencia += 1;
        const log = {
            id: `notif_${String(this.secuencia).padStart(5, '0')}`,
            ordenId,
            destinatario,
            tipo,
            mensaje,
            estado: 'EN_COLA',
            intentos: 0,
            errorDetalle: null,
            enviadoEn: null,
            creadoEn: new Date()
        };
        this.logs.push(log);
        return { ...log };
    }

    async update(id, cambios) {
        const log = this.logs.find(l => l.id === id);
        if (!log) return null;
        Object.assign(log, cambios);
        return { ...log };
    }

    async findAll({ ordenId, estado, desde } = {}) {
        return this.logs
            .filter(l => ordenId === undefined || l.ordenId === ordenId)
            .filter(l => !estado || l.estado === estado)
            .filter(l => !desde || l.creadoEn >= desde)
            .sort((a, b) => b.creadoEn - a.creadoEn)
            .map(l => ({ ...l }));
    }

    async findPendientes() {
        return this.logs.filter(l => l.estado === 'EN_COLA').map(l => ({ ...l }));
    }
}

class PostgresStore {
    constructor(databaseUrl) {
        const { Pool } = require('pg');
        this.pool = new Pool({ connectionString: databaseUrl });
    }

    async init() {
        await this.pool.query(`
            CREATE SEQUENCE IF NOT EXISTS notification_log_seq;
            CREATE TABLE IF NOT EXISTS notification_log (
                id            TEXT PRIMARY KEY DEFAULT 'notif_' || lpad(nextval('notification_log_seq')::text, 5, '0'),
                orden_id      BIGINT,
                destinatario  VARCHAR(20)  NOT NULL,
                tipo          VARCHAR(40)  NOT NULL,
                mensaje       TEXT         NOT NULL,
                estado        VARCHAR(20)  NOT NULL DEFAULT 'EN_COLA',
                intentos      INTEGER      NOT NULL DEFAULT 0,
                error_detalle TEXT,
                enviado_en    TIMESTAMPTZ,
                creado_en     TIMESTAMPTZ  NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_notification_log_orden ON notification_log (orden_id);
            -- Los códigos de seguimiento no pertenecen a una orden
            ALTER TABLE notification_log ALTER COLUMN orden_id DROP NOT NULL;
        `);
    }

    async create({ ordenId, destinatario, tipo, mensaje }) {
        const { rows } = await this.pool.query(
            `INSERT INTO notification_log (orden_id, destinatario, tipo, mensaje)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [ordenId, destinatario, tipo, mensaje]
        );
        return mapearFila(rows[0]);
    }

    async update(id, cambios) {
        const columnas = {
            estado: 'estado',
            intentos: 'intentos',
            errorDetalle: 'error_detalle',
            enviadoEn: 'enviado_en'
        };
        const sets = [];
        const valores = [];
        for (const [campo, columna] of Object.entries(columnas)) {
            if (campo in cambios) {
                valores.push(cambios[campo]);
                sets.push(`${columna} = $${valores.length}`);
            }
        }
        if (sets.length === 0) return null;

        valores.push(id);
        const { rows } = await this.pool.query(
            `UPDATE notification_log SET ${sets.join(', ')} WHERE id = $${valores.length} RETURNING *`,
            valores
        );
        return rows[0] ? mapearFila(rows[0]) : null;
    }

    async findAll({ ordenId, estado, desde } = {}) {
        const condiciones = [];
        const valores = [];
        if (ordenId !== undefined) {
            valores.push(ordenId);
            condiciones.push(`orden_id = $${valores.length}`);
        }
        if (estado) {
            valores.push(estado);
            condiciones.push(`estado = $${valores.length}`);
        }
        if (desde) {
            valores.push(desde);
            condiciones.push(`creado_en >= $${valores.length}`);
        }
        const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
        const { rows } = await this.pool.query(
            `SELECT * FROM notification_log ${where} ORDER BY creado_en DESC LIMIT 500`,
            valores
        );
        return rows.map(mapearFila);
    }

    async findPendientes() {
        const { rows } = await this.pool.query(
            `SELECT * FROM notification_log WHERE estado = 'EN_COLA' ORDER BY creado_en ASC`
        );
        return rows.map(mapearFila);
    }
}

function mapearFila(fila) {
    return {
        id: fila.id,
        ordenId: fila.orden_id === null ? null : Number(fila.orden_id),
        destinatario: fila.destinatario,
        tipo: fila.tipo,
        mensaje: fila.mensaje,
        estado: fila.estado,
        intentos: fila.intentos,
        errorDetalle: fila.error_detalle,
        enviadoEn: fila.enviado_en,
        creadoEn: fila.creado_en
    };
}

function crearStore(databaseUrl) {
    return databaseUrl ? new PostgresStore(databaseUrl) : new MemoryStore();
}

module.exports = {
    ESTADOS_LOG,
    MemoryStore,
    PostgresStore,
    crearStore
};
