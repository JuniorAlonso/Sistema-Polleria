package com.sistema.polleria.payments.config;

import com.sistema.polleria.payments.entity.EstadoPago;
import com.sistema.polleria.payments.entity.MetodoPago;
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
 * Realinea el esquema y restricciones CHECK de {@code pagos} usando JdbcTemplate (autocommit
 * por sentencia) solo cuando falta algún valor del enum, y en un único ALTER TABLE atómico.
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class InicializadorEstadoPago implements ApplicationRunner {

    private final JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) {
        ensancharColumna();
        realinearCheckEnum("pagos", "estado", "pagos_estado_check", EstadoPago.values());
        realinearCheckEnum("pagos", "metodo_pago", "pagos_metodo_pago_check", MetodoPago.values());
        logDefinicionActual();
    }

    private void ensancharColumna() {
        try {
            jdbc.execute("ALTER TABLE pagos ALTER COLUMN estado TYPE varchar(30)");
        } catch (Exception e) {
            log.error("No se pudo ensanchar pagos.estado: {}", e.getMessage());
        }
    }

    private void realinearCheckEnum(String tabla, String columna, String constraint, Enum<?>[] valores) {
        try {
            String[] nombres = Arrays.stream(valores).map(Enum::name).toArray(String[]::new);
            String actual = jdbc.query(
                    "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = ?",
                    rs -> rs.next() ? rs.getString(1) : null,
                    constraint);
            boolean completo = actual != null && Arrays.stream(nombres).allMatch(n -> actual.contains("'" + n + "'"));
            if (completo) {
                return;
            }
            String listaSql = Arrays.stream(nombres)
                    .map(n -> "'" + n + "'")
                    .collect(Collectors.joining(","));
            jdbc.execute("ALTER TABLE " + tabla
                    + " DROP CONSTRAINT IF EXISTS " + constraint + ","
                    + " ADD CONSTRAINT " + constraint + " CHECK (" + columna + " IN (" + listaSql + "))");
        } catch (Exception e) {
            log.error("No se pudo realinear {}: {}", constraint, e.getMessage());
        }
    }

    private void logDefinicionActual() {
        try {
            String definicion = jdbc.queryForObject(
                    "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'pagos_estado_check'",
                    String.class);
            log.info("pagos_estado_check = {}", definicion);
        } catch (Exception e) {
            log.warn("No se pudo leer la definición de pagos_estado_check: {}", e.getMessage());
        }
    }
}
