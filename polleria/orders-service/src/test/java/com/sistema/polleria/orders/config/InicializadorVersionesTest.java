package com.sistema.polleria.orders.config;

import com.sistema.polleria.orders.entity.Mesa;
import com.sistema.polleria.orders.repository.MesaRepository;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.sql.Connection;
import java.sql.DriverManager;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Al agregar {@code @Version} sobre una tabla con datos, {@code ddl-auto=update} deja la
 * columna nueva en NULL en todas las filas existentes. Hibernate no puede incrementar una
 * versión nula y el arranque falla con
 * {@code NullPointerException: Cannot invoke "java.lang.Long.longValue()" because "current" is null}.
 *
 * Esta prueba simula una fila legada y comprueba que la normalización la deja utilizable.
 */
@SpringBootTest
@ActiveProfiles("test")
class InicializadorVersionesTest {

    @Autowired
    private InicializadorVersiones inicializador;

    @Autowired
    private MesaRepository mesaRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void laVersionNulaDeUnaFilaLegadaSeNormalizaACero() {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        Mesa mesa = mesaRepository.findByActivoTrueOrderByNumeroAsc().get(0);
        Long id = mesa.getId();

        jdbcTemplate.update("UPDATE mesas SET version = NULL WHERE id = ?", id);
        assertEquals(null, jdbcTemplate.queryForObject(
                "SELECT version FROM mesas WHERE id = ?", Long.class, id));

        inicializador.run(null);

        assertEquals(0L, jdbcTemplate.queryForObject(
                "SELECT version FROM mesas WHERE id = ?", Long.class, id));
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
