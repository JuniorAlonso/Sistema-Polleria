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
 * Un pago por orden, garantizado por la base de datos.
 *
 * {@code PagoService.iniciar()} comprueba primero si ya existe un pago para la orden, pero eso
 * es un check-then-act: dos peticiones concurrentes para la misma orden pasaban ambas la
 * comprobación y creaban dos pagos. El índice único es lo que realmente lo impide.
 *
 * No se aborta el arranque si hay datos heredados que lo violan: se registra el motivo y la
 * aplicación sigue funcionando con la comprobación de la aplicación como defensa principal.
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
@RequiredArgsConstructor
public class InicializadorIndicesUnicos implements ApplicationRunner {

    private final EntityManager entityManager;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        try {
            entityManager.createNativeQuery(
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_pagos_orden_id ON pagos (orden_id)")
                    .executeUpdate();
            log.info("Índice único uq_pagos_orden_id verificado");
        } catch (Exception e) {
            log.warn("No se pudo crear el índice único uq_pagos_orden_id: {}. Revise si hay "
                   + "órdenes con más de un pago registrado antes de reintentar.", e.getMessage());
        }
    }
}
