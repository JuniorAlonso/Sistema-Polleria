package com.sistema.polleria.orders.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * S3.1/S3.2 — «el mozo ya entregó el pedido en mesa» se persiste con
 * {@code POST /ordenes/{id}/servir} (idempotente, sin estado nuevo) y se expone en la orden y en
 * {@code ordenActiva} de la mesa para que la UI distinga «lista» de «ya servida».
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class ServirComandaTest {

    private static final String SECRETO = "sanpollo-dev-secret-key-2026-super-segura-256bits-minimo";
    private static final String CLAVE_INTERNA = "X-Internal-Key";
    private static final String CLAVE_INTERNA_VALOR = "polleria-dev-internal-key";
    private static final long MOZO_ID = 4545L;

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

        int numero = 9400 + ThreadLocalRandom.current().nextInt(400);
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setContentType(MediaType.APPLICATION_JSON);
        cabeceras.set(CLAVE_INTERNA, CLAVE_INTERNA_VALOR);

        ResponseEntity<String> creada = rest.exchange("/mesas", HttpMethod.POST,
                new HttpEntity<>(Map.of(
                        "numero", numero, "capacidad", 4,
                        "posicionX", 0, "posicionY", 0, "zona", "PRUEBA_SERVIR"), cabeceras),
                String.class);
        assertEquals(HttpStatus.CREATED, creada.getStatusCode(),
                "no se pudo preparar la mesa de la prueba: " + creada.getBody());

        mesaId = objectMapper.readTree(creada.getBody()).path("id").asLong();
    }

    @AfterEach
    void limpiarMesaDePrueba() {
        if (mesaId == null) return;

        for (Long ordenId : ordenesCreadas) {
            boolean activa = ordenRepository.findById(ordenId)
                    .map(o -> o.getEstado() != OrdenEstado.CANCELADO
                            && o.getEstado() != OrdenEstado.ENTREGADO)
                    .orElse(false);
            if (activa) {
                cambiarEstado(ordenId, "CANCELADO", tokenDeMozo());
            }
        }
        ordenesCreadas.clear();

        HttpHeaders internas = new HttpHeaders();
        internas.set(CLAVE_INTERNA, CLAVE_INTERNA_VALOR);
        rest.exchange("/mesas/" + mesaId, HttpMethod.DELETE, new HttpEntity<>(internas), String.class);
        mesaId = null;
    }

    @Test
    void servirAntesDeListoDevuelve409() {
        Long ordenId = crearComandaDeSalon();

        ResponseEntity<String> intento = servir(ordenId, tokenDeMozo());

        assertEquals(HttpStatus.CONFLICT, intento.getStatusCode(),
                "una comanda que todavía no está lista no se sirve: " + intento.getBody());
        assertTrue(intento.getBody() != null && intento.getBody().contains("todavía no está lista"),
                "el mensaje debe explicar el motivo. Cuerpo: " + intento.getBody());
    }

    @Test
    void elMozoMarcaServidaUnaComandaListoYLaMesaLaExpone() throws Exception {
        Long ordenId = crearComandaDeSalon();
        String token = tokenDeMozo();
        assertEquals(HttpStatus.OK, cambiarEstado(ordenId, "EN_PREPARACION", token).getStatusCode());
        assertEquals(HttpStatus.OK, cambiarEstado(ordenId, "LISTO", token).getStatusCode());

        ResponseEntity<String> servida = servir(ordenId, token);

        assertEquals(HttpStatus.OK, servida.getStatusCode(),
                "el mozo debe poder marcar la comanda como servida: " + servida.getBody());
        JsonNode cuerpo = objectMapper.readTree(servida.getBody());
        assertTrue(!cuerpo.path("servidoEn").isMissingNode() && !cuerpo.path("servidoEn").isNull(),
                "la respuesta debe traer servidoEn: " + servida.getBody());
        assertEquals(MOZO_ID, cuerpo.path("servidoPor").asLong());
        assertEquals("LISTO", cuerpo.path("estado").asText(),
                "servir no cambia el estado: la mesa se libera al cobrar");

        JsonNode mesa = leerMesa(token);
        JsonNode ordenActiva = mesa.path("ordenActiva");
        assertTrue(!ordenActiva.path("servidoEn").isMissingNode() && !ordenActiva.path("servidoEn").isNull(),
                "GET /mesas/{id} debe exponer servidoEn en ordenActiva: " + mesa);
        assertTrue(!ordenActiva.path("creadoEn").isMissingNode() && !ordenActiva.path("creadoEn").isNull(),
                "GET /mesas/{id} debe exponer creadoEn en ordenActiva: " + mesa);
    }

    @Test
    void servirEsIdempotenteYNoPisaLaMarcaOriginal() throws Exception {
        Long ordenId = crearComandaDeSalon();
        String token = tokenDeMozo();
        cambiarEstado(ordenId, "EN_PREPARACION", token);
        cambiarEstado(ordenId, "LISTO", token);

        JsonNode primera = objectMapper.readTree(servir(ordenId, token).getBody());
        ResponseEntity<String> segunda = servir(ordenId, token);

        assertEquals(HttpStatus.OK, segunda.getStatusCode(),
                "servir dos veces no debe fallar: " + segunda.getBody());
        JsonNode repetida = objectMapper.readTree(segunda.getBody());
        // La columna TIMESTAMP guarda microsegundos: la primera respuesta puede traer más
        // precisión que la que sobrevive al round-trip. La marca no se reescribe si coincide
        // al milisegundo (que es lo que ve el operador en la UI).
        LocalDateTime primeraMarca = LocalDateTime.parse(primera.path("servidoEn").asText());
        LocalDateTime repetidaMarca = LocalDateTime.parse(repetida.path("servidoEn").asText());
        assertEquals(primeraMarca.truncatedTo(ChronoUnit.MILLIS),
                repetidaMarca.truncatedTo(ChronoUnit.MILLIS),
                "la marca original no se reescribe");
    }

    @Test
    void cocinaNoPuedeMarcarServidaLaComanda() {
        Long ordenId = crearComandaDeSalon();

        ResponseEntity<String> intento = servir(ordenId, tokenDe(5555L, "COCINA"));

        assertEquals(HttpStatus.FORBIDDEN, intento.getStatusCode(),
                "solo ADMIN/MOZO marcan servido: " + intento.getBody());
        assertNull(estadoServidoEnBaseDeDatos(ordenId), "la comanda no debe quedar marcada");
    }

    @Test
    void unAnonimoNoPuedeMarcarServidaLaComanda() {
        Long ordenId = crearComandaDeSalon();

        ResponseEntity<String> intento = servir(ordenId, null);

        assertEquals(HttpStatus.FORBIDDEN, intento.getStatusCode(),
                "un anónimo no puede marcar servido: " + intento.getBody());
        assertNull(estadoServidoEnBaseDeDatos(ordenId), "la comanda no debe quedar marcada");
    }

    private Long crearComandaDeSalon() {
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setContentType(MediaType.APPLICATION_JSON);
        cabeceras.setBearerAuth(tokenDeMozo());

        Map<String, Object> pedido = Map.of(
                "tipo", "SALON",
                "mesaId", mesaId,
                "nombreCliente", "Mozo " + MOZO_ID,
                "items", List.of(Map.of("productoId", productoIdDisponible(), "cantidad", 1)));

        ResponseEntity<String> creada = rest.exchange("/ordenes", HttpMethod.POST,
                new HttpEntity<>(pedido, cabeceras), String.class);
        assertEquals(HttpStatus.CREATED, creada.getStatusCode(),
                "no se pudo abrir la comanda de la prueba: " + creada.getBody());

        Long ordenId;
        try {
            ordenId = objectMapper.readTree(creada.getBody()).path("id").asLong();
        } catch (Exception e) {
            throw new IllegalStateException("respuesta ilegible al crear la comanda", e);
        }
        ordenesCreadas.add(ordenId);
        return ordenId;
    }

    private ResponseEntity<String> servir(Long ordenId, String token) {
        HttpHeaders cabeceras = new HttpHeaders();
        if (token != null) {
            cabeceras.setBearerAuth(token);
        }
        return rest.exchange("/ordenes/" + ordenId + "/servir", HttpMethod.POST,
                new HttpEntity<>(cabeceras), String.class);
    }

    private JsonNode leerMesa(String token) {
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setBearerAuth(token);
        ResponseEntity<String> mesa = rest.exchange("/mesas/" + mesaId, HttpMethod.GET,
                new HttpEntity<>(cabeceras), String.class);
        assertEquals(HttpStatus.OK, mesa.getStatusCode(), "no se pudo leer la mesa: " + mesa.getBody());
        try {
            return objectMapper.readTree(mesa.getBody());
        } catch (Exception e) {
            throw new IllegalStateException("respuesta ilegible de la mesa " + mesaId, e);
        }
    }

    private ResponseEntity<String> cambiarEstado(Long ordenId, String estado, String token) {
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setContentType(MediaType.APPLICATION_JSON);
        cabeceras.setBearerAuth(token);

        return rest.exchange("/ordenes/" + ordenId + "/estado", HttpMethod.PATCH,
                new HttpEntity<>(Map.of("estado", estado), cabeceras), String.class);
    }

    private Object estadoServidoEnBaseDeDatos(Long ordenId) {
        return ordenRepository.findById(ordenId)
                .orElseThrow(() -> new IllegalStateException("la orden " + ordenId + " no existe"))
                .getServidoEn();
    }

    private String tokenDeMozo() {
        return tokenDe(MOZO_ID, "MOZO");
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
