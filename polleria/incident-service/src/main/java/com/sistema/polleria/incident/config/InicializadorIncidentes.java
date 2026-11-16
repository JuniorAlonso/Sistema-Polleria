package com.sistema.polleria.incident.config;

import com.sistema.polleria.incident.entity.EstadoIncidente;
import com.sistema.polleria.incident.entity.Severidad;
import com.sistema.polleria.incident.entity.TipoIncidente;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.SQLException;
import java.sql.Statement;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Normaliza versiones nulas en {@code incidentes} y sincroniza atómicamente los CHECK constraints
 * de enums en PostgreSQL sin dejar ventanas sin restricción ni recrear si ya están completos.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class InicializadorIncidentes implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        try {
            jdbcTemplate.execute((ConnectionCallback<Void>) con -> {
                boolean prevAutoCommit = con.getAutoCommit();
                if (!prevAutoCommit) {
                    con.setAutoCommit(true);
                }
                try (Statement st = con.createStatement()) {
                    String reg = jdbcTemplate.queryForObject(
                            "SELECT to_regclass('incidentes')::text", String.class);
                    if (reg != null) {
                        st.execute("UPDATE incidentes SET version = 0 WHERE version IS NULL");
                        sincronizarCheckEnum(st, "incidentes", "estado", "incidentes_estado_check",
                                Arrays.stream(EstadoIncidente.values()).map(Enum::name).toList());
                        sincronizarCheckEnum(st, "incidentes", "severidad", "incidentes_severidad_check",
                                Arrays.stream(Severidad.values()).map(Enum::name).toList());
                        sincronizarCheckEnum(st, "incidentes", "tipo", "incidentes_tipo_check",
                                Arrays.stream(TipoIncidente.values()).map(Enum::name).toList());
                    }
                } finally {
                    if (!prevAutoCommit) {
                        con.setAutoCommit(false);
                    }
                }
                return null;
            });
        } catch (Exception e) {
            log.warn("Inicialización de incidentes omitida o parcial: {}", e.getMessage());
        }
    }

    private void sincronizarCheckEnum(
            Statement st,
            String tabla,
            String columna,
            String nombreDefault,
            List<String> valores
    ) throws SQLException {
        List<String> definiciones = jdbcTemplate.query(
                """
                SELECT pg_get_constraintdef(c.oid) AS def
                FROM pg_constraint c
                JOIN pg_class t ON c.conrelid = t.oid
                WHERE t.relname = ? AND c.contype = 'c' AND pg_get_constraintdef(c.oid) ILIKE ?
                """,
                (rs, rowNum) -> rs.getString("def"),
                tabla, "%" + columna + "%"
        );

        boolean yaContieneTodos = !definiciones.isEmpty() && definiciones.stream().allMatch(def ->
                valores.stream().allMatch(v -> def.contains("'" + v + "'")));
        if (yaContieneTodos) {
            return;
        }

        List<String> nombresExistentes = jdbcTemplate.query(
                """
                SELECT c.conname
                FROM pg_constraint c
                JOIN pg_class t ON c.conrelid = t.oid
                WHERE t.relname = ? AND c.contype = 'c' AND pg_get_constraintdef(c.oid) ILIKE ?
                """,
                (rs, rowNum) -> rs.getString("conname"),
                tabla, "%" + columna + "%"
        );

        StringBuilder ddl = new StringBuilder("ALTER TABLE ").append(tabla);
        for (String nombre : nombresExistentes) {
            ddl.append(" DROP CONSTRAINT IF EXISTS ").append(nombre).append(",");
        }
        String listaSql = valores.stream().map(v -> "'" + v + "'").collect(Collectors.joining(", "));
        ddl.append(" ADD CONSTRAINT ").append(nombreDefault)
                .append(" CHECK (").append(columna).append(" IN (").append(listaSql).append("))");
        st.execute(ddl.toString());
        log.info("CHECK constraint {} de {}.{} alineado atómicamente", nombreDefault, tabla, columna);
    }
}
