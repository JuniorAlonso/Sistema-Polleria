package com.sistema.polleria.payments.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Un pago por orden y clave de idempotencia de reembolso, garantizados con JdbcTemplate por
 * sentencia sin bloquear el arranque si hay datos heredados inconsistentes.
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
@RequiredArgsConstructor
public class InicializadorIndicesUnicos implements ApplicationRunner {

    private final JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) {
        ejecutarSilencioso("ALTER TABLE pagos ADD COLUMN IF NOT EXISTS mp_payment_id varchar(100)",
                "columna pagos.mp_payment_id");
        ejecutarSilencioso("ALTER TABLE pagos ADD COLUMN IF NOT EXISTS monto_reembolsado numeric(10,2) DEFAULT 0",
                "columna pagos.monto_reembolsado");
        ejecutarSilencioso("ALTER TABLE pagos ADD COLUMN IF NOT EXISTS reembolso_idempotency_key varchar(120)",
                "columna pagos.reembolso_idempotency_key");
        ejecutarSilencioso("CREATE UNIQUE INDEX IF NOT EXISTS uq_pagos_orden_id ON pagos (orden_id)",
                "índice único uq_pagos_orden_id");
        ejecutarSilencioso(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_pagos_reembolso_idempotency_key "
                        + "ON pagos (reembolso_idempotency_key) WHERE reembolso_idempotency_key IS NOT NULL",
                "índice único uq_pagos_reembolso_idempotency_key");
    }

    private void ejecutarSilencioso(String sql, String descripcion) {
        try {
            jdbc.execute(sql);
            log.info("Esquema verificado: {}", descripcion);
        } catch (Exception e) {
            log.warn("No se pudo aplicar {}: {}", descripcion, e.getMessage());
        }
    }
}
