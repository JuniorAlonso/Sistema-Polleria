package com.sistema.polleria.orders.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sistema.polleria.orders.entity.CodigoSeguimiento;
import com.sistema.polleria.orders.entity.Orden;
import com.sistema.polleria.orders.entity.OrdenEstado;
import com.sistema.polleria.orders.repository.CodigoSeguimientoRepository;
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
 * Problema 2 (S5) — el invitado debe poder cancelar su propio pedido.
 *
 * Un pedido de invitado no tiene dueño autenticado ({@code clienteId = 0}), así que
 * {@code PATCH /ordenes/{id}/estado} siempre le respondía 404 y el cliente que pidió sin cuenta
 * no podía cancelar. El celular verificado por el código de WhatsApp es la identidad del invitado
 * —la misma que ya usa {@code GET /ordenes/seguimiento} para listarle sus pedidos—, así que esa
 * prueba de celular habilita la cancelación por una ruta solo de cancelación:
 * {@code POST /ordenes/seguimiento/{id}/cancelar}.
 *
 * Las pruebas recorren el flujo público real: alta anónima del pedido, código de seguimiento,
 * verificación del código y cancelación. El código se lee de la base porque el envío por WhatsApp
 * es asíncrono y en pruebas apunta a un servicio inexistente.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class CancelacionInvitadoTest {

    private static final String SECRETO = "sanpollo-dev-secret-key-2026-super-segura-256bits-minimo";

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private OrdenRepository ordenRepository;

    @Autowired
    private CodigoSeguimientoRepository codigoSeguimientoRepository;

    @Autowired
    private ProductoRepository productoRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void unInvitadoConSuCelularVerificadoCancelaSuPropioPedido() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        Long ordenId = crearPedidoInvitado("922000101");
        String token = tokenDeSeguimiento("922000101");

        ResponseEntity<String> cancelacion = cancelar(ordenId, token);

        assertEquals(HttpStatus.OK, cancelacion.getStatusCode(),
                "el invitado debe poder cancelar su propio pedido: " + cancelacion.getBody());
        assertEquals(OrdenEstado.CANCELADO, estadoEnBaseDeDatos(ordenId),
                "la cancelación del invitado debe persistirse");
    }

    @Test
    void unInvitadoNoPuedeCancelarElPedidoDeOtroCelular() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        Long ordenAjena = crearPedidoInvitado("922000102");
        // El celular intruso necesita un pedido propio: el código de seguimiento solo se emite
        // para celulares con pedidos, y esta prueba exige un acceso VÁLIDO de OTRO celular.
        crearPedidoInvitado("922000103");
        String tokenAjeno = tokenDeSeguimiento("922000103");

        ResponseEntity<String> intento = cancelar(ordenAjena, tokenAjeno);

        // 404 y no 403: distinguir "existe pero no es tuyo" de "no existe" permitiría enumerar
        // los pedidos de la pollería. Es la misma convención que GET /ordenes/{id}.
        assertEquals(HttpStatus.NOT_FOUND, intento.getStatusCode(),
                "un celular no debe poder cancelar el pedido de otro: " + intento.getBody());
        assertEquals(OrdenEstado.RECIBIDO, estadoEnBaseDeDatos(ordenAjena),
                "el pedido ajeno debe quedar intacto tras el intento rechazado");
    }

    @Test
    void sinAccesoVerificadoNoSePuedeCancelar() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        Long ordenId = crearPedidoInvitado("922000104");
        String tokenDeSeguimientoValido = tokenDeSeguimiento("922000104");

        // Sin header: falta la prueba de celular.
        HttpHeaders sinHeader = new HttpHeaders();
        sinHeader.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<String> sinToken = rest.exchange("/ordenes/seguimiento/" + ordenId + "/cancelar",
                HttpMethod.POST, new HttpEntity<>(null, sinHeader), String.class);

        assertEquals(HttpStatus.BAD_REQUEST, sinToken.getStatusCode(),
                "cancelar sin token de seguimiento debe rechazarse: " + sinToken.getBody());

        // Con un token alterado: el acceso temporal vencido o falsificado no sirve.
        ResponseEntity<String> tokenFalso = cancelar(ordenId, "token.falso.123");

        assertEquals(HttpStatus.BAD_REQUEST, tokenFalso.getStatusCode(),
                "un acceso de seguimiento alterado debe rechazarse: " + tokenFalso.getBody());

        assertEquals(OrdenEstado.RECIBIDO, estadoEnBaseDeDatos(ordenId),
                "el pedido debe seguir intacto tras los intentos rechazados");

        // El mismo pedido, con el acceso que sí corresponde, se cancela: los rechazos de arriba
        // no dejaron el pedido ni la cancelación en un estado roto.
        ResponseEntity<String> cancelacion = cancelar(ordenId, tokenDeSeguimientoValido);
        assertEquals(HttpStatus.OK, cancelacion.getStatusCode(),
                "con el celular verificado la cancelación debe seguir funcionando: " + cancelacion.getBody());
        assertEquals(OrdenEstado.CANCELADO, estadoEnBaseDeDatos(ordenId),
                "la cancelación válida debe persistirse después de los intentos rechazados");
    }

    @Test
    void noSePuedeCancelarUnPedidoYaEntregado() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        Long ordenId = crearPedidoInvitado("922000105");
        avanzarComoPersonal(ordenId, "EN_PREPARACION");
        avanzarComoPersonal(ordenId, "LISTO");
        avanzarComoPersonal(ordenId, "ENTREGADO");

        String token = tokenDeSeguimiento("922000105");
        ResponseEntity<String> intento = cancelar(ordenId, token);

        assertEquals(HttpStatus.BAD_REQUEST, intento.getStatusCode(),
                "un pedido entregado no se puede cancelar: " + intento.getBody());
        assertEquals(OrdenEstado.ENTREGADO, estadoEnBaseDeDatos(ordenId),
                "el pedido entregado debe quedar intacto tras el intento rechazado");
    }


    @Test
    void unAccesoDePersonalNoSirveComoTokenDeSeguimiento() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        Long ordenId = crearPedidoInvitado("922000106");

        // El token de un mozo está firmado con el mismo secreto, pero no es un acceso de seguimiento:
        // la ruta solo acepta el acceso temporal de celular verificado.
        ResponseEntity<String> intento = cancelar(ordenId, tokenDePersonal(999L, "MOZO"));

        assertEquals(HttpStatus.BAD_REQUEST, intento.getStatusCode(),
                "un token de personal no debe servir para cancelar como invitado: " + intento.getBody());
        assertEquals(OrdenEstado.RECIBIDO, estadoEnBaseDeDatos(ordenId),
                "el pedido debe quedar intacto tras el intento rechazado");
    }

    @Test
    void cancelarDosVecesQuedaCancelado() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        Long ordenId = crearPedidoInvitado("922000107");
        String token = tokenDeSeguimiento("922000107");

        assertEquals(HttpStatus.OK, cancelar(ordenId, token).getStatusCode());

        // La máquina de estados corta cuando el estado destino es el mismo, así que la segunda
        // cancelación es 200 sin efectos. Queda fijado porque la documentación decía 400: lo encontró
        // la verificación independiente del commit.
        assertEquals(HttpStatus.OK, cancelar(ordenId, token).getStatusCode(),
                "volver a cancelar un pedido ya cancelado no debe fallar");
        assertEquals(OrdenEstado.CANCELADO, estadoEnBaseDeDatos(ordenId));
    }

    @Test
    void dosPedidosDelMismoCelularSeCancelanPorIdSinAfectarElOtro() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        Long primero = crearPedidoInvitado("922000108");
        Long segundo = crearPedidoInvitado("922000108");
        String token = tokenDeSeguimiento("922000108");

        assertEquals(HttpStatus.OK, cancelar(primero, token).getStatusCode());
        assertEquals(OrdenEstado.CANCELADO, estadoEnBaseDeDatos(primero));
        assertEquals(OrdenEstado.RECIBIDO, estadoEnBaseDeDatos(segundo),
                "el otro pedido del mismo celular no se toca: la cancelación es por id");
    }

    @Test
    void unPedidoInexistenteConAccesoValidoResponde404() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        crearPedidoInvitado("922000109");
        String token = tokenDeSeguimiento("922000109");

        ResponseEntity<String> intento = cancelar(99999999L, token);

        assertEquals(HttpStatus.NOT_FOUND, intento.getStatusCode(),
                "un pedido inexistente debe responder 404, no 400 ni 500: " + intento.getBody());
    }

    /** Alta anónima por el checkout público: el invitado no manda token, solo su celular. */
    private Long crearPedidoInvitado(String telefono) throws Exception {
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> pedido = Map.of(
                "tipo", "DELIVERY",
                "direccionEntrega", "Av. Prueba 123",
                "referencia", "Portón azul",
                "nombreCliente", "Cliente San Pollo",
                "telefonoCliente", telefono,
                "items", List.of(Map.of("productoId", productoIdDisponible(), "cantidad", 1)));

        ResponseEntity<String> creada = rest.exchange("/ordenes", HttpMethod.POST,
                new HttpEntity<>(pedido, cabeceras), String.class);

        assertEquals(HttpStatus.CREATED, creada.getStatusCode(),
                "no se pudo preparar el pedido anónimo de la prueba: " + creada.getBody());

        return objectMapper.readTree(creada.getBody()).path("id").asLong();
    }

    /**
     * Recorre el flujo real de seguimiento: pide el código, lo lee de la base (el envío por WhatsApp
     * es asíncrono y en pruebas no hay notification-service) y lo canjea por el acceso temporal.
     */
    private String tokenDeSeguimiento(String telefono) {
        ResponseEntity<String> solicitud = rest.postForEntity("/ordenes/seguimiento/codigo",
                new HttpEntity<>(Map.of("telefono", telefono), jsonHeaders()), String.class);
        assertEquals(HttpStatus.ACCEPTED, solicitud.getStatusCode(),
                "no se pudo pedir el código de seguimiento: " + solicitud.getBody());

        CodigoSeguimiento codigo = codigoSeguimientoRepository
                .findTopByTelefonoOrderByCreadoEnDesc(telefono)
                .orElseThrow(() -> new IllegalStateException("no se guardó el código de " + telefono));

        ResponseEntity<String> verificacion = rest.postForEntity("/ordenes/seguimiento/verificar",
                new HttpEntity<>(Map.of("telefono", telefono, "codigo", codigo.getCodigo()), jsonHeaders()),
                String.class);

        assertEquals(HttpStatus.OK, verificacion.getStatusCode(),
                "no se pudo verificar el código de seguimiento: " + verificacion.getBody());

        try {
            return objectMapper.readTree(verificacion.getBody()).path("token").asText();
        } catch (Exception e) {
            throw new IllegalStateException("la verificación no devolvió un token", e);
        }
    }

    private ResponseEntity<String> cancelar(Long ordenId, String token) {
        HttpHeaders cabeceras = jsonHeaders();
        cabeceras.set("X-Seguimiento-Token", token);

        return rest.exchange("/ordenes/seguimiento/" + ordenId + "/cancelar",
                HttpMethod.POST, new HttpEntity<>(null, cabeceras), String.class);
    }

    private void avanzarComoPersonal(Long ordenId, String estado) {
        HttpHeaders cabeceras = jsonHeaders();
        cabeceras.setBearerAuth(tokenDePersonal(999L, "MOZO"));

        ResponseEntity<String> respuesta = rest.exchange("/ordenes/" + ordenId + "/estado",
                HttpMethod.PATCH, new HttpEntity<>(Map.of("estado", estado), cabeceras), String.class);

        assertEquals(HttpStatus.OK, respuesta.getStatusCode(),
                "no se pudo preparar el pedido en " + estado + ": " + respuesta.getBody());
    }

    private HttpHeaders jsonHeaders() {
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setContentType(MediaType.APPLICATION_JSON);
        return cabeceras;
    }

    private OrdenEstado estadoEnBaseDeDatos(Long ordenId) {
        return ordenRepository.findById(ordenId)
                .map(Orden::getEstado)
                .orElseThrow(() -> new IllegalStateException("la orden " + ordenId + " no existe"));
    }

    private String tokenDePersonal(long userId, String rol) {
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
