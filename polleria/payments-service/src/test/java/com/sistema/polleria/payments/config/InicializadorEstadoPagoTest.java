package com.sistema.polleria.payments.config;

import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.sql.Connection;
import java.sql.DriverManager;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * El arreglo de esquema de {@code pagos.estado}, probado en el escenario que rompía de verdad:
 * una base que <b>ya existe</b> y quedó con el CHECK viejo.
 *
 * <p>Con {@code create-drop} Hibernate crea la tabla al arrancar y el CHECK sale correcto, así que
 * un test que solo mirara la base de pruebas pasaría siempre y no probaría nada. Por eso este test
 * <b>simula la base heredada</b>: deja el CHECK con los cuatro estados viejos, corre el
 * inicializador y exige que termine permitiendo los estados nuevos.
 *
 * <p>Es la contraparte automatizada de la verificación que se hizo contra la base real de
 * desarrollo, donde este mismo CHECK rechazaba {@code PENDIENTE_VERIFICACION} con violación de
 * integridad y el endpoint respondía 409 como si fuera un pago duplicado.
 */
@SpringBootTest
@ActiveProfiles("test")
class InicializadorEstadoPagoTest {

    /** El CHECK tal como estaba en la base antes de la feature de WhatsApp. */
    private static final String CHECK_VIEJO = "CHECK (estado IN ('PENDIENTE','APROBADO','RECHAZADO','CANCELADO'))";

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private InicializadorEstadoPago inicializador;

    @Test
    void realineaUnCheckHeredadoParaQueAcepteLosEstadosNuevos() {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433");

        // 1) Base heredada: el CHECK no conoce los estados nuevos.
        jdbc.execute("ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_estado_check");
        jdbc.execute("ALTER TABLE pagos ADD CONSTRAINT pagos_estado_check " + CHECK_VIEJO);

        // 2) El inicializador corre igual que al arrancar el servicio.
        inicializador.run(null);

        // 3) El CHECK real tiene que aceptar todo el enum, no solo los cuatro viejos.
        String definicion = jdbc.queryForObject(
                "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'pagos_estado_check'",
                String.class);

        assertThat(definicion)
                .as("el CHECK del pago nuevo es el que rechazaba PENDIENTE_VERIFICACION")
                .contains("PENDIENTE_VERIFICACION")
                .contains("REEMBOLSADO")
                .contains("REEMBOLSADO_PARCIAL");

        // 4) Y lo que el CHECK rechazaba antes ahora entra de verdad: se comprueba escribiendo.
        jdbc.update("INSERT INTO pagos (orden_id, cliente_id, monto, metodo_pago, estado, creado_en) "
                + "VALUES (?, ?, ?, ?, ?, now())", 987654L, 0L, 10.00, "YAPE_PLIN", "PENDIENTE_VERIFICACION");
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM pagos WHERE orden_id = 987654", Integer.class)).isEqualTo(1);
        jdbc.update("DELETE FROM pagos WHERE orden_id = 987654");
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
