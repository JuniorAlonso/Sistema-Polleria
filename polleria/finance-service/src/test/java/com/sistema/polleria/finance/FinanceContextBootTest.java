package com.sistema.polleria.finance;

import com.sistema.polleria.finance.service.CajaService;
import com.sistema.polleria.finance.service.ComprobanteService;
import com.sistema.polleria.finance.service.FinanzasService;
import com.sistema.polleria.finance.service.LiquidacionService;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.sql.Connection;
import java.sql.DriverManager;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class FinanceContextBootTest {

    @BeforeAll
    static void requierePostgres() {
        boolean disponible = postgresDisponible();
        if (!disponible && ("true".equalsIgnoreCase(System.getProperty("require.db"))
                || "true".equalsIgnoreCase(System.getenv("REQUIRE_DB")))) {
            throw new AssertionError("PostgreSQL requerido (-Drequire.db=true) no disponible en localhost:5433");
        }
        Assumptions.assumeTrue(disponible,
                "PostgreSQL de pruebas no disponible en localhost:5433");
    }

    private static boolean postgresDisponible() {
        try (Connection c = DriverManager.getConnection(
                "jdbc:postgresql://localhost:5433/polleria_test", "postgres", "postgres123")) {
            return c.isValid(2);
        } catch (Exception e) {
            return false;
        }
    }

    @Autowired
    private FinanzasService finanzasService;

    @Autowired
    private ComprobanteService comprobanteService;

    @Autowired
    private CajaService cajaService;

    @Autowired
    private LiquidacionService liquidacionService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void contextoArrancaYVerificaIndicesYConstraintsDeFinanzasEnPostgres() {
        assertThat(finanzasService).isNotNull();
        assertThat(comprobanteService).isNotNull();
        assertThat(cajaService).isNotNull();
        assertThat(liquidacionService).isNotNull();

        List<String> indices = jdbcTemplate.queryForList(
                "SELECT indexname FROM pg_indexes WHERE schemaname = 'public'",
                String.class);
        assertThat(indices).contains(
                "uq_comprobantes_orden_id",
                "uq_arqueos_caja_abierta",
                "uq_liquidacion_abierta_repartidor",
                "uq_movimientos_ingreso_orden",
                "uq_movimientos_devolucion_reclamo");

        List<String> constraints = jdbcTemplate.queryForList(
                "SELECT conname FROM pg_constraint WHERE contype = 'c'",
                String.class);
        assertThat(constraints).contains(
                "movimientos_caja_categoria_check",
                "movimientos_caja_tipo_check",
                "arqueos_caja_estado_check",
                "liquidaciones_repartidores_estado_check",
                "comprobantes_pago_tipo_check");
    }
}
