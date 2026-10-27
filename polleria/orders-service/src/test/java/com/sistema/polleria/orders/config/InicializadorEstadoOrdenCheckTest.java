package com.sistema.polleria.orders.config;

import com.sistema.polleria.orders.entity.OrdenEstado;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.sql.Connection;
import java.sql.DriverManager;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * {@code ddl-auto=update} creates the {@code ordenes_estado_check} constraint with the enum values
 * that existed when the table was first created and never updates it. A database created before
 * PENDIENTE_PAGO / PENDIENTE_CONFIRMACION existed rejected every Yape and ContraPago order, so
 * nothing reached the cashier. This test recreates that legacy constraint and checks the
 * initializer widens it to every {@link OrdenEstado}.
 */
@SpringBootTest
@ActiveProfiles("test")
class InicializadorEstadoOrdenCheckTest {

    @Autowired
    private InicializadorEstadoOrdenCheck inicializador;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void elCheckLegadoSeAmpliaATodosLosEstadosDelEnum() {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        jdbcTemplate.execute("ALTER TABLE ordenes DROP CONSTRAINT IF EXISTS ordenes_estado_check");
        jdbcTemplate.execute("ALTER TABLE ordenes ADD CONSTRAINT ordenes_estado_check CHECK (estado IN "
                + "('RECIBIDO','EN_PREPARACION','LISTO','EN_CAMINO','ENTREGADO','CANCELADO'))");

        inicializador.run(null);

        String definicion = jdbcTemplate.queryForObject(
                "SELECT pg_get_constraintdef(oid) FROM pg_constraint "
                        + "WHERE conrelid = 'ordenes'::regclass AND conname = 'ordenes_estado_check'",
                String.class);
        for (OrdenEstado estado : OrdenEstado.values()) {
            assertTrue(definicion.contains("'" + estado.name() + "'"),
                    "the constraint must accept " + estado + ": " + definicion);
        }
    }

    @Test
    void ejecutarDosVecesEsIdempotente() {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        inicializador.run(null);
        inicializador.run(null);

        Integer checks = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM pg_constraint WHERE conrelid = 'ordenes'::regclass "
                        + "AND conname = 'ordenes_estado_check'",
                Integer.class);
        assertTrue(checks != null && checks == 1, "exactly one estado check must remain");
    }

    private boolean postgresDisponible() {
        try (Connection c = DriverManager.getConnection(
                "jdbc:postgresql://localhost:5433/polleria_test", "postgres", "postgres123")) {
            return c.isValid(2);
        } catch (Exception e) {
            return false;
        }
    }
}
