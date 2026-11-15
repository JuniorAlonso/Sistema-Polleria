package com.sistema.polleria.auth.config;

import com.sistema.polleria.auth.entity.Role;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Sincroniza el constraint CHECK {@code users_role_check} contra {@link Role#values()}
 * y asegura columnas nuevas sobre tablas existentes en PostgreSQL con autocommit por sentencia.
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class InicializadorCheckEnumsAuth implements ApplicationRunner {

    static final String CONSTRAINT = "users_role_check";

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        asegurarColumnas();
        sincronizarCheckRoles();
    }

    private void asegurarColumnas() {
        List<String> sentencias = List.of(
                "ALTER TABLE two_factor_tokens ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0",
                "ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS rotated_at TIMESTAMP"
        );
        for (String sql : sentencias) {
            try {
                jdbcTemplate.execute(sql);
            } catch (Exception e) {
                log.warn("No se pudo ejecutar ajuste incremental [{}]: {}", sql, e.getMessage());
            }
        }
    }

    private void sincronizarCheckRoles() {
        try {
            String actual = definicionActual();
            if (contieneTodosLosRoles(actual)) {
                log.debug("Constraint {} ya acepta todos los Role; no se reconstruye", CONSTRAINT);
                return;
            }
            String valores = Arrays.stream(Role.values())
                    .map(r -> "'" + r.name() + "'")
                    .collect(Collectors.joining(","));
            jdbcTemplate.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS " + CONSTRAINT
                    + ", ADD CONSTRAINT " + CONSTRAINT + " CHECK (role IN (" + valores + "))");
            log.info("Constraint {} sincronizado con Role ({} valores)", CONSTRAINT, Role.values().length);
        } catch (Exception e) {
            log.error("No se pudo sincronizar el constraint {}: {}", CONSTRAINT, e.getMessage());
        }
    }

    private String definicionActual() {
        List<String> definiciones = jdbcTemplate.queryForList(
                "SELECT pg_get_constraintdef(oid) FROM pg_constraint "
                        + "WHERE conrelid = 'users'::regclass AND conname = ?",
                String.class, CONSTRAINT);
        return definiciones.isEmpty() ? null : definiciones.get(0);
    }

    private static boolean contieneTodosLosRoles(String definicion) {
        return definicion != null && Arrays.stream(Role.values())
                .allMatch(r -> definicion.contains("'" + r.name() + "'"));
    }
}
