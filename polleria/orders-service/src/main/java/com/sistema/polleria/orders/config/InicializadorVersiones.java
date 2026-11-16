package com.sistema.polleria.orders.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Normaliza a 0 la columna {@code version} de las filas que quedaron en NULL en modo autocommit.
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class InicializadorVersiones implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        int mesas = normalizar("mesas");
        int ordenes = normalizar("ordenes");
        if (mesas + ordenes > 0) {
            log.info("Versiones en NULL normalizadas a 0 — mesas: {}, órdenes: {}", mesas, ordenes);
        }
    }

    private int normalizar(String tabla) {
        try {
            return jdbcTemplate.update("UPDATE " + tabla + " SET version = 0 WHERE version IS NULL");
        } catch (Exception e) {
            log.warn("No se pudo normalizar version en {}: {}", tabla, e.getMessage());
            return 0;
        }
    }
}
