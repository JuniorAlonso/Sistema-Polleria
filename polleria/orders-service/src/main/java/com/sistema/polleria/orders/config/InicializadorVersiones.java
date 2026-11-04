package com.sistema.polleria.orders.config;

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
 * Al agregar bloqueo optimista ({@code @Version}) sobre tablas que ya tenían datos,
 * {@code ddl-auto=update} crea la columna dejando NULL en todas las filas existentes.
 * Hibernate no puede incrementar una versión nula: al hacer flush lanza
 * {@code NullPointerException: Cannot invoke "java.lang.Long.longValue()" because "current" is null}
 * y la aplicación no arranca.
 *
 * Se ejecuta antes que {@link DataInitializer} para que ningún guardado previo toque una
 * fila con versión nula. Es idempotente: después de la primera ejecución no actualiza nada.
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
        int mesas = normalizar("mesas");
        int ordenes = normalizar("ordenes");
        if (mesas + ordenes > 0) {
            log.info("Versiones en NULL normalizadas a 0 — mesas: {}, órdenes: {}", mesas, ordenes);
        }
    }

    private int normalizar(String tabla) {
        return entityManager
                .createNativeQuery("UPDATE " + tabla + " SET version = 0 WHERE version IS NULL")
                .executeUpdate();
    }
}
