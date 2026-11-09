package com.sistema.polleria.orders.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sistema.polleria.orders.entity.Orden;
import com.sistema.polleria.orders.repository.OrdenRepository;
import com.sistema.polleria.orders.repository.ProductoRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
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

import static org.junit.jupiter.api.Assertions.*;

/**
 * S4: a customer who lost or deleted the ticket message can get their active orders back from the
 * WhatsApp bot, which looks them up by the chat's phone number with the internal key.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class OrdenesActivasPorTelefonoTest {

    private static final String SECRETO = "sanpollo-dev-secret-key-2026-super-segura-256bits-minimo";
    private static final String CLAVE_INTERNA = "polleria-dev-internal-key";
    private static final long CLIENTE_ID = 9912L;

    @Autowired private TestRestTemplate rest;
    @Autowired private OrdenRepository ordenRepository;
    @Autowired private ProductoRepository productoRepository;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JdbcTemplate jdbcTemplate;

    private final List<Long> creadas = new ArrayList<>();

    @BeforeEach
    void requierePostgres() {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");
    }

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
    void devuelveSoloLosPedidosActivosDelCelularEnCualquierFormato() throws Exception {
        Long activo = crearPedidoImpagoDeHace(1);
        Long cancelado = crearPedidoImpagoDeHace(1);
        jdbcTemplate.update("UPDATE ordenes SET estado = 'CANCELADO' WHERE id = ?", cancelado);

        ResponseEntity<String> res = consultar("+51 966 000 333", CLAVE_INTERNA);

        assertEquals(HttpStatus.OK, res.getStatusCode(), res.getBody());
        var ids = new ArrayList<Long>();
        objectMapper.readTree(res.getBody()).forEach(n -> ids.add(n.path("id").asLong()));
        assertTrue(ids.contains(activo), "el pedido activo debe aparecer: " + res.getBody());
        assertFalse(ids.contains(cancelado), "un pedido cerrado no es un ticket que recuperar");
    }

    @Test
    void sinLaClaveInternaNoSeRevelanPedidosAjenos() throws Exception {
        crearPedidoImpagoDeHace(1);

        assertEquals(HttpStatus.FORBIDDEN, consultar("966000333", "clave-falsa").getStatusCode());
        assertEquals(HttpStatus.FORBIDDEN, consultar("966000333", null).getStatusCode());
    }

    @Test
    void unCelularInvalidoSeRechaza() {
        assertEquals(HttpStatus.BAD_REQUEST, consultar("12345", CLAVE_INTERNA).getStatusCode());
    }

    private ResponseEntity<String> consultar(String telefono, String clave) {
        HttpHeaders cabeceras = new HttpHeaders();
        if (clave != null) cabeceras.set("X-Internal-Key", clave);
        return rest.exchange("/ordenes/activas-por-telefono?telefono={t}", HttpMethod.GET,
                new HttpEntity<>(cabeceras), String.class, telefono);
    }

    private Long crearPedidoImpagoDeHace(int minutos) throws Exception {
        Map<String, Object> pedido = Map.of(
                "tipo", "DELIVERY",
                "direccionEntrega", "Av. Prueba 123",
                "nombreCliente", "Cliente Captura",
                "telefonoCliente", "966000333",
                "items", List.of(Map.of("productoId", productoIdDisponible(), "cantidad", 1)));
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setContentType(MediaType.APPLICATION_JSON);
        cabeceras.setBearerAuth(tokenCliente());
        ResponseEntity<String> creada = rest.exchange("/ordenes", HttpMethod.POST,
                new HttpEntity<>(pedido, cabeceras), String.class);
        assertEquals(HttpStatus.CREATED, creada.getStatusCode(), "no se pudo crear el pedido: " + creada.getBody());

        Long id = objectMapper.readTree(creada.getBody()).path("id").asLong();
        creadas.add(id);
        assertEquals("PENDIENTE_PAGO", objectMapper.readTree(creada.getBody()).path("estado").asText());
        // creado_en is updatable=false in the entity: backdate it with SQL.
        jdbcTemplate.update("UPDATE ordenes SET creado_en = ? WHERE id = ?",
                Timestamp.valueOf(LocalDateTime.now().minusMinutes(minutos)), id);
        return id;
    }

    private String tokenCliente() {
        SecretKey clave = Keys.hmacShaKeyFor(SECRETO.getBytes(StandardCharsets.UTF_8));
        return Jwts.builder()
                .subject("cliente" + CLIENTE_ID + "@prueba.local")
                .claim("role", "CLIENTE")
                .claim("userId", CLIENTE_ID)
                .issuedAt(new java.util.Date())
                .expiration(new java.util.Date(System.currentTimeMillis() + 3_600_000))
                .signWith(clave)
                .compact();
    }

    private Long productoIdDisponible() {
        return productoRepository.findByDisponibleTrue().stream()
                .filter(p -> p.getStock() == null)
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
