package com.sistema.polleria.feedback.config;

import com.sistema.polleria.feedback.entity.EstadoReclamo;
import com.sistema.polleria.feedback.entity.MotivoReclamo;
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
 * Normaliza versiones, crea el índice único sobre {@code reportes_incidencia.orden_id} y alinea
 * de forma atómica e idempotente los CHECK constraints de enums en PostgreSQL.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class InicializadorIndicesFeedback implements ApplicationRunner {

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
                            "SELECT to_regclass('reportes_incidencia')::text", String.class);
                    if (reg != null) {
                        st.execute("UPDATE reportes_incidencia SET version = 0 WHERE version IS NULL");
                        st.execute("UPDATE reportes_incidencia SET reembolso_en_proceso = false WHERE reembolso_en_proceso IS NULL");
                        st.execute("UPDATE reportes_incidencia SET entrega_en_proceso = false WHERE entrega_en_proceso IS NULL");

                        st.execute("""
                                DELETE FROM reportes_incidencia a
                                USING reportes_incidencia b
                                WHERE a.orden_id = b.orden_id
                                  AND (CASE WHEN a.estado IN ('RESUELTO','RECHAZADO') THEN 1 ELSE 0 END, a.id)
                                    < (CASE WHEN b.estado IN ('RESUELTO','RECHAZADO') THEN 1 ELSE 0 END, b.id)
                                """);
                        st.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_reportes_orden_id ON reportes_incidencia (orden_id)");

                        sincronizarCheckEnum(st, "reportes_incidencia", "estado", "reportes_incidencia_estado_check",
                                Arrays.stream(EstadoReclamo.values()).map(Enum::name).toList());
                        sincronizarCheckEnum(st, "reportes_incidencia", "motivo", "reportes_incidencia_motivo_check",
                                Arrays.stream(MotivoReclamo.values()).map(Enum::name).toList());
                    }
                } finally {
                    if (!prevAutoCommit) {
                        con.setAutoCommit(false);
                    }
                }
                return null;
            });
        } catch (Exception e) {
            log.warn("Inicialización de índices/CHECK de feedback omitida o parcial: {}", e.getMessage());
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
