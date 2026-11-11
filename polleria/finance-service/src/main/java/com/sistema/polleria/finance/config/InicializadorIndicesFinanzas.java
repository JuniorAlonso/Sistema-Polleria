package com.sistema.polleria.finance.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Unique indexes that {@code ddl-auto=update} cannot create on existing tables (Plan 00, section 3).
 *
 * <ul>
 *   <li>One receipt per order (D3.3).</li>
 *   <li>A single open cash register (D3.11).</li>
 *   <li>One sale income per order, so a retried charge never adds the cash twice (D3.2).</li>
 * </ul>
 *
 * Each statement runs on its own auto-committed connection: in PostgreSQL a failed statement
 * aborts the surrounding transaction, so sharing one would make a single legacy duplicate skip
 * every index. Legacy duplicates are logged and the service keeps booting with the application
 * checks as the first line of defence.
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
@RequiredArgsConstructor
public class InicializadorIndicesFinanzas implements ApplicationRunner {

    private record Indice(String nombre, String sql, String causaProbable) {
    }

    private static final List<Indice> INDICES = List.of(
            new Indice("uq_comprobantes_orden_id",
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_comprobantes_orden_id ON comprobantes_pago (orden_id)",
                    "órdenes con más de un comprobante"),
            new Indice("uq_arqueos_caja_abierta",
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_arqueos_caja_abierta ON arqueos_caja (estado)"
                            + " WHERE estado = 'ABIERTA'",
                    "más de una caja en estado ABIERTA"),
            new Indice("uq_movimientos_ingreso_orden",
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_movimientos_ingreso_orden ON movimientos_caja (orden_id)"
                            + " WHERE orden_id IS NOT NULL AND tipo = 'INGRESO'",
                    "órdenes con más de un INGRESO de venta"));

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        for (Indice indice : INDICES) {
            try {
                jdbcTemplate.execute(indice.sql());
                log.info("Índice único {} verificado", indice.nombre());
            } catch (Exception e) {
                log.error("No se pudo crear el índice único {}: {}. Revise si hay {} antes de reiniciar.",
                        indice.nombre(), e.getMessage(), indice.causaProbable());
            }
        }
    }
}
