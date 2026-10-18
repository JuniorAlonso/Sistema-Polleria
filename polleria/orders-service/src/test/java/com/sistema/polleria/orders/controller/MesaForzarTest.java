package com.sistema.polleria.orders.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sistema.polleria.orders.entity.MesaEstado;
import com.sistema.polleria.orders.entity.OrdenEstado;
import com.sistema.polleria.orders.repository.MesaRepository;
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
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * P1 de la auditoría — `forzar=true` es una contingencia de administración.
 *
 * Antes, MOZO y ADMIN podían enviarlo y `MesaService` salteaba la guarda de comanda activa:
 * un mozo podía dejar la mesa LIBRE con una orden activa, recreando la mesa huérfana que el
 * flujo de salón acababa de evitar.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class MesaForzarTest {

    private static final String SECRETO = "sanpollo-dev-secret-key-2026-super-segura-256bits-minimo";
    private static final String CLAVE_INTERNA = "X-Internal-Key";
    private static final String CLAVE_INTERNA_VALOR = "polleria-dev-internal-key";
    private static final long MOZO_ID = 6601L;
    private static final long ADMIN_ID = 6602L;

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private MesaRepository mesaRepository;

    @Autowired
    private OrdenRepository ordenRepository;

    @Autowired
    private ProductoRepository productoRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private Long mesaId;
    private final List<Long> ordenesCreadas = new ArrayList<>();

    @BeforeEach
    void crearMesaDePrueba() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        int numero = 9500 + ThreadLocalRandom.current().nextInt(400);
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setContentType(MediaType.APPLICATION_JSON);
        cabeceras.set(CLAVE_INTERNA, CLAVE_INTERNA_VALOR);

        ResponseEntity<String> creada = rest.exchange("/mesas", HttpMethod.POST,
                new HttpEntity<>(Map.of(
                        "numero", numero, "capacidad", 4,
                        "posicionX", 0, "posicionY", 0, "zona", "PRUEBA_FORZAR"), cabeceras),
                String.class);
        assertEquals(HttpStatus.CREATED, creada.getStatusCode(),
                "no se pudo preparar la mesa de la prueba: " + creada.getBody());
        mesaId = objectMapper.readTree(creada.getBody()).path("id").asLong();
    }

    @AfterEach
    void limpiar() {
        if (mesaId == null) return;

        for (Long ordenId : ordenesCreadas) {
            boolean activa = ordenRepository.findById(ordenId)
                    .map(o -> o.getEstado() != OrdenEstado.CANCELADO
                            && o.getEstado() != OrdenEstado.ENTREGADO)
                    .orElse(false);
            if (activa) {
                rest.exchange("/ordenes/" + ordenId + "/estado", HttpMethod.PATCH,
                        new HttpEntity<>(Map.of("estado", "CANCELADO"), cabecerasDe(tokenDe(MOZO_ID, "MOZO"))),
                        String.class);
            }
        }
        ordenesCreadas.clear();

        HttpHeaders internas = new HttpHeaders();
        internas.set(CLAVE_INTERNA, CLAVE_INTERNA_VALOR);
        rest.exchange("/mesas/" + mesaId, HttpMethod.DELETE,
                new HttpEntity<>(internas), String.class);
        mesaId = null;
    }

    @Test
    void elMozoNoPuedeForzarLaLiberacionDeUnaMesaConComandaActiva() throws Exception {
        crearComandaDeSalon();

        ResponseEntity<String> intento = cambiarEstado(mesaId, "LIBRE", true, tokenDe(MOZO_ID, "MOZO"));

        assertEquals(HttpStatus.FORBIDDEN, intento.getStatusCode(),
                "un mozo no puede forzar el estado de la mesa: " + intento.getBody());
        assertEquals(MesaEstado.OCUPADA, estadoDeLaMesa(), "la mesa conserva su estado");
        assertEquals(1, comandasActivas(), "la comanda sigue activa y no queda huérfana");
    }

    @Test
    void elAdminSiPuedeForzarLaLiberacion() throws Exception {
        crearComandaDeSalon();

        ResponseEntity<String> intento = cambiarEstado(mesaId, "LIBRE", true, tokenDe(ADMIN_ID, "ADMIN"));

        assertEquals(HttpStatus.OK, intento.getStatusCode(),
                "un admin puede usar la contingencia: " + intento.getBody());
        assertEquals(MesaEstado.LIBRE, estadoDeLaMesa());
    }

    private void crearComandaDeSalon() throws Exception {
        Long productoId = productoRepository.findByDisponibleTrue().stream()
                .findFirst().orElseThrow(() -> new IllegalStateException("no hay productos disponibles"))
                .getId();

        Map<String, Object> pedido = Map.of(
                "tipo", "SALON",
                "mesaId", mesaId,
                "nombreCliente", "Mesa de prueba",
                "items", List.of(Map.of("productoId", productoId, "cantidad", 1)));

        ResponseEntity<String> creada = rest.exchange("/ordenes", HttpMethod.POST,
                new HttpEntity<>(pedido, cabecerasDe(tokenDe(MOZO_ID, "MOZO"))), String.class);
        assertEquals(HttpStatus.CREATED, creada.getStatusCode(),
                "no se pudo crear la comanda de la prueba: " + creada.getBody());
        ordenesCreadas.add(objectMapper.readTree(creada.getBody()).path("id").asLong());
    }

    private ResponseEntity<String> cambiarEstado(Long id, String estado, boolean forzar, String token) {
        return rest.exchange("/mesas/" + id + "/estado", HttpMethod.PUT,
                new HttpEntity<>(Map.of("estado", estado, "forzar", forzar), cabecerasDe(token)),
                String.class);
    }

    private HttpHeaders cabecerasDe(String token) {
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setContentType(MediaType.APPLICATION_JSON);
        cabeceras.setBearerAuth(token);
        return cabeceras;
    }

    private MesaEstado estadoDeLaMesa() {
        return mesaRepository.findById(mesaId)
                .orElseThrow(() -> new IllegalStateException("la mesa " + mesaId + " no existe"))
                .getEstado();
    }

    private long comandasActivas() {
        return ordenRepository.findByMesaIdAndEstadoNotIn(
                mesaId, List.of(OrdenEstado.ENTREGADO, OrdenEstado.CANCELADO)).size();
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

    private boolean postgresDisponible() {
        try (Connection c = DriverManager.getConnection(
                "jdbc:postgresql://localhost:5433/polleria_test", "postgres", "postgres123")) {
            return c.isValid(2);
        } catch (Exception e) {
            return false;
        }
    }
}
