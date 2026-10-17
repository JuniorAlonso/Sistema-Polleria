package com.sistema.polleria.orders.controller;

import com.fasterxml.jackson.databind.JsonNode;
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
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * S4.1 — la comanda de salón solo la toma el personal de la pollería o un microservicio
 * con {@code X-Internal-Key}. Antes, {@code POST /ordenes} era público y no distinguía el tipo:
 * cualquier visitante (o un CLIENTE autenticado) podía ocupar una mesa.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class SalonRequierePersonalTest {

    private static final String SECRETO = "sanpollo-dev-secret-key-2026-super-segura-256bits-minimo";
    private static final String CLAVE_INTERNA = "X-Internal-Key";
    private static final String CLAVE_INTERNA_VALOR = "polleria-dev-internal-key";
    private static final long MOZO_ID = 4242L;
    private static final long CLIENTE_ID = 555L;

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

    /**
     * Mesa propia con número aleatorio en vez de una sembrada: así esta clase no compite por
     * mesas con {@code MesaComandaUnicaTest} ni deja mesas ocupadas a otras pruebas.
     */
    @BeforeEach
    void crearMesaDePrueba() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        int numero = 9100 + ThreadLocalRandom.current().nextInt(800);
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setContentType(MediaType.APPLICATION_JSON);
        cabeceras.set(CLAVE_INTERNA, CLAVE_INTERNA_VALOR);

        ResponseEntity<String> creada = rest.exchange("/mesas", HttpMethod.POST,
                new HttpEntity<>(Map.of(
                        "numero", numero, "capacidad", 4,
                        "posicionX", 0, "posicionY", 0, "zona", "PRUEBA_SALON"), cabeceras),
                String.class);
        assertEquals(HttpStatus.CREATED, creada.getStatusCode(),
                "no se pudo preparar la mesa de la prueba: " + creada.getBody());

        mesaId = objectMapper.readTree(creada.getBody()).path("id").asLong();
    }

    @AfterEach
    void limpiarMesaDePrueba() {
        if (mesaId == null) return;

        // Cancelar primero: con una comanda activa la mesa no se puede dar de baja (409).
        for (Long ordenId : ordenesCreadas) {
            boolean activa = ordenRepository.findById(ordenId)
                    .map(o -> o.getEstado() != OrdenEstado.CANCELADO
                            && o.getEstado() != OrdenEstado.ENTREGADO)
                    .orElse(false);
            if (activa) {
                rest.exchange("/ordenes/" + ordenId + "/estado", HttpMethod.PATCH,
                        new HttpEntity<>(Map.of("estado", "CANCELADO"), cabecerasDeMozo()), String.class);
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
    void unAnonimoNoPuedeTomarComandaDeSalon() {
        ResponseEntity<String> intento = postSalon(null, null);

        assertEquals(HttpStatus.FORBIDDEN, intento.getStatusCode(),
                "un anónimo no debe poder abrir una comanda de salón: " + intento.getBody());
        assertEquals(MesaEstado.LIBRE, estadoDeLaMesa(), "la mesa debe seguir LIBRE");
        assertEquals(0, comandasActivas(), "no debe existir ninguna orden para la mesa");
    }

    @Test
    void unClienteNoPuedeTomarComandaDeSalon() {
        ResponseEntity<String> intento = postSalon(null, tokenDe(CLIENTE_ID, "CLIENTE"));

        assertEquals(HttpStatus.FORBIDDEN, intento.getStatusCode(),
                "un CLIENTE no debe poder abrir una comanda de salón: " + intento.getBody());
        assertEquals(MesaEstado.LIBRE, estadoDeLaMesa(), "la mesa debe seguir LIBRE");
        assertEquals(0, comandasActivas(), "no debe existir ninguna orden para la mesa");
    }

    @Test
    void unMozoPuedeTomarComandaYQuedaRegistradoComoClienteYMozo() throws Exception {
        ResponseEntity<String> creada = postSalon(null, tokenDe(MOZO_ID, "MOZO"));

        assertEquals(HttpStatus.CREATED, creada.getStatusCode(),
                "el mozo debe poder tomar la comanda: " + creada.getBody());

        JsonNode cuerpo = objectMapper.readTree(creada.getBody());
        ordenesCreadas.add(cuerpo.path("id").asLong());
        assertEquals(MOZO_ID, cuerpo.path("clienteId").asLong(),
                "clienteId registra al usuario que tomó la comanda");
        assertEquals(MOZO_ID, cuerpo.path("mozoId").asLong(),
                "mozoId debe registrar al mozo real, no quedar nulo");
        assertEquals(MesaEstado.OCUPADA, estadoDeLaMesa(), "la mesa queda OCUPADA por la comanda");
    }

    @Test
    void unMicroservicioConClaveInternaPuedeTomarComandaDeSalon() {
        ResponseEntity<String> creada = postSalon(CLAVE_INTERNA_VALOR, null);

        assertEquals(HttpStatus.CREATED, creada.getStatusCode(),
                "la llamada interna debe poder crear la comanda: " + creada.getBody());
        assertTrue(creada.getBody() != null && creada.getBody().contains("\"tipo\":\"SALON\""),
                "la comanda creada debe ser de salón. Cuerpo: " + creada.getBody());
        assertEquals(MesaEstado.OCUPADA, estadoDeLaMesa());
    }

    private ResponseEntity<String> postSalon(String claveInterna, String token) {
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setContentType(MediaType.APPLICATION_JSON);
        if (token != null) {
            cabeceras.setBearerAuth(token);
        }
        if (claveInterna != null) {
            cabeceras.set(CLAVE_INTERNA, claveInterna);
        }

        Map<String, Object> pedido = Map.of(
                "tipo", "SALON",
                "mesaId", mesaId,
                "nombreCliente", "Mozo " + MOZO_ID,
                "items", List.of(Map.of("productoId", productoIdDisponible(), "cantidad", 1)));

        return rest.exchange("/ordenes", HttpMethod.POST,
                new HttpEntity<>(pedido, cabeceras), String.class);
    }

    private HttpHeaders cabecerasDeMozo() {
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setContentType(MediaType.APPLICATION_JSON);
        cabeceras.setBearerAuth(tokenDe(MOZO_ID, "MOZO"));
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
