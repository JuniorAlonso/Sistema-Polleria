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
import java.math.BigDecimal;
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
 * S4.3 — {@code POST /ordenes/{id}/items}: la segunda ronda se agrega a la MISMA comanda de salón,
 * sin abrir otra, recalculando el total y publicando el evento de cocina. La toma el personal
 * (ADMIN/MOZO); COCINA y anónimo reciben 403. Una comanda cobrada (ENTREGADO) ya no admite ítems.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class ComandaItemsTest {

    private static final String SECRETO = "sanpollo-dev-secret-key-2026-super-segura-256bits-minimo";
    private static final String CLAVE_INTERNA = "X-Internal-Key";
    private static final String CLAVE_INTERNA_VALOR = "polleria-dev-internal-key";
    private static final long MOZO_ID = 4343L;

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

        int numero = 9300 + ThreadLocalRandom.current().nextInt(500);
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setContentType(MediaType.APPLICATION_JSON);
        cabeceras.set(CLAVE_INTERNA, CLAVE_INTERNA_VALOR);

        ResponseEntity<String> creada = rest.exchange("/mesas", HttpMethod.POST,
                new HttpEntity<>(Map.of(
                        "numero", numero, "capacidad", 4,
                        "posicionX", 0, "posicionY", 0, "zona", "PRUEBA_ITEMS"), cabeceras),
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
    void elMozoAgregaUnaSegundaRondaALaMismaComanda() throws Exception {
        Long ordenId = crearComandaDeSalon();

        ResponseEntity<String> agregado = agregarItems(ordenId, 2, tokenDeMozo());

        assertEquals(HttpStatus.OK, agregado.getStatusCode(),
                "el mozo debe poder agregar platos a la comanda activa: " + agregado.getBody());

        JsonNode cuerpo = objectMapper.readTree(agregado.getBody());
        assertEquals(ordenId, cuerpo.path("id").asLong(), "se reutiliza la misma comanda");

        JsonNode items = cuerpo.path("items");
        assertEquals(2, items.size(), "la comanda suma el ítem nuevo, no lo reemplaza");
        BigDecimal sumaSubtotales = BigDecimal.ZERO;
        for (JsonNode item : items) {
            sumaSubtotales = sumaSubtotales.add(new BigDecimal(item.path("subtotal").asText()));
        }
        assertEquals(0, sumaSubtotales.compareTo(new BigDecimal(cuerpo.path("total").asText())),
                "el total debe ser la suma de los subtotales");
        assertEquals(1, comandasActivas(), "la mesa debe seguir con una sola comanda activa");
    }

    @Test
    void cocinaNoPuedeAgregarItemsAComanda() {
        Long ordenId = crearComandaDeSalon();

        ResponseEntity<String> intento = agregarItems(ordenId, 1, tokenDe(5555L, "COCINA"));

        assertEquals(HttpStatus.FORBIDDEN, intento.getStatusCode(),
                "solo ADMIN/MOZO agregan platos a la comanda: " + intento.getBody());
        assertEquals(1, itemsEnBaseDeDatos(ordenId), "la comanda no debe modificarse");
    }

    @Test
    void unAnonimoNoPuedeAgregarItemsAComanda() {
        Long ordenId = crearComandaDeSalon();

        ResponseEntity<String> intento = agregarItems(ordenId, 1, null);

        assertEquals(HttpStatus.FORBIDDEN, intento.getStatusCode(),
                "un anónimo no puede tocar la comanda de salón: " + intento.getBody());
        assertEquals(1, itemsEnBaseDeDatos(ordenId), "la comanda no debe modificarse");
    }

    @Test
    void unaComandaCobradaNoAdmiteItemsNuevos() {
        Long ordenId = crearComandaDeSalon();
        String token = tokenDeMozo();

        // Secuencia completa del salón: la comanda nace RECIBIDO.
        assertEquals(HttpStatus.OK, cambiarEstado(ordenId, "EN_PREPARACION", token).getStatusCode());
        assertEquals(HttpStatus.OK, cambiarEstado(ordenId, "LISTO", token).getStatusCode());
        assertEquals(HttpStatus.OK, cambiarEstado(ordenId, "ENTREGADO", token).getStatusCode());

        ResponseEntity<String> intento = agregarItems(ordenId, 1, token);

        assertEquals(HttpStatus.CONFLICT, intento.getStatusCode(),
                "una comanda cobrada se rechaza con 409: " + intento.getBody());
        assertTrue(intento.getBody() != null && intento.getBody().contains("ENTREGADO"),
                "el mensaje debe explicar el estado. Cuerpo: " + intento.getBody());
        assertEquals(OrdenEstado.ENTREGADO, estadoEnBaseDeDatos(ordenId),
                "la comanda debe seguir ENTREGADO");
        assertEquals(1, itemsEnBaseDeDatos(ordenId), "la comanda no debe modificarse");
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

    private ResponseEntity<String> agregarItems(Long ordenId, int cantidad, String token) {
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setContentType(MediaType.APPLICATION_JSON);
        if (token != null) {
            cabeceras.setBearerAuth(token);
        }

        Map<String, Object> cuerpo = Map.of(
                "items", List.of(Map.of("productoId", productoIdDisponible(), "cantidad", cantidad)));

        return rest.exchange("/ordenes/" + ordenId + "/items", HttpMethod.POST,
                new HttpEntity<>(cuerpo, cabeceras), String.class);
    }

    private ResponseEntity<String> cambiarEstado(Long ordenId, String estado, String token) {
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setContentType(MediaType.APPLICATION_JSON);
        cabeceras.setBearerAuth(token);

        return rest.exchange("/ordenes/" + ordenId + "/estado", HttpMethod.PATCH,
                new HttpEntity<>(Map.of("estado", estado), cabeceras), String.class);
    }

    private long comandasActivas() {
        return ordenRepository.findByMesaIdAndEstadoNotIn(
                mesaId, List.of(OrdenEstado.ENTREGADO, OrdenEstado.CANCELADO)).size();
    }

    /** Los ítems se comprueban por la API: {@code Orden.items} es LAZY y open-in-view está apagado. */
    private int itemsEnBaseDeDatos(Long ordenId) {
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setBearerAuth(tokenDeMozo());

        ResponseEntity<String> orden = rest.exchange("/ordenes/" + ordenId, HttpMethod.GET,
                new HttpEntity<>(cabeceras), String.class);
        assertEquals(HttpStatus.OK, orden.getStatusCode(),
                "no se pudo leer la comanda de la prueba: " + orden.getBody());
        try {
            return objectMapper.readTree(orden.getBody()).path("items").size();
        } catch (Exception e) {
            throw new IllegalStateException("respuesta ilegible de la comanda " + ordenId, e);
        }
    }

    private OrdenEstado estadoEnBaseDeDatos(Long ordenId) {
        return ordenRepository.findById(ordenId)
                .map(o -> o.getEstado())
                .orElseThrow(() -> new IllegalStateException("la orden " + ordenId + " no existe"));
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
