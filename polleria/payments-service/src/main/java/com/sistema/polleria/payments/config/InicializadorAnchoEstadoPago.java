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
 * Ensancha la columna {@code estado} de {@code pagos} para que quepa el nombre más largo del
 * enum {@link com.sistema.polleria.payments.entity.EstadoPago}.
 *
 * Al agregar {@code PENDIENTE_VERIFICACION} (22 caracteres) sobre una columna {@code varchar(20)},
 * el INSERT fallaba con violación de integridad y el endpoint interno respondía 409 en la primera
 * evidencia de Yape. La anotación de la entidad ya declara {@code length = 30}, pero
 * {@code ddl-auto=update} **no ensancha columnas existentes**: en una base que ya tiene datos la
 * columna seguiría siendo {@code varchar(20)} y el fallo continuaría. Este inicializador lo
 * corrige al arrancar.
 *
 * Es idempotente: ensanchar una columna que ya es {@code varchar(30)} no reescribe datos ni
 * cambia nada.
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class InicializadorAnchoEstadoPago implements ApplicationRunner {

    private final EntityManager entityManager;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        try {
            entityManager
                    .createNativeQuery("ALTER TABLE pagos ALTER COLUMN estado TYPE varchar(30)")
                    .executeUpdate();
        } catch (Exception e) {
            // Base recién creada por Hibernate o motor que no soporta el ALTER: la columna ya
            // tiene el ancho correcto y no hay nada que corregir.
            log.debug("No se pudo ensanchar pagos.estado (se asume el ancho correcto): {}", e.getMessage());
        }
    }
}
