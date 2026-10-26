-- ============================================================
-- Schema: auth-service
-- Base de datos: polleria_auth (AWS RDS PostgreSQL)
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100)  NOT NULL,
    email       VARCHAR(150)  NOT NULL UNIQUE,
    phone       VARCHAR(20)   UNIQUE,
    password    VARCHAR(255)  NOT NULL,
    role        VARCHAR(20)   NOT NULL DEFAULT 'CLIENTE',
    active      BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ip_blacklist (
    id              BIGSERIAL PRIMARY KEY,
    ip              VARCHAR(45)   NOT NULL UNIQUE,
    failed_attempts INT           NOT NULL DEFAULT 0,
    blocked_until   TIMESTAMP,
    last_attempt    TIMESTAMP
);

CREATE TABLE IF NOT EXISTS two_factor_tokens (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code        VARCHAR(6)    NOT NULL,
    expires_at  TIMESTAMP     NOT NULL,
    used        BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sanciones_cliente (
    id                   BIGSERIAL PRIMARY KEY,
    telefono             VARCHAR(30),
    telefono_normalizado VARCHAR(20),
    email                VARCHAR(150),
    ip_address           VARCHAR(45),
    motivo               VARCHAR(255) NOT NULL,
    orden_id             BIGINT,
    bloqueado_efectivo   BOOLEAN NOT NULL DEFAULT TRUE,
    bloqueado_total      BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en            TIMESTAMP NOT NULL DEFAULT NOW(),
    creado_por           VARCHAR(100) DEFAULT 'SISTEMA_PEDIDO_FANTASMA'
);

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_ip_blacklist_ip ON ip_blacklist(ip);
CREATE INDEX IF NOT EXISTS idx_2fa_user_id ON two_factor_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_sanciones_telefono_norm ON sanciones_cliente(telefono_normalizado);
CREATE INDEX IF NOT EXISTS idx_sanciones_email ON sanciones_cliente(email);
CREATE INDEX IF NOT EXISTS idx_sanciones_ip ON sanciones_cliente(ip_address);
