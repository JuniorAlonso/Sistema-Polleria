package com.sistema.polleria.orders.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sistema.polleria.orders.entity.CanalOrigen;
import com.sistema.polleria.orders.entity.Orden;
import com.sistema.polleria.orders.entity.OrdenEstado;
import com.sistema.polleria.orders.entity.OrdenTipo;
import com.sistema.polleria.orders.repository.OrdenRepository;
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
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * T11 (S10) — el repartidor ve los pedidos de delivery listos que todavía no tomó nadie y los
 * toma con un reclamo atómico.
 *
 * Decisión de L5: un pedido está «disponible para entregar» cuando es {@code DELIVERY}, su estado
 * es {@code LISTO} y no tiene {@code repartidorId}. Nada de salón ni de recojo, y nada que la
 * cocina no haya terminado.
 *
 * El punto que cuida el dueño («si dos repartidores toman el mismo pedido este no se reparta 2
 * veces») se prueba con una carrera real en {@link ReclamoPedidoConcurrenteTest}. Aquí se cubre
 * la visibilidad de la lista, el reclamo feliz, el segundo intento (409), que tomar no avanza la
 * máquina de estados y que un rol que no reparte no puede tomar.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class RepartidorDisponiblesTest {

    private static final String SECRETO = "sanpollo-dev-secret-key-2026-super-segura-256bits-minimo";
    private static final long REPARTIDOR_A = 631L;
    private static final long REPARTIDOR_B = 632L;

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private OrdenRepository ordenRepository;

    @Autowired
    private ObjectMapper objectMapper;

    /** Órdenes sembradas por esta clase: se borran para no dejar basura en la base compartida. */
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

    /**
     * (a) Un delivery LISTO sin repartidor aparece en la lista del repartidor autenticado.
     */
    @Test
    void unDeliveryListoSinRepartidorApareceEnDisponibles() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        Long id = sembrar(OrdenTipo.DELIVERY, OrdenEstado.LISTO, null, "930000001");

        ResponseEntity<String> lista = disponibles(tokenDe(REPARTIDOR_A, "REPARTIDOR"));

        assertEquals(HttpStatus.OK, lista.getStatusCode(),
                "el repartidor debe poder ver los pedidos disponibles: " + lista.getBody());
        assertTrue(contiene(objectMapper.readTree(lista.getBody()), id),
                "un delivery LISTO sin repartidor debe aparecer en la lista: " + lista.getBody());
    }

    /**
     * (b) Un pedido que ya tiene repartidor no aparece: ya no está disponible para nadie.
     */
    @Test
    void unPedidoYaTomadoNoApareceEnDisponibles() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        Long id = sembrar(OrdenTipo.DELIVERY, OrdenEstado.LISTO, REPARTIDOR_A, "930000002");

        ResponseEntity<String> lista = disponibles(tokenDe(REPARTIDOR_B, "REPARTIDOR"));

        assertEquals(HttpStatus.OK, lista.getStatusCode(),
                "el repartidor debe poder ver los pedidos disponibles: " + lista.getBody());
        assertTrue(!contiene(objectMapper.readTree(lista.getBody()), id),
                "un pedido ya tomado no debe ofrecerse a otro repartidor: " + lista.getBody());
    }

    /**
     * (c) No son entregables: ni el salón, ni el recojo, ni un delivery que la cocina todavía no
     * terminó. Sin esta regla el repartidor podría tomar un pedido que no existe para llevar.
     */
    @Test
    void salonRecojoYDeliveryNoListoNoAparecenEnDisponibles() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        Long salon = sembrar(OrdenTipo.SALON, OrdenEstado.LISTO, null, "930000003");
        Long recojo = sembrar(OrdenTipo.RECOJO, OrdenEstado.LISTO, null, "930000004");
        Long noListo = sembrar(OrdenTipo.DELIVERY, OrdenEstado.EN_PREPARACION, null, "930000005");

        ResponseEntity<String> lista = disponibles(tokenDe(REPARTIDOR_A, "REPARTIDOR"));

        assertEquals(HttpStatus.OK, lista.getStatusCode(),
                "el repartidor debe poder ver los pedidos disponibles: " + lista.getBody());
        JsonNode cuerpo = objectMapper.readTree(lista.getBody());
        assertTrue(!contiene(cuerpo, salon),
                "un pedido de salón no se entrega a domicilio: " + lista.getBody());
        assertTrue(!contiene(cuerpo, recojo),
                "un pedido de recojo no se entrega a domicilio: " + lista.getBody());
        assertTrue(!contiene(cuerpo, noListo),
                "un delivery que no está LISTO no se ofrece al repartidor: " + lista.getBody());
    }

    /**
     * (d) El repartidor toma el pedido: queda asignado a él y el estado NO cambia. Pasar a
     * {@code EN_CAMINO} sigue siendo la acción explícita y separada del repartidor.
     */
    @Test
    void elRepartidorTomaElPedidoSinCambiarElEstado() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        Long id = sembrar(OrdenTipo.DELIVERY, OrdenEstado.LISTO, null, "930000006");

        ResponseEntity<String> toma = reclamar(id, tokenDe(REPARTIDOR_A, "REPARTIDOR"));

        assertEquals(HttpStatus.OK, toma.getStatusCode(),
                "el repartidor debe poder tomar el pedido: " + toma.getBody());
        JsonNode cuerpo = objectMapper.readTree(toma.getBody());
        assertEquals(REPARTIDOR_A, cuerpo.path("repartidorId").asLong(),
                "el pedido debe quedar asignado al repartidor autenticado: " + toma.getBody());
        assertEquals("LISTO", cuerpo.path("estado").asText(),
                "tomar el pedido NO lo pasa a EN_CAMINO: " + toma.getBody());

        Orden enBase = ordenRepository.findById(id)
                .orElseThrow(() -> new IllegalStateException("la orden " + id + " no existe"));
        assertEquals(REPARTIDOR_A, enBase.getRepartidorId(),
                "la asignación del repartidor debe persistirse");
        assertEquals(OrdenEstado.LISTO, enBase.getEstado(),
                "el estado debe seguir en LISTO tras el reclamo");
    }

    /**
     * (e) El segundo intento de tomarlo —otro repartidor— recibe 409 y en la base sigue el
     * primero. El que perdió no puede pisar al que ganó.
     */
    @Test
    void elSegundoReclamoRecibe409YNoPisaAlGanador() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        Long id = sembrar(OrdenTipo.DELIVERY, OrdenEstado.LISTO, null, "930000007");

        ResponseEntity<String> primero = reclamar(id, tokenDe(REPARTIDOR_A, "REPARTIDOR"));
        assertEquals(HttpStatus.OK, primero.getStatusCode(),
                "el primer repartidor debe ganar el pedido: " + primero.getBody());

        ResponseEntity<String> segundo = reclamar(id, tokenDe(REPARTIDOR_B, "REPARTIDOR"));

        assertEquals(HttpStatus.CONFLICT, segundo.getStatusCode(),
                "el segundo repartidor debe recibir 409: " + segundo.getBody());
        assertEquals("El pedido #" + id + " ya fue tomado por un repartidor.",
                objectMapper.readTree(segundo.getBody()).path("error").asText(),
                "el conflicto debe explicar que el pedido ya fue tomado: " + segundo.getBody());

        Orden enBase = ordenRepository.findById(id)
                .orElseThrow(() -> new IllegalStateException("la orden " + id + " no existe"));
        assertEquals(REPARTIDOR_A, enBase.getRepartidorId(),
                "el repartidor que ganó debe seguir asignado: el que perdió no lo pisa");
    }

    /**
     * PRESERVE — la ruta literal {@code /ordenes/disponibles} no debe tapar a {@code GET
     * /ordenes/{id}}: el repartidor sigue leyendo un pedido puntual por su id.
     */
    @Test
    void getOrdenPorIdSigueFuncionandoJuntoADisponibles() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        Long id = sembrar(OrdenTipo.DELIVERY, OrdenEstado.LISTO, null, "930000009");

        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setBearerAuth(tokenDe(REPARTIDOR_A, "REPARTIDOR"));
        ResponseEntity<String> respuesta = rest.exchange("/ordenes/" + id, HttpMethod.GET,
                new HttpEntity<>(cabeceras), String.class);

        assertEquals(HttpStatus.OK, respuesta.getStatusCode(),
                "GET /ordenes/{id} debe seguir resolviendo por id: " + respuesta.getBody());
        assertEquals(id, objectMapper.readTree(respuesta.getBody()).path("id").asLong(),
                "la ruta nueva no debe interceptar el pedido puntual: " + respuesta.getBody());
    }

    /**
     * (g) Un cliente o un mozo no reparten: no pueden tomar pedidos. La autorización es por rol
     * y el intento rechazado deja el pedido intacto.
     */
    @Test
    void unClienteOUnMozoNoPuedenTomarPedidos() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        Long id = sembrar(OrdenTipo.DELIVERY, OrdenEstado.LISTO, null, "930000008");

        ResponseEntity<String> comoCliente = reclamar(id, tokenDe(700L, "CLIENTE"));
        ResponseEntity<String> comoMozo = reclamar(id, tokenDe(701L, "MOZO"));

        assertEquals(HttpStatus.FORBIDDEN, comoCliente.getStatusCode(),
                "un cliente no puede tomar pedidos: " + comoCliente.getBody());
        assertEquals(HttpStatus.FORBIDDEN, comoMozo.getStatusCode(),
                "un mozo no puede tomar pedidos: " + comoMozo.getBody());
        assertNull(ordenRepository.findById(id).orElseThrow().getRepartidorId(),
                "un intento rechazado no debe asignar repartidor");
    }

    // ---------------------------------------------------------------------------------------

    private Long sembrar(OrdenTipo tipo, OrdenEstado estado, Long repartidorId, String telefono) {
        Orden orden = Orden.builder()
                .tipo(tipo)
                .canalOrigen(CanalOrigen.WEB)
                .estado(estado)
                .direccionEntrega(tipo == OrdenTipo.DELIVERY ? "Av. Prueba 123" : null)
                .nombreCliente("Cliente " + telefono)
                .telefonoCliente(telefono)
                .repartidorId(repartidorId)
                .build();
        Orden guardada = ordenRepository.save(orden);
        creadas.add(guardada.getId());
        return guardada.getId();
    }

    private ResponseEntity<String> disponibles(String token) {
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setBearerAuth(token);
        return rest.exchange("/ordenes/disponibles", HttpMethod.GET,
                new HttpEntity<>(cabeceras), String.class);
    }

    private ResponseEntity<String> reclamar(Long ordenId, String token) {
        HttpHeaders cabeceras = new HttpHeaders();
        if (token != null) {
            cabeceras.setBearerAuth(token);
        }
        return rest.exchange("/ordenes/" + ordenId + "/reclamo", HttpMethod.POST,
                new HttpEntity<>(cabeceras), String.class);
    }

    private boolean contiene(JsonNode lista, Long id) {
        for (JsonNode nodo : lista) {
            if (nodo.path("id").asLong() == id) {
                return true;
            }
        }
        return false;
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
