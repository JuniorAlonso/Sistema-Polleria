package com.sistema.polleria.orders.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sistema.polleria.orders.entity.Orden;
import com.sistema.polleria.orders.entity.OrdenEstado;
import com.sistema.polleria.orders.repository.OrdenRepository;
import com.sistema.polleria.orders.repository.ProductoRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
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

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * D1 — Pertenencia de un pedido en {@code PATCH /ordenes/{id}/estado}.
 *
 * {@code @PreAuthorize} admite el rol {@code CLIENTE} y el servicio usaba el {@code usuarioId}
 * únicamente para el log: no comparaba con {@code orden.clienteId}. Cualquier cliente
 * autenticado podía cancelar o marcar como entregado el pedido de otro cliente.
 *
 * El mismo archivo ya tenía el patrón correcto en {@code GET /ordenes/{id}}: comprobar dueño,
 * personal o clave interna. Aquí se aplica la misma regla a la escritura.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class PertenenciaDeOrdenTest {

    private static final String SECRETO = "sanpollo-dev-secret-key-2026-super-segura-256bits-minimo";
    private static final long CLIENTE_DUENO = 111L;
    private static final long CLIENTE_AJENO = 222L;

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private OrdenRepository ordenRepository;

    @Autowired
    private ProductoRepository productoRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void unClienteNoPuedeCambiarElEstadoDeUnPedidoAjeno() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        Long ordenId = crearPedidoDeliveryDe(CLIENTE_DUENO, "911111111");

        ResponseEntity<String> intento =
                cambiarEstado(ordenId, "CANCELADO", tokenDe(CLIENTE_AJENO, "CLIENTE"));

        // 404 y no 403: distinguir "existe pero no es tuyo" de "no existe" permitiría enumerar
        // los pedidos. Es la misma convención que usa GET /ordenes/{id}.
        assertEquals(HttpStatus.NOT_FOUND, intento.getStatusCode(),
                "un cliente no debe poder cambiar el estado del pedido de otro: " + intento.getBody());
        assertEquals(OrdenEstado.PENDIENTE_PAGO, estadoEnBaseDeDatos(ordenId),
                "el pedido ajeno debe quedar intacto tras el intento rechazado");
    }

    /**
     * El flujo del pedido es obligatorio: cocina y reparto lo mueven, el cliente no. Sin esta
     * regla, un cliente podía marcar su pedido como `EN_PREPARACION`, `LISTO` o `ENTREGADO` y
     * saltarse la operación completa de la pollería.
     */
    @Test
    void unClienteNoPuedeAvanzarSuPropioPedidoPorElFlujo() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        Long ordenId = crearPedidoDeliveryDe(CLIENTE_DUENO, "911111114");

        ResponseEntity<String> intento = cambiarEstado(
                ordenId, "EN_PREPARACION", tokenDe(CLIENTE_DUENO, "CLIENTE"));

        assertEquals(HttpStatus.FORBIDDEN, intento.getStatusCode(),
                "el dueño no debe poder avanzar el flujo operativo de su propio pedido: "
                        + intento.getBody());
        assertEquals(OrdenEstado.PENDIENTE_PAGO, estadoEnBaseDeDatos(ordenId),
                "el pedido debe seguir en PENDIENTE_PAGO tras el intento rechazado");
    }

    @Test
    void elDuenoSiPuedeCancelarSuPropioPedido() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        Long ordenId = crearPedidoDeliveryDe(CLIENTE_DUENO, "911111112");

        ResponseEntity<String> cancelacion =
                cambiarEstado(ordenId, "CANCELADO", tokenDe(CLIENTE_DUENO, "CLIENTE"));

        assertEquals(HttpStatus.OK, cancelacion.getStatusCode(),
                "el dueño debe poder cancelar su propio pedido: " + cancelacion.getBody());
        assertEquals(OrdenEstado.CANCELADO, estadoEnBaseDeDatos(ordenId),
                "la cancelación del dueño debe persistirse");
    }

    @Test
    void elPersonalSiPuedeCambiarElEstadoDeCualquierPedido() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        Long ordenId = crearPedidoDeliveryDe(CLIENTE_DUENO, "911111113");

        // The public checkout opens it in PENDIENTE_PAGO (S1); the payment gate keeps it out of the
        // kitchen, but staff can still move it (here: cancel it).
        ResponseEntity<String> avance =
                cambiarEstado(ordenId, "CANCELADO", tokenDe(999L, "MOZO"));

        assertEquals(HttpStatus.OK, avance.getStatusCode(),
                "el mozo debe poder cambiar el estado de cualquier pedido: " + avance.getBody());
        assertEquals(OrdenEstado.CANCELADO, estadoEnBaseDeDatos(ordenId),
                "el cambio del personal debe persistirse");
    }

    /** S4: the owner may cancel only before the kitchen starts; afterwards it answers 409. */
    @Test
    void elDuenoNoPuedeCancelarUnPedidoQueYaEstaEnCocina() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        Long ordenId = crearPedidoDeliveryDe(CLIENTE_DUENO, "911111115");
        Orden orden = ordenRepository.findById(ordenId).orElseThrow();
        orden.setEstado(OrdenEstado.EN_PREPARACION);
        ordenRepository.save(orden);

        ResponseEntity<String> intento =
                cambiarEstado(ordenId, "CANCELADO", tokenDe(CLIENTE_DUENO, "CLIENTE"));

        assertEquals(HttpStatus.CONFLICT, intento.getStatusCode(),
                "el dueno no debe cancelar un pedido en cocina: " + intento.getBody());
        assertEquals(OrdenEstado.EN_PREPARACION, estadoEnBaseDeDatos(ordenId));
    }

    private Long crearPedidoDeliveryDe(long clienteId, String telefono) throws Exception {
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setContentType(MediaType.APPLICATION_JSON);
        cabeceras.setBearerAuth(tokenDe(clienteId, "CLIENTE"));

        Map<String, Object> pedido = Map.of(
                "tipo", "DELIVERY",
                "direccionEntrega", "Av. Prueba 123",
                "referencia", "Portón azul",
                "nombreCliente", "Cliente " + clienteId,
                "telefonoCliente", telefono,
                "items", List.of(Map.of("productoId", productoIdDisponible(), "cantidad", 1)));

        ResponseEntity<String> creada = rest.exchange("/ordenes", HttpMethod.POST,
                new HttpEntity<>(pedido, cabeceras), String.class);

        assertEquals(HttpStatus.CREATED, creada.getStatusCode(),
                "no se pudo preparar el pedido de la prueba: " + creada.getBody());

        return objectMapper.readTree(creada.getBody()).path("id").asLong();
    }

    private ResponseEntity<String> cambiarEstado(Long ordenId, String estado, String token) {
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setContentType(MediaType.APPLICATION_JSON);
        cabeceras.setBearerAuth(token);

        return rest.exchange("/ordenes/" + ordenId + "/estado", HttpMethod.PATCH,
                new HttpEntity<>(Map.of("estado", estado), cabeceras), String.class);
    }

    private OrdenEstado estadoEnBaseDeDatos(Long ordenId) {
        return ordenRepository.findById(ordenId)
                .map(Orden::getEstado)
                .orElseThrow(() -> new IllegalStateException("la orden " + ordenId + " no existe"));
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
