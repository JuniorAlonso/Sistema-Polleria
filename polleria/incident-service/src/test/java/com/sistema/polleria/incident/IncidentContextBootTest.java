package com.sistema.polleria.incident;

import com.sistema.polleria.incident.service.IncidenteService;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;

import java.sql.Connection;
import java.sql.DriverManager;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest
@ActiveProfiles("test")
class IncidentContextBootTest {

    @Autowired
    private ApplicationContext context;

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

    @Test
    void contextoSpringArrancaContraPostgresTest() {
        assertNotNull(context);
        assertNotNull(context.getBean(IncidenteService.class));
    }

    private static boolean postgresDisponible() {
        try (Connection c = DriverManager.getConnection(
                "jdbc:postgresql://localhost:5433/polleria_test", "postgres", "postgres123")) {
            return c.isValid(2);
        } catch (Exception e) {
            return false;
        }
    }
}
