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
        this.settings = null;
    }

    async init() {}

    async getSettings() {
        return this.settings ? { ...this.settings } : null;
    }

    async saveSettings(valores) {
        this.settings = { ...valores };
        return { ...this.settings };
    }

    async findById(id) {
        const log = this.logs.find(l => l.id === id);
        return log ? { ...log } : null;
    }

    async findByEventoId(eventoId) {
        if (!eventoId) return null;
        const log = this.logs.find(l => l.eventoId === eventoId);
        return log ? { ...log } : null;
    }

    async crearOExistente({ ordenId, destinatario, tipo, mensaje, eventoId = null }) {
        const claveEvento = typeof eventoId === 'string' && eventoId.trim() ? eventoId.trim() : null;
        if (claveEvento) {
            const existente = await this.findByEventoId(claveEvento);
            if (existente) {
                return { log: existente, creado: false };
            }
        }
        this.secuencia += 1;
        const log = {
            id: `notif_${String(this.secuencia).padStart(5, '0')}`,
            ordenId,
            destinatario,
            tipo,
            mensaje,
            eventoId: claveEvento,
            estado: 'EN_COLA',
            intentos: 0,
            errorDetalle: null,
            enviadoEn: null,
            creadoEn: new Date()
        };
        this.logs.push(log);
        return { log: { ...log }, creado: true };
    }

    async create(datos) {
        const { log } = await this.crearOExistente(datos);
        return log;
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
                destinatario  VARCHAR(40)  NOT NULL,
                tipo          VARCHAR(40)  NOT NULL,
                mensaje       TEXT         NOT NULL,
                evento_id     VARCHAR(120),
                estado        VARCHAR(20)  NOT NULL DEFAULT 'EN_COLA',
                intentos      INTEGER      NOT NULL DEFAULT 0,
                error_detalle TEXT,
                enviado_en    TIMESTAMPTZ,
                creado_en     TIMESTAMPTZ  NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_notification_log_orden ON notification_log (orden_id);
            -- Los códigos de seguimiento no pertenecen a una orden
            ALTER TABLE notification_log ALTER COLUMN orden_id DROP NOT NULL;
            -- Ensanchar destinatario para soportar JIDs @lid cuando WhatsApp oculta el número
            ALTER TABLE notification_log ALTER COLUMN destinatario TYPE VARCHAR(40);
            -- Idempotencia opcional por id de evento (CON-19)
            ALTER TABLE notification_log ADD COLUMN IF NOT EXISTS evento_id VARCHAR(120);
            CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_log_evento_id
                ON notification_log (evento_id) WHERE evento_id IS NOT NULL;
            -- Configuración persistente del panel admin
            CREATE TABLE IF NOT EXISTS notification_settings (
                id         INTEGER PRIMARY KEY CHECK (id = 1),
                settings   JSONB       NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);
    }

    async getSettings() {
        const { rows } = await this.pool.query(
            `SELECT settings FROM notification_settings WHERE id = 1`
        );
        return rows[0] ? rows[0].settings : null;
    }

    async saveSettings(valores) {
        const { rows } = await this.pool.query(
            `INSERT INTO notification_settings (id, settings, updated_at)
             VALUES (1, $1::jsonb, now())
             ON CONFLICT (id) DO UPDATE SET settings = EXCLUDED.settings, updated_at = now()
             RETURNING settings`,
            [JSON.stringify(valores)]
        );
        return rows[0].settings;
    }

    async findById(id) {
        const { rows } = await this.pool.query(
            `SELECT * FROM notification_log WHERE id = $1`,
            [id]
        );
        return rows[0] ? mapearFila(rows[0]) : null;
    }

    async findByEventoId(eventoId) {
        if (!eventoId) return null;
        const { rows } = await this.pool.query(
            `SELECT * FROM notification_log WHERE evento_id = $1`,
            [eventoId]
        );
        return rows[0] ? mapearFila(rows[0]) : null;
    }

    async crearOExistente({ ordenId, destinatario, tipo, mensaje, eventoId = null }) {
        const claveEvento = typeof eventoId === 'string' && eventoId.trim() ? eventoId.trim() : null;
        if (!claveEvento) {
            const { rows } = await this.pool.query(
                `INSERT INTO notification_log (orden_id, destinatario, tipo, mensaje)
                 VALUES ($1, $2, $3, $4) RETURNING *`,
                [ordenId, destinatario, tipo, mensaje]
            );
            return { log: mapearFila(rows[0]), creado: true };
        }

        const { rows } = await this.pool.query(
            `WITH ins AS (
                 INSERT INTO notification_log (orden_id, destinatario, tipo, mensaje, evento_id)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (evento_id) WHERE evento_id IS NOT NULL DO NOTHING
                 RETURNING *
             )
             SELECT *, TRUE AS _creado FROM ins
             UNION ALL
             SELECT *, FALSE AS _creado FROM notification_log
             WHERE evento_id = $5 AND NOT EXISTS (SELECT 1 FROM ins)
             LIMIT 1`,
            [ordenId, destinatario, tipo, mensaje, claveEvento]
        );
        const fila = rows[0];
        return { log: mapearFila(fila), creado: Boolean(fila._creado) };
    }

    async create(datos) {
        const { log } = await this.crearOExistente(datos);
        return log;
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
        eventoId: fila.evento_id || null,
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
