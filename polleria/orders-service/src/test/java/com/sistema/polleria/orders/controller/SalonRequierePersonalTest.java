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

    /**
     * Rango exclusivo de números de mesa de esta clase. Antes el número era aleatorio (9400 + 0..399)
     * y se superponía con MesaForzarTest (9500 + 0..399) y SalonRequierePersonalTest (9100 + 0..799):
     * como la baja de mesas es lógica, la fila quedaba y la otra clase fallaba con «Ya existe la mesa
     * número N». Era un flake que obligaba a repetir la suite entera.
     */
    private static final java.util.concurrent.atomic.AtomicInteger SIGUIENTE_MESA =
            new java.util.concurrent.atomic.AtomicInteger(91000);

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

        int numero = SIGUIENTE_MESA.incrementAndGet();
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
                        new HttpEntity<>(Map.of("estado", "CANCELADO"), cabecerasDeAdmin()), String.class);
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
    void unMicroservicioConClaveInternaPuedeTomarComandaDeSalon() throws Exception {
        ResponseEntity<String> creada = postSalon(CLAVE_INTERNA_VALOR, null);

        assertEquals(HttpStatus.CREATED, creada.getStatusCode(),
                "la llamada interna debe poder crear la comanda: " + creada.getBody());
        ordenesCreadas.add(objectMapper.readTree(creada.getBody()).path("id").asLong());
        assertTrue(creada.getBody() != null && creada.getBody().contains("\"tipo\":\"SALON\""),
                "la comanda creada debe ser de salón. Cuerpo: " + creada.getBody());
        assertEquals(MesaEstado.OCUPADA, estadoDeLaMesa());
    }

    @Test
    void unAdminPuedeTomarComandaDeSalon() throws Exception {
        long adminId = 8801L;
        ResponseEntity<String> creada = postSalon(null, tokenDe(adminId, "ADMIN"));

        assertEquals(HttpStatus.CREATED, creada.getStatusCode(),
                "el ADMIN debe poder abrir una comanda de salón: " + creada.getBody());
        JsonNode cuerpo = objectMapper.readTree(creada.getBody());
        ordenesCreadas.add(cuerpo.path("id").asLong());
        assertEquals(adminId, cuerpo.path("clienteId").asLong());
        assertEquals(adminId, cuerpo.path("mozoId").asLong());
        assertEquals(MesaEstado.OCUPADA, estadoDeLaMesa());
    }

    @Test
    void cocinaRepartidorCajeroYRolesNoAutorizadosNoPuedenAbrirSalon() {
        for (String rol : List.of("COCINA", "REPARTIDOR", "CAJERO", "INVITADO")) {
            ResponseEntity<String> intento = postSalon(null, tokenDe(7000L, rol));
            assertEquals(HttpStatus.FORBIDDEN, intento.getStatusCode(),
                    "el rol " + rol + " no debe poder abrir una comanda SALON: " + intento.getBody());
        }

        // Clave interna inválida tampoco debe permitir abrir SALON
        ResponseEntity<String> claveInvalida = postSalon("clave-interna-invalida", null);
        assertEquals(HttpStatus.FORBIDDEN, claveInvalida.getStatusCode(),
                "una clave interna inválida no debe poder abrir SALON: " + claveInvalida.getBody());

        assertEquals(MesaEstado.LIBRE, estadoDeLaMesa(), "la mesa debe seguir LIBRE");
        assertEquals(0, comandasActivas(), "no debe haberse creado ninguna comanda SALON");
    }

    @Test
    void deliveryYRecojoSiguenFuncionandoParaPublicoYPersonal() throws Exception {
        Long prodId = productoIdDisponible();

        // Público (sin token) puede abrir DELIVERY y RECOJO (quedan en PENDIENTE_PAGO)
        Map<String, Object> deliveryPublico = Map.of(
                "tipo", "DELIVERY",
                "direccionEntrega", "Av. Prueba 456",
                "nombreCliente", "Cliente Delivery",
                "telefonoCliente", "988111222",
                "items", List.of(Map.of("productoId", prodId, "cantidad", 1)));
        HttpHeaders json = new HttpHeaders();
        json.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<String> respDelivery = rest.exchange("/ordenes", HttpMethod.POST,
                new HttpEntity<>(deliveryPublico, json), String.class);
        assertEquals(HttpStatus.CREATED, respDelivery.getStatusCode(),
                "DELIVERY público debe seguir funcionando: " + respDelivery.getBody());
        Long idDelivery = objectMapper.readTree(respDelivery.getBody()).path("id").asLong();
        ordenesCreadas.add(idDelivery);
        assertEquals("PENDIENTE_PAGO", objectMapper.readTree(respDelivery.getBody()).path("estado").asText());

        Map<String, Object> recojoPublico = Map.of(
                "tipo", "RECOJO",
                "nombreCliente", "Cliente Recojo",
                "telefonoCliente", "988111333",
                "items", List.of(Map.of("productoId", prodId, "cantidad", 1)));
        ResponseEntity<String> respRecojo = rest.exchange("/ordenes", HttpMethod.POST,
                new HttpEntity<>(recojoPublico, json), String.class);
        assertEquals(HttpStatus.CREATED, respRecojo.getStatusCode(),
                "RECOJO público debe seguir funcionando: " + respRecojo.getBody());
        Long idRecojo = objectMapper.readTree(respRecojo.getBody()).path("id").asLong();
        ordenesCreadas.add(idRecojo);
        assertEquals("PENDIENTE_PAGO", objectMapper.readTree(respRecojo.getBody()).path("estado").asText());

        // Personal (p. ej. CAJERO) sigue abriendo RECOJO en RECIBIDO
        HttpHeaders cabecerasCajero = new HttpHeaders();
        cabecerasCajero.setContentType(MediaType.APPLICATION_JSON);
        cabecerasCajero.setBearerAuth(tokenDe(7700L, "CAJERO"));
        ResponseEntity<String> respRecojoCajero = rest.exchange("/ordenes", HttpMethod.POST,
                new HttpEntity<>(recojoPublico, cabecerasCajero), String.class);
        assertEquals(HttpStatus.CREATED, respRecojoCajero.getStatusCode(),
                "CAJERO debe poder seguir abriendo RECOJO: " + respRecojoCajero.getBody());
        Long idRecojoCajero = objectMapper.readTree(respRecojoCajero.getBody()).path("id").asLong();
        ordenesCreadas.add(idRecojoCajero);
        assertEquals("RECIBIDO", objectMapper.readTree(respRecojoCajero.getBody()).path("estado").asText());
    }

    @Test
    void wsPolleriaRechazaConexionAnonimaYAceptaConexionAutenticadaDeOrigenConfiable() {
        // Conexión anónima a /ws-polleria/** rechazada
        ResponseEntity<String> anonima = rest.exchange("/ws-polleria/info", HttpMethod.GET,
                new HttpEntity<>(new HttpHeaders()), String.class);
        assertEquals(HttpStatus.FORBIDDEN, anonima.getStatusCode(),
                "Una conexión anónima a /ws-polleria/** debe rechazarse: " + anonima.getBody());

        // Conexión autenticada desde origen confiable conserva el comportamiento permitido
        HttpHeaders autenticadaHeaders = new HttpHeaders();
        autenticadaHeaders.setBearerAuth(tokenDe(MOZO_ID, "MOZO"));
        autenticadaHeaders.setOrigin("http://localhost:4200");
        ResponseEntity<String> autenticada = rest.exchange("/ws-polleria/info", HttpMethod.GET,
                new HttpEntity<>(autenticadaHeaders), String.class);
        assertEquals(HttpStatus.OK, autenticada.getStatusCode(),
                "Una conexión autenticada de origen permitido debe responder 200: " + autenticada.getBody());
        assertTrue(autenticada.getBody() != null && autenticada.getBody().contains("\"websocket\":true"),
                "SockJS /ws-polleria/info debe devolver el descriptor de websocket: " + autenticada.getBody());

        // Origen externo no confiable rechazado aunque esté autenticado
        HttpHeaders origenExternoHeaders = new HttpHeaders();
        origenExternoHeaders.setBearerAuth(tokenDe(MOZO_ID, "MOZO"));
        origenExternoHeaders.setOrigin("https://sitio-externo-no-autorizado.example");
        ResponseEntity<String> origenExterno = rest.exchange("/ws-polleria/info", HttpMethod.GET,
                new HttpEntity<>(origenExternoHeaders), String.class);
        assertEquals(HttpStatus.FORBIDDEN, origenExterno.getStatusCode(),
                "Un origen externo no confiable debe ser rechazado en /ws-polleria/info");
    }

    @Test
    void mozoNoPuedeEntregarNiCancelarUnaOrdenSalon() throws Exception {
        Long ordenId = abrirComandaSalon();
        String tokenMozo = tokenDe(MOZO_ID, "MOZO");

        ResponseEntity<String> intentoCancelar = patchEstadoOrden(ordenId, "CANCELADO", tokenMozo, null);
        assertEquals(HttpStatus.FORBIDDEN, intentoCancelar.getStatusCode(),
                "MOZO no puede cancelar una comanda SALON: " + intentoCancelar.getBody());

        // Avanzar hasta LISTO, servir y poner mesa en POR_COBRAR
        assertEquals(HttpStatus.OK, patchEstadoOrden(ordenId, "EN_PREPARACION", tokenMozo, null).getStatusCode());
        assertEquals(HttpStatus.OK, patchEstadoOrden(ordenId, "LISTO", tokenMozo, null).getStatusCode());
        assertEquals(HttpStatus.OK, postServir(ordenId, tokenMozo).getStatusCode());
        assertEquals(HttpStatus.OK, putEstadoMesa("POR_COBRAR", tokenMozo).getStatusCode());

        ResponseEntity<String> intentoEntregar = patchEstadoOrden(ordenId, "ENTREGADO", tokenMozo, null);
        assertEquals(HttpStatus.FORBIDDEN, intentoEntregar.getStatusCode(),
                "MOZO no puede entregar una comanda SALON: " + intentoEntregar.getBody());
        assertEquals(MesaEstado.POR_COBRAR, estadoDeLaMesa(),
                "la mesa debe permanecer en POR_COBRAR si el mozo intenta entregar");
    }

    @Test
    void cocinaNoPuedeEntregarNiCancelarUnaOrdenSalon() throws Exception {
        Long ordenId = abrirComandaSalon();
        String tokenCocina = tokenDe(6600L, "COCINA");
        String tokenMozo = tokenDe(MOZO_ID, "MOZO");

        ResponseEntity<String> intentoCancelar = patchEstadoOrden(ordenId, "CANCELADO", tokenCocina, null);
        assertEquals(HttpStatus.FORBIDDEN, intentoCancelar.getStatusCode(),
                "COCINA no puede cancelar una comanda SALON: " + intentoCancelar.getBody());

        assertEquals(HttpStatus.OK, patchEstadoOrden(ordenId, "EN_PREPARACION", tokenCocina, null).getStatusCode());
        assertEquals(HttpStatus.OK, patchEstadoOrden(ordenId, "LISTO", tokenCocina, null).getStatusCode());
        assertEquals(HttpStatus.OK, postServir(ordenId, tokenMozo).getStatusCode());
        assertEquals(HttpStatus.OK, putEstadoMesa("POR_COBRAR", tokenMozo).getStatusCode());

        ResponseEntity<String> intentoEntregar = patchEstadoOrden(ordenId, "ENTREGADO", tokenCocina, null);
        assertEquals(HttpStatus.FORBIDDEN, intentoEntregar.getStatusCode(),
                "COCINA no puede entregar una comanda SALON: " + intentoEntregar.getBody());
    }

    @Test
    void cajeroYAdminConservanPermisosParaCancelarYEntregarSalonYEntregadoExigePorCobrar() throws Exception {
        Long ordenId = abrirComandaSalon();
        String tokenMozo = tokenDe(MOZO_ID, "MOZO");
        String tokenCajero = tokenDe(7700L, "CAJERO");
        String tokenAdmin = tokenDe(8800L, "ADMIN");

        assertEquals(HttpStatus.OK, patchEstadoOrden(ordenId, "EN_PREPARACION", tokenMozo, null).getStatusCode());
        assertEquals(HttpStatus.OK, patchEstadoOrden(ordenId, "LISTO", tokenMozo, null).getStatusCode());
        assertEquals(HttpStatus.OK, postServir(ordenId, tokenMozo).getStatusCode());

        // Mesa todavía en OCUPADA -> ENTREGADO devuelve 409 aunque sea CAJERO, ADMIN o clave interna
        assertEquals(HttpStatus.CONFLICT,
                patchEstadoOrden(ordenId, "ENTREGADO", tokenCajero, null).getStatusCode(),
                "ENTREGADO fuera de POR_COBRAR debe devolver 409");
        assertEquals(HttpStatus.CONFLICT,
                patchEstadoOrden(ordenId, "ENTREGADO", tokenAdmin, null).getStatusCode(),
                "ENTREGADO fuera de POR_COBRAR por ADMIN también devuelve 409");
        assertEquals(HttpStatus.CONFLICT,
                patchEstadoOrden(ordenId, "ENTREGADO", null, CLAVE_INTERNA_VALOR).getStatusCode(),
                "ENTREGADO fuera de POR_COBRAR por clave interna también devuelve 409");

        // Cuando la mesa pasa a POR_COBRAR, CAJERO puede marcar ENTREGADO
        assertEquals(HttpStatus.OK, putEstadoMesa("POR_COBRAR", tokenMozo).getStatusCode());
        ResponseEntity<String> entregado = patchEstadoOrden(ordenId, "ENTREGADO", tokenCajero, null);
        assertEquals(HttpStatus.OK, entregado.getStatusCode(),
                "CAJERO puede entregar una comanda SALON cuando la mesa está en POR_COBRAR: " + entregado.getBody());
        assertEquals(MesaEstado.LIBRE, estadoDeLaMesa(), "al entregar la comanda la mesa queda LIBRE");

        // Nueva comanda cancelada por CAJERO
        Long segundaOrdenId = abrirComandaSalon();
        ResponseEntity<String> canceladoPorCajero = patchEstadoOrden(segundaOrdenId, "CANCELADO", tokenCajero, null);
        assertEquals(HttpStatus.OK, canceladoPorCajero.getStatusCode(),
                "CAJERO puede cancelar una comanda SALON: " + canceladoPorCajero.getBody());
        assertEquals(MesaEstado.LIBRE, estadoDeLaMesa(), "al cancelar la comanda la mesa queda LIBRE");

        // Nueva comanda entregada por clave interna con mesa en POR_COBRAR
        Long terceraOrdenId = abrirComandaSalon();
        assertEquals(HttpStatus.OK, patchEstadoOrden(terceraOrdenId, "EN_PREPARACION", tokenMozo, null).getStatusCode());
        assertEquals(HttpStatus.OK, patchEstadoOrden(terceraOrdenId, "LISTO", tokenMozo, null).getStatusCode());
        assertEquals(HttpStatus.OK, postServir(terceraOrdenId, tokenMozo).getStatusCode());
        assertEquals(HttpStatus.OK, putEstadoMesa("POR_COBRAR", tokenMozo).getStatusCode());
        assertEquals(HttpStatus.OK,
                patchEstadoOrden(terceraOrdenId, "ENTREGADO", null, CLAVE_INTERNA_VALOR).getStatusCode(),
                "La clave interna conserva autorización cuando la mesa está en POR_COBRAR");
    }

    @Test
    void porCobrarExigeComandaActivaListaYServida() throws Exception {
        String tokenMozo = tokenDe(MOZO_ID, "MOZO");

        // Mesa OCUPADA sin comanda activa -> 409 al intentar POR_COBRAR
        assertEquals(HttpStatus.OK, putEstadoMesa("OCUPADA", tokenMozo).getStatusCode());
        assertEquals(HttpStatus.CONFLICT, putEstadoMesa("POR_COBRAR", tokenMozo).getStatusCode(),
                "POR_COBRAR sin comanda activa devuelve 409");
        assertEquals(HttpStatus.OK, putEstadoMesa("LIBRE", tokenMozo).getStatusCode());

        // Con comanda en RECIBIDO (no LISTO) -> 409
        Long ordenId = abrirComandaSalon();
        assertEquals(HttpStatus.CONFLICT, putEstadoMesa("POR_COBRAR", tokenMozo).getStatusCode(),
                "POR_COBRAR con comanda no LISTO devuelve 409");

        // Con comanda en LISTO pero no servida -> 409
        assertEquals(HttpStatus.OK, patchEstadoOrden(ordenId, "EN_PREPARACION", tokenMozo, null).getStatusCode());
        assertEquals(HttpStatus.OK, patchEstadoOrden(ordenId, "LISTO", tokenMozo, null).getStatusCode());
        assertEquals(HttpStatus.CONFLICT, putEstadoMesa("POR_COBRAR", tokenMozo).getStatusCode(),
                "POR_COBRAR con comanda no servida devuelve 409");

        // Una vez servida -> permite POR_COBRAR
        assertEquals(HttpStatus.OK, postServir(ordenId, tokenMozo).getStatusCode());
        assertEquals(HttpStatus.OK, putEstadoMesa("POR_COBRAR", tokenMozo).getStatusCode(),
                "Comanda lista y servida permite POR_COBRAR");
        assertEquals(MesaEstado.POR_COBRAR, estadoDeLaMesa());
    }

    private Long abrirComandaSalon() throws Exception {
        ResponseEntity<String> creada = postSalon(null, tokenDe(MOZO_ID, "MOZO"));
        assertEquals(HttpStatus.CREATED, creada.getStatusCode(),
                "no se pudo crear la comanda de salón: " + creada.getBody());
        Long id = objectMapper.readTree(creada.getBody()).path("id").asLong();
        ordenesCreadas.add(id);
        return id;
    }

    private ResponseEntity<String> patchEstadoOrden(Long ordenId, String estado, String token, String claveInterna) {
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setContentType(MediaType.APPLICATION_JSON);
        if (token != null) {
            cabeceras.setBearerAuth(token);
        }
        if (claveInterna != null) {
            cabeceras.set(CLAVE_INTERNA, claveInterna);
        }
        return rest.exchange("/ordenes/" + ordenId + "/estado", HttpMethod.PATCH,
                new HttpEntity<>(Map.of("estado", estado), cabeceras), String.class);
    }

    private ResponseEntity<String> postServir(Long ordenId, String token) {
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setBearerAuth(token);
        return rest.exchange("/ordenes/" + ordenId + "/servir", HttpMethod.POST,
                new HttpEntity<>(cabeceras), String.class);
    }

    private ResponseEntity<String> putEstadoMesa(String estado, String token) {
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setContentType(MediaType.APPLICATION_JSON);
        cabeceras.setBearerAuth(token);
        return rest.exchange("/mesas/" + mesaId + "/estado", HttpMethod.PUT,
                new HttpEntity<>(Map.of("estado", estado), cabeceras), String.class);
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

    /**
     * D1.2: cancelar una comanda de salón (limpieza) lo hace un ADMIN, no el mozo.
     */
    private HttpHeaders cabecerasDeAdmin() {
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setContentType(MediaType.APPLICATION_JSON);
        cabeceras.setBearerAuth(tokenDe(MOZO_ID + 1, "ADMIN"));
        return cabeceras;
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
            if (c.isValid(2)) {
                return true;
            }
        } catch (Exception e) {
            // Checked below so -Drequire.db=true fails loudly.
        }
        if ("true".equalsIgnoreCase(System.getProperty("require.db"))
                || "true".equalsIgnoreCase(System.getenv("REQUIRE_DB"))) {
            throw new AssertionError("PostgreSQL requerido (-Drequire.db=true) no disponible en localhost:5433");
        }
        return false;
    }
}
