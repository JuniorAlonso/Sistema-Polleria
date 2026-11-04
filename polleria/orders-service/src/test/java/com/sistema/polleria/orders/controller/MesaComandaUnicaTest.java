package com.sistema.polleria.orders.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sistema.polleria.orders.entity.Mesa;
import com.sistema.polleria.orders.entity.MesaEstado;
import com.sistema.polleria.orders.entity.OrdenEstado;
import com.sistema.polleria.orders.repository.MesaRepository;
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
import org.springframework.test.context.ActiveProfiles;

import java.sql.Connection;
import java.sql.DriverManager;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import javax.crypto.SecretKey;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * D3 — Una mesa puede tener como máximo UNA comanda activa.
 *
 * Antes, el segundo POST /ordenes de salón sobre la misma mesa se aceptaba sin más:
 * la mesa ya estaba OCUPADA, así que no cambiaba de valor y Hibernate no marcaba la fila
 * como sucia. El resultado eran dos comandas activas sobre la misma mesa.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class MesaComandaUnicaTest {

    private static final String CLAVE_INTERNA = "X-Internal-Key";
    private static final String SECRETO = "sanpollo-dev-secret-key-2026-super-segura-256bits-minimo";
    private static final long MOZO_ID = 777L;

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private MesaRepository mesaRepository;

    @Autowired
    private ProductoRepository productoRepository;

    @Autowired
    private OrdenRepository ordenRepository;

    @Autowired
    private ObjectMapper objectMapper;

    /** Órdenes creadas por esta clase: se borran en el cleanup para no dejar comandas activas. */
    private final List<Long> creadas = new ArrayList<>();

    @AfterEach
    void liberarMesa() {
        for (Long id : creadas) {
            try {
                ordenRepository.deleteById(id);
            } catch (Exception ignored) {
                // La limpieza no debe ocultar el resultado del test.
            }
        }
        creadas.clear();

        mesaRepository.findByEstadoAndActivoTrue(MesaEstado.OCUPADA).forEach(mesa -> {
            mesa.setEstado(MesaEstado.LIBRE);
            mesaRepository.save(mesa);
        });
    }

    @Test
    void elSegundoPedidoDeSalonSobreLaMismaMesaDevuelve409YNoCreaComanda() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        Mesa mesa = mesaRepository.findByEstadoAndActivoTrue(MesaEstado.LIBRE).stream()
                .findFirst().orElseThrow(() -> new IllegalStateException("no hay mesas libres sembradas"));
        Long productoId = productoIdDisponible();

        Map<String, Object> pedido = pedidoDeSalon(mesa.getId(), productoId);

        long comandasAntes = comandasActivas(mesa.getId());

        ResponseEntity<String> primera = rest.exchange("/ordenes", HttpMethod.POST,
                new HttpEntity<>(pedido, cabecerasDeMozo()), String.class);
        assertEquals(HttpStatus.CREATED, primera.getStatusCode(),
                "la primera comanda de la mesa debe crearse: " + primera.getBody());
        creadas.add(objectMapper.readTree(primera.getBody()).path("id").asLong());
        assertEquals(comandasAntes + 1, comandasActivas(mesa.getId()));

        ResponseEntity<String> segunda = rest.exchange("/ordenes", HttpMethod.POST,
                new HttpEntity<>(pedidoDeSalon(mesa.getId(), productoId), cabecerasDeMozo()), String.class);

        assertEquals(HttpStatus.CONFLICT, segunda.getStatusCode(),
                "la segunda comanda debe rechazarse con 409, no con 500 ni aceptarse: " + segunda.getBody());
        assertTrue(segunda.getBody() != null && segunda.getBody().contains("ya tiene una comanda activa"),
                "el mensaje debe explicar el motivo. Cuerpo: " + segunda.getBody());

        assertEquals(comandasAntes + 1, comandasActivas(mesa.getId()),
                "el pedido rechazado no debe dejar una segunda comanda almacenada");
    }

    /**
     * Una mesa dada de baja no debe poder recibir comandas nuevas. Antes el alta de una orden
     * solo miraba si había otra comanda activa, sin comprobar {@code mesa.activo}.
     */
    @Test
    void unaMesaDadaDeBajaNoPuedeRecibirComandas() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        Long productoId = productoIdDisponible();

        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.set(CLAVE_INTERNA, "polleria-dev-internal-key");

        ResponseEntity<String> creada = rest.exchange("/mesas", HttpMethod.POST,
                new HttpEntity<>(Map.of(
                        "numero", 9801, "capacidad", 4,
                        "posicionX", 0, "posicionY", 0, "zona", "PRUEBA_BAJA"), cabeceras),
                String.class);
        assertEquals(HttpStatus.CREATED, creada.getStatusCode(),
                "no se pudo crear la mesa de prueba: " + creada.getBody());

        Long mesaId = objectMapper.readTree(creada.getBody()).path("id").asLong();

        ResponseEntity<String> baja = rest.exchange("/mesas/" + mesaId, HttpMethod.DELETE,
                new HttpEntity<>(cabeceras), String.class);
        assertEquals(HttpStatus.NO_CONTENT, baja.getStatusCode(),
                "no se pudo dar de baja la mesa: " + baja.getBody());

        ResponseEntity<String> respuesta = rest.exchange("/ordenes", HttpMethod.POST,
                new HttpEntity<>(pedidoDeSalon(mesaId, productoId), cabecerasDeMozo()), String.class);

        assertEquals(HttpStatus.CONFLICT, respuesta.getStatusCode(),
                "una mesa dada de baja debe rechazar la comanda con 409: " + respuesta.getBody());
        assertTrue(respuesta.getBody() != null && respuesta.getBody().contains("dada de baja"),
                "el mensaje debe explicar que la mesa está dada de baja. Cuerpo: " + respuesta.getBody());
        assertEquals(0, comandasActivas(mesaId),
                "no debe quedar ninguna comanda almacenada para la mesa dada de baja");
    }

    private HttpHeaders cabecerasDeMozo() {
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setContentType(MediaType.APPLICATION_JSON);
        cabeceras.setBearerAuth(tokenDeMozo());
        return cabeceras;
    }

    private String tokenDeMozo() {
        SecretKey clave = Keys.hmacShaKeyFor(SECRETO.getBytes(StandardCharsets.UTF_8));
        return Jwts.builder()
                .subject("mozo" + MOZO_ID + "@prueba.local")
                .claim("role", "MOZO")
                .claim("userId", MOZO_ID)
                .issuedAt(new java.util.Date())
                .expiration(new java.util.Date(System.currentTimeMillis() + 3_600_000))
                .signWith(clave)
                .compact();
    }

    private Map<String, Object> pedidoDeSalon(Long mesaId, Long productoId) {
        return Map.of(
                "tipo", "SALON",
                "mesaId", mesaId,
                "nombreCliente", "Mozo Uno",
                "items", List.of(Map.of("productoId", productoId, "cantidad", 1)));
    }

    private Long productoIdDisponible() {
        return productoRepository.findByDisponibleTrue().stream()
                .findFirst().orElseThrow(() -> new IllegalStateException("no hay productos disponibles"))
                .getId();
    }

    private long comandasActivas(Long mesaId) {
        return ordenRepository.findByMesaIdAndEstadoNotIn(
                mesaId, List.of(OrdenEstado.ENTREGADO, OrdenEstado.CANCELADO)).size();
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
