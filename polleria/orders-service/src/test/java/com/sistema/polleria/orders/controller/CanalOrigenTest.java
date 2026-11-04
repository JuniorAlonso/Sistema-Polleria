package com.sistema.polleria.orders.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sistema.polleria.orders.entity.Mesa;
import com.sistema.polleria.orders.entity.MesaEstado;
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

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * T2 (S1, S14) — cada pedido registra por qué canal entró.
 *
 * Sin este dato no se pueden medir ni auditar los pedidos de WhatsApp: un pedido anónimo de
 * WhatsApp es de tipo DELIVERY, exactamente igual que uno del checkout web, y solo el canal los
 * distingue. La decisión de L5 es que el canal es **opcional** en el alta: si el request lo trae
 * se respeta, si no, {@code tipo = SALON} deriva {@code SALON} y cualquier otro tipo deriva
 * {@code WEB}. Ese default es además lo que mantiene compatible al checkout web actual, que no
 * manda el campo.
 *
 * Las pruebas recorren el flujo público real (POST /ordenes como invitado o como mozo) y leen el
 * canal persistido directamente de la columna, porque ahí vive la garantía de auditoría.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class CanalOrigenTest {

    private static final String SECRETO = "sanpollo-dev-secret-key-2026-super-segura-256bits-minimo";
    private static final long MOZO_ID = 781L;
    private static final String DB_URL = "jdbc:postgresql://localhost:5433/polleria_test";
    private static final String DB_USER = "postgres";
    private static final String DB_PASS = "postgres123";

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private OrdenRepository ordenRepository;

    @Autowired
    private MesaRepository mesaRepository;

    @Autowired
    private ProductoRepository productoRepository;

    @Autowired
    private ObjectMapper objectMapper;

    /** Órdenes creadas por esta clase: se borran para no dejar comandas activas ni basura. */
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

        // Una comanda de salón ocupa la mesa; se libera para no romper a los demás tests.
        mesaRepository.findByEstadoAndActivoTrue(MesaEstado.OCUPADA).forEach(mesa -> {
            mesa.setEstado(MesaEstado.LIBRE);
            mesaRepository.save(mesa);
        });
    }

    /** (a) Un pedido anónimo de WhatsApp conserva el canal explícito en la respuesta y en la base. */
    @Test
    void unPedidoDeWhatsappGuardaSuCanal() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        ResponseEntity<String> creada = crearPedidoDelivery("922100101", "WHATSAPP");

        assertEquals(HttpStatus.CREATED, creada.getStatusCode(),
                "el alta anónima con canal explícito debe aceptarse: " + creada.getBody());
        Long id = guardarCreada(creada);

        assertEquals("WHATSAPP", objectMapper.readTree(creada.getBody()).path("canalOrigen").asText(),
                "la respuesta debe exponer el canal con el que entró el pedido: " + creada.getBody());
        assertEquals("WHATSAPP", canalEnBaseDeDatos(id),
                "el canal del pedido de WhatsApp debe quedar persistido para poder auditarlo");
    }

    /** (b) Un pedido del checkout web que no manda el campo debe quedar como WEB, no como nulo. */
    @Test
    void unPedidoDelCheckoutWebSinCanalExplicitoQuedaComoWeb() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        ResponseEntity<String> creada = crearPedidoDelivery("922100102", null);

        assertEquals(HttpStatus.CREATED, creada.getStatusCode(),
                "el checkout web actual no manda el canal y no debe romperse: " + creada.getBody());
        Long id = guardarCreada(creada);

        assertEquals("WEB", objectMapper.readTree(creada.getBody()).path("canalOrigen").asText(),
                "sin canal explícito el alta web debe derivar WEB: " + creada.getBody());
        assertEquals("WEB", canalEnBaseDeDatos(id),
                "un pedido web sin canal explícito debe quedar registrado como WEB");
    }

    /** (c) Una comanda de salón sin canal explícito deriva SALON (el canal sigue al tipo). */
    @Test
    void unaComandaDeSalonSinCanalExplicitoQuedaComoSala() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        Mesa mesa = mesaRepository.findByEstadoAndActivoTrue(MesaEstado.LIBRE).stream()
                .findFirst().orElseThrow(() -> new IllegalStateException("no hay mesas libres sembradas"));

        HttpHeaders cabeceras = jsonHeaders();
        cabeceras.setBearerAuth(tokenDePersonal(MOZO_ID, "MOZO"));

        ResponseEntity<String> creada = rest.exchange("/ordenes", HttpMethod.POST,
                new HttpEntity<>(pedidoSalon(mesa.getId()), cabeceras), String.class);

        assertEquals(HttpStatus.CREATED, creada.getStatusCode(),
                "la comanda de salón no debe romperse por el canal nuevo: " + creada.getBody());
        Long id = guardarCreada(creada);

        assertEquals("SALON", objectMapper.readTree(creada.getBody()).path("canalOrigen").asText(),
                "una comanda de salón sin canal explícito debe derivar SALON: " + creada.getBody());
        assertEquals("SALON", canalEnBaseDeDatos(id),
                "la comanda de salón debe quedar registrada como SALON");
    }

    /**
     * (d) Un canal que no existe se rechaza con 400 y no deja ningún pedido creado. Sin esto, un
     * canal desconocido se guardaría (o se ignoraría silenciosamente) y la auditoría mentiría.
     */
    @Test
    void unCanalDesconocidoSeRechazaYNoCreaPedido() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        long ordenesAntes = ordenRepository.count();

        ResponseEntity<String> respuesta = crearPedidoDelivery("922100104", "TELEGRAM");

        assertEquals(HttpStatus.BAD_REQUEST, respuesta.getStatusCode(),
                "un canal desconocido debe rechazarse con 400: " + respuesta.getBody());
        assertEquals(ordenesAntes, ordenRepository.count(),
                "el alta rechazada no debe dejar una orden nueva almacenada");
    }

    // ---------------------------------------------------------------------------------------

    private ResponseEntity<String> crearPedidoDelivery(String telefono, String canalOrigen) {
        return rest.exchange("/ordenes", HttpMethod.POST,
                new HttpEntity<>(pedidoDelivery(telefono, canalOrigen), jsonHeaders()), String.class);
    }

    private Long guardarCreada(ResponseEntity<String> creada) throws Exception {
        Long id = objectMapper.readTree(creada.getBody()).path("id").asLong();
        creadas.add(id);
        return id;
    }

    private Map<String, Object> pedidoDelivery(String telefono, String canalOrigen) {
        Map<String, Object> pedido = new LinkedHashMap<>();
        pedido.put("tipo", "DELIVERY");
        pedido.put("direccionEntrega", "Av. Prueba 123");
        pedido.put("referencia", "Portón azul");
        pedido.put("nombreCliente", "Cliente San Pollo");
        pedido.put("telefonoCliente", telefono);
        if (canalOrigen != null) {
            pedido.put("canalOrigen", canalOrigen);
        }
        pedido.put("items", List.of(Map.of("productoId", productoIdDisponible(), "cantidad", 1)));
        return pedido;
    }

    private Map<String, Object> pedidoSalon(Long mesaId) {
        Map<String, Object> pedido = new LinkedHashMap<>();
        pedido.put("tipo", "SALON");
        pedido.put("mesaId", mesaId);
        pedido.put("nombreCliente", "Mozo Uno");
        pedido.put("items", List.of(Map.of("productoId", productoIdDisponible(), "cantidad", 1)));
        return pedido;
    }

    private HttpHeaders jsonHeaders() {
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setContentType(MediaType.APPLICATION_JSON);
        return cabeceras;
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

    /**
     * Lee la columna persistida directamente: es la prueba de que el canal quedó guardado con el
     * valor correcto, no solo de que viajó en la respuesta.
     */
    private String canalEnBaseDeDatos(Long ordenId) {
        try (Connection c = DriverManager.getConnection(DB_URL, DB_USER, DB_PASS);
             PreparedStatement ps = c.prepareStatement(
                     "SELECT canal_origen FROM ordenes WHERE id = ?")) {
            ps.setLong(1, ordenId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    throw new IllegalStateException("la orden " + ordenId + " no existe");
                }
                return rs.getString("canal_origen");
            }
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("no se pudo leer canal_origen de la orden " + ordenId, e);
        }
    }

    private Long productoIdDisponible() {
        return productoRepository.findByDisponibleTrue().stream()
                .findFirst().orElseThrow(() -> new IllegalStateException("no hay productos disponibles"))
                .getId();
    }

    private boolean postgresDisponible() {
        try (Connection c = DriverManager.getConnection(DB_URL, DB_USER, DB_PASS)) {
            return c.isValid(2);
        } catch (Exception e) {
            return false;
        }
    }
}
