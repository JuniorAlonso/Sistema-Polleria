package com.sistema.polleria.orders.config;

import com.sistema.polleria.orders.entity.OrdenEstado;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.stream.Collectors;

/**
 * Rebuilds {@code ordenes_estado_check} from {@link OrdenEstado} on every start.
 *
 * {@code ddl-auto=update} creates that CHECK with the enum values that existed when the table
 * was first created and never touches it again. A database created before PENDIENTE_PAGO,
 * PENDIENTE_CONFIRMACION, PREPARANDO, LISTO_PARA_ENTREGAR, EN_PUERTA or PEDIDO_FANTASMA existed
 * rejected every order in those states: Yape and ContraPago orders were never stored, so they
 * never reached the cashier.
 *
 * The values come from the enum (not from user input). It runs before {@link DataInitializer}
 * and is idempotent: dropping and adding the same CHECK leaves the table unchanged.
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class InicializadorEstadoOrdenCheck implements ApplicationRunner {

    static final String CONSTRAINT = "ordenes_estado_check";

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        String valores = Arrays.stream(OrdenEstado.values())
                .map(estado -> "'" + estado.name() + "'")
                .collect(Collectors.joining(","));
        jdbcTemplate.execute("ALTER TABLE ordenes DROP CONSTRAINT IF EXISTS " + CONSTRAINT);
        jdbcTemplate.execute("ALTER TABLE ordenes ADD CONSTRAINT " + CONSTRAINT
                + " CHECK (estado IN (" + valores + "))");
        log.info("Constraint {} sincronizado con OrdenEstado ({} estados)", CONSTRAINT, OrdenEstado.values().length);
    }
}
