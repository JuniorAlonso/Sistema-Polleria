package com.sistema.polleria.payments.config;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Normaliza a 0 la columna {@code version} de las filas que quedaron en NULL.
 *
 * Al agregar bloqueo optimista ({@code @Version}) sobre la tabla {@code pagos}, que ya tenía
 * datos, {@code ddl-auto=update} crea la columna dejando NULL en todas las filas existentes.
 * Hibernate no puede incrementar una versión nula y el guardado falla en tiempo de ejecución.
 * Esta normalización lo evita y es idempotente.
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class InicializadorVersiones implements ApplicationRunner {

    private final EntityManager entityManager;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        int pagos = entityManager
                .createNativeQuery("UPDATE pagos SET version = 0 WHERE version IS NULL")
                .executeUpdate();
        if (pagos > 0) {
            log.info("Versiones en NULL normalizadas a 0 — pagos: {}", pagos);
        }
    }
}
