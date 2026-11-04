package com.sistema.polleria.orders.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sistema.polleria.orders.repository.OrdenRepository;
import com.sistema.polleria.orders.repository.ProductoRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * P2 de la auditoría — “completados hoy” se fecha por `actualizadoEn`, no por `creadoEn`.
 *
 * Una comanda creada antes de medianoche y cobrada después debe aparecer en el tablero de hoy;
 * una comanda vieja que se completó ayer no debe aparecer. Antes ambas se filtraban por `creadoEn`.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class CompletadosHoyTest {

    private static final String SECRETO = "sanpollo-dev-secret-key-2026-super-segura-256bits-minimo";
    private static final long CLIENTE_ID = 9901L;
    private static final long MOZO_ID = 9902L;

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private OrdenRepository ordenRepository;

    @Autowired
    private ProductoRepository productoRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final List<Long> creadas = new ArrayList<>();

    @AfterEach
    void limpiar() {
        for (Long id : creadas) {
            try {
                ordenRepository.deleteById(id);
            } catch (Exception ignored) {
                // La limpieza no debe ocultar el resultado del test.
            }
        }
        creadas.clear();
    }

    @Test
    void unaComandaCreadaAyerYCompletadaHoyApareceYUnaCompletadaAyerNo() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        Long completadaHoy = crearPedidoDelivery();
        Long completadaAyer = crearPedidoDelivery();

        // Se backdatea creado_en por SQL: la entidad lo marca updatable=false.
        jdbcTemplate.update(
                "UPDATE ordenes SET creado_en = ?, actualizado_en = ?, estado = 'ENTREGADO' WHERE id = ?",
                Timestamp.valueOf(LocalDateTime.now().minusDays(1)),
                Timestamp.valueOf(LocalDateTime.now()),
                completadaHoy);
        jdbcTemplate.update(
                "UPDATE ordenes SET creado_en = ?, actualizado_en = ?, estado = 'ENTREGADO' WHERE id = ?",
                Timestamp.valueOf(LocalDateTime.now().minusDays(2)),
                Timestamp.valueOf(LocalDateTime.now().minusDays(1)),
                completadaAyer);

        ResponseEntity<String> lista = rest.exchange("/ordenes", HttpMethod.GET,
                new HttpEntity<>(cabeceras(tokenDe(MOZO_ID, "MOZO"))), String.class);
        assertEquals(HttpStatus.OK, lista.getStatusCode(),
                "GET /ordenes debe responder 200: " + lista.getBody());

        JsonNode cuerpo = objectMapper.readTree(lista.getBody());
        assertNotNull(buscarPorId(cuerpo, completadaHoy),
                "la comanda creada ayer y completada hoy debe aparecer");
        assertNull(buscarPorId(cuerpo, completadaAyer),
                "la comanda completada ayer no debe aparecer en el tablero de hoy");
    }

    private Long crearPedidoDelivery() throws Exception {
        Map<String, Object> pedido = Map.of(
                "tipo", "DELIVERY",
                "direccionEntrega", "Av. Prueba 123",
                "nombreCliente", "Cliente Completados",
                "telefonoCliente", "966000222",
                "items", List.of(Map.of("productoId", productoIdDisponible(), "cantidad", 1)));

        ResponseEntity<String> creada = rest.exchange("/ordenes", HttpMethod.POST,
                new HttpEntity<>(pedido, cabeceras(tokenDe(CLIENTE_ID, "CLIENTE"))), String.class);
        assertEquals(HttpStatus.CREATED, creada.getStatusCode(),
                "no se pudo crear el pedido de la prueba: " + creada.getBody());

        Long id = objectMapper.readTree(creada.getBody()).path("id").asLong();
        creadas.add(id);
        return id;
    }

    private JsonNode buscarPorId(JsonNode array, Long id) {
        if (array == null || !array.isArray()) return null;
        for (JsonNode nodo : array) {
            if (nodo.path("id").asLong() == id) return nodo;
        }
        return null;
    }

    private HttpHeaders cabeceras(String token) {
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setContentType(MediaType.APPLICATION_JSON);
        cabeceras.setBearerAuth(token);
        return cabeceras;
    }

    private String tokenDe(long userId, String rol) {
        SecretKey clave = Keys.hmacShaKeyFor(SECRETO.getBytes(StandardCharsets.UTF_8));
        return Jwts.builder()
                .subject("usuario" + userId + "@prueba.local")
                .claim("role", rol)
                .claim("userId", userId)
                .issuedAt(new java.util.Date())
                .expiration(new java.util.Date(System.currentTimeMillis() + 3_600_000))
                .signWith(clave)
                .compact();
    }

    private Long productoIdDisponible() {
        return productoRepository.findByDisponibleTrue().stream()
                .findFirst().orElseThrow(() -> new IllegalStateException("no hay productos disponibles"))
                .getId();
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
