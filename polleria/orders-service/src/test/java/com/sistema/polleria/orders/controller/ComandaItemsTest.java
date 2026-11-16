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

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

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
                cambiarEstado(ordenId, "CANCELADO", tokenDe(MOZO_ID + 1, "ADMIN"));
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
        String tokenMozo = tokenDeMozo();
        String tokenCajero = tokenDe(7777L, "CAJERO");

        // Secuencia completa del salón (D1.2 y D1.6): cocina -> servir -> POR_COBRAR -> cobro en caja (ENTREGADO).
        assertEquals(HttpStatus.OK, cambiarEstado(ordenId, "EN_PREPARACION", tokenMozo).getStatusCode());
        assertEquals(HttpStatus.OK, cambiarEstado(ordenId, "LISTO", tokenMozo).getStatusCode());
        assertEquals(HttpStatus.OK, servir(ordenId, tokenMozo).getStatusCode());
        assertEquals(HttpStatus.OK, cambiarEstadoMesa(mesaId, "POR_COBRAR", tokenMozo).getStatusCode());
        assertEquals(HttpStatus.OK, cambiarEstado(ordenId, "ENTREGADO", tokenCajero).getStatusCode());

        ResponseEntity<String> intento = agregarItems(ordenId, 1, tokenMozo);

        assertEquals(HttpStatus.CONFLICT, intento.getStatusCode(),
                "una comanda cobrada se rechaza con 409: " + intento.getBody());
        assertTrue(intento.getBody() != null && intento.getBody().contains("ENTREGADO"),
                "el mensaje debe explicar el estado. Cuerpo: " + intento.getBody());
        assertEquals(OrdenEstado.ENTREGADO, estadoEnBaseDeDatos(ordenId),
                "la comanda debe seguir ENTREGADO");
        assertEquals(1, itemsEnBaseDeDatos(ordenId), "la comanda no debe modificarse");
    }

    @Test
    void agregarItemsCuandoMesaEstaPorCobrarDevuelveMesaAOcupada() {
        Long ordenId = crearComandaDeSalon();
        String tokenMozo = tokenDeMozo();

        assertEquals(HttpStatus.OK, cambiarEstado(ordenId, "EN_PREPARACION", tokenMozo).getStatusCode());
        assertEquals(HttpStatus.OK, cambiarEstado(ordenId, "LISTO", tokenMozo).getStatusCode());
        assertEquals(HttpStatus.OK, servir(ordenId, tokenMozo).getStatusCode());
        assertEquals(HttpStatus.OK, cambiarEstadoMesa(mesaId, "POR_COBRAR", tokenMozo).getStatusCode());

        ResponseEntity<String> agregado = agregarItems(ordenId, 1, tokenMozo);

        assertEquals(HttpStatus.OK, agregado.getStatusCode(),
                "el mozo puede agregar una ronda aunque la mesa estuviera en POR_COBRAR: " + agregado.getBody());
        assertEquals(com.sistema.polleria.orders.entity.MesaEstado.OCUPADA,
                mesaRepository.findById(mesaId).orElseThrow().getEstado(),
                "la mesa debe volver a OCUPADA tras recibir nuevos productos");
        assertEquals(OrdenEstado.EN_PREPARACION, estadoEnBaseDeDatos(ordenId),
                "la comanda debe volver a EN_PREPARACION");
    }

    @Test
    void comandaInicialAsignaRonda1YAgregadosSucesivosAsignanRonda2YRonda3ConIdsDistintos() throws Exception {
        List<Long> productos = productoRepository.findByDisponibleTrue().stream()
                .map(p -> p.getId())
                .limit(2)
                .toList();
        Long prodA = productos.get(0);
        Long prodB = productos.size() > 1 ? productos.get(1) : prodA;

        // 1. Apertura de comanda inicial con 2 ítems -> ambos deben tener ronda 1
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setContentType(MediaType.APPLICATION_JSON);
        cabeceras.setBearerAuth(tokenDeMozo());

        Map<String, Object> pedidoInicial = Map.of(
                "tipo", "SALON",
                "mesaId", mesaId,
                "nombreCliente", "Mozo " + MOZO_ID,
                "items", List.of(
                        Map.of("productoId", prodA, "cantidad", 1),
                        Map.of("productoId", prodB, "cantidad", 2)));

        ResponseEntity<String> creada = rest.exchange("/ordenes", HttpMethod.POST,
                new HttpEntity<>(pedidoInicial, cabeceras), String.class);
        assertEquals(HttpStatus.CREATED, creada.getStatusCode(), creada.getBody());

        JsonNode bodyInicial = objectMapper.readTree(creada.getBody());
        Long ordenId = bodyInicial.path("id").asLong();
        ordenesCreadas.add(ordenId);

        JsonNode itemsRonda1 = bodyInicial.path("items");
        assertEquals(2, itemsRonda1.size());
        assertEquals(1, itemsRonda1.get(0).path("ronda").asInt());
        assertEquals(1, itemsRonda1.get(1).path("ronda").asInt());
        long idItemRonda1ProdA = itemsRonda1.get(0).path("id").asLong();
        assertTrue(idItemRonda1ProdA > 0, "el ítem debe exponer su id en JSON");

        // 2. Segunda operación de agregado con 2 productos (incluyendo prodA otra vez) -> ambos ronda 2
        Map<String, Object> segundaRonda = Map.of(
                "items", List.of(
                        Map.of("productoId", prodA, "cantidad", 1),
                        Map.of("productoId", prodB, "cantidad", 1)));
        ResponseEntity<String> r2Resp = rest.exchange("/ordenes/" + ordenId + "/items", HttpMethod.POST,
                new HttpEntity<>(segundaRonda, cabeceras), String.class);
        assertEquals(HttpStatus.OK, r2Resp.getStatusCode(), r2Resp.getBody());

        JsonNode itemsTrasR2 = objectMapper.readTree(r2Resp.getBody()).path("items");
        assertEquals(4, itemsTrasR2.size());
        assertEquals(1, itemsTrasR2.get(0).path("ronda").asInt());
        assertEquals(1, itemsTrasR2.get(1).path("ronda").asInt());
        assertEquals(2, itemsTrasR2.get(2).path("ronda").asInt());
        assertEquals(2, itemsTrasR2.get(3).path("ronda").asInt());
        long idItemRonda2ProdA = itemsTrasR2.get(2).path("id").asLong();
        assertTrue(idItemRonda2ProdA > 0 && idItemRonda2ProdA != idItemRonda1ProdA,
                "productos iguales en rondas distintas deben conservar identificadores de ítem diferentes");

        // 3. Tercera operación de agregado -> ronda 3
        Map<String, Object> terceraRonda = Map.of(
                "items", List.of(
                        Map.of("productoId", prodA, "cantidad", 2),
                        Map.of("productoId", prodB, "cantidad", 1)));
        ResponseEntity<String> r3Resp = rest.exchange("/ordenes/" + ordenId + "/items", HttpMethod.POST,
                new HttpEntity<>(terceraRonda, cabeceras), String.class);
        assertEquals(HttpStatus.OK, r3Resp.getStatusCode(), r3Resp.getBody());

        JsonNode itemsTrasR3 = objectMapper.readTree(r3Resp.getBody()).path("items");
        assertEquals(6, itemsTrasR3.size());
        assertEquals(3, itemsTrasR3.get(4).path("ronda").asInt());
        assertEquals(3, itemsTrasR3.get(5).path("ronda").asInt());
    }

    @Test
    void registrosAntiguosConRondaNullSeExponenComoRonda1YSiguienteAgregadoRecibeRonda2() throws Exception {
        Long ordenId = crearComandaDeSalon();

        // Simular dato histórico con ronda NULL en la base de datos
        jdbcTemplate.update("UPDATE orden_items SET ronda = NULL WHERE orden_id = ?", ordenId);
        Integer rondaEnBd = jdbcTemplate.queryForObject(
                "SELECT ronda FROM orden_items WHERE orden_id = ?", Integer.class, ordenId);
        org.junit.jupiter.api.Assertions.assertNull(rondaEnBd, "la columna en BD debe ser NULL para la prueba");

        // GET /ordenes/{id} debe exponer ronda = 1 sin modificar la fila antigua
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setBearerAuth(tokenDeMozo());
        ResponseEntity<String> consulta = rest.exchange("/ordenes/" + ordenId, HttpMethod.GET,
                new HttpEntity<>(cabeceras), String.class);
        assertEquals(HttpStatus.OK, consulta.getStatusCode());
        JsonNode itemsConsulta = objectMapper.readTree(consulta.getBody()).path("items");
        assertEquals(1, itemsConsulta.get(0).path("ronda").asInt(),
                "un ítem con ronda NULL en BD debe exponerse como ronda 1 en JSON");

        // Al agregar ítems, el cálculo de máximo debe considerar NULL como 1 y asignar ronda 2
        ResponseEntity<String> agregado = agregarItems(ordenId, 1, tokenDeMozo());
        assertEquals(HttpStatus.OK, agregado.getStatusCode(), agregado.getBody());
        JsonNode itemsTrasAgregado = objectMapper.readTree(agregado.getBody()).path("items");
        assertEquals(2, itemsTrasAgregado.size());
        assertEquals(1, itemsTrasAgregado.get(0).path("ronda").asInt(),
                "el ítem antiguo sigue exponiéndose como ronda 1");
        assertEquals(2, itemsTrasAgregado.get(1).path("ronda").asInt(),
                "el nuevo ítem debe recibir ronda 2");
    }

    @Test
    void agregadosConcurrentesAsignanRondasSecuencialesSinDuplicados() throws Exception {
        Long ordenId = crearComandaDeSalon();
        String token = tokenDeMozo();
        int hilos = 4;

        java.util.concurrent.CountDownLatch listos = new java.util.concurrent.CountDownLatch(hilos);
        java.util.concurrent.CountDownLatch salida = new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.ExecutorService pool = java.util.concurrent.Executors.newFixedThreadPool(hilos);
        List<HttpStatus> estados = java.util.Collections.synchronizedList(new ArrayList<>());
        List<Throwable> errores = java.util.Collections.synchronizedList(new ArrayList<>());

        for (int i = 0; i < hilos; i++) {
            pool.submit(() -> {
                listos.countDown();
                try {
                    salida.await();
                    ResponseEntity<String> r = agregarItems(ordenId, 1, token);
                    estados.add(HttpStatus.valueOf(r.getStatusCode().value()));
                } catch (Throwable t) {
                    errores.add(t);
                }
            });
        }

        assertTrue(listos.await(15, java.util.concurrent.TimeUnit.SECONDS));
        salida.countDown();
        pool.shutdown();
        assertTrue(pool.awaitTermination(60, java.util.concurrent.TimeUnit.SECONDS));

        assertEquals(List.of(), errores, "no deben ocurrir excepciones en agregados concurrentes");
        assertTrue(estados.stream().allMatch(HttpStatus.OK::equals),
                "todas las adiciones serializadas por el bloqueo pesimista deben responder 200: " + estados);

        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setBearerAuth(token);
        ResponseEntity<String> consulta = rest.exchange("/ordenes/" + ordenId, HttpMethod.GET,
                new HttpEntity<>(cabeceras), String.class);
        JsonNode items = objectMapper.readTree(consulta.getBody()).path("items");
        assertEquals(1 + hilos, items.size(), "deben existir el ítem inicial + los 4 agregados");

        List<Integer> rondas = new ArrayList<>();
        for (JsonNode item : items) {
            rondas.add(item.path("ronda").asInt());
        }
        java.util.Collections.sort(rondas);
        assertEquals(List.of(1, 2, 3, 4, 5), rondas,
                "cada operación concurrente debe recibir su propio número de ronda sin duplicados");
    }

    @Test
    void d18AutorizacionMozoSoloEnRecibidoYAdminEnCualquierEstadoActivoConservandoIdsYRondas() throws Exception {
        String tokenMozo = tokenDeMozo();
        String tokenAdmin = tokenDe(9001L, "ADMIN");

        // Abrir comanda con 2 ítems en ronda 1 y agregar 2 ítems en ronda 2 y 1 ítem en ronda 3 (total 5 ítems)
        Long prodId = productoIdDisponible();
        HttpHeaders cabecerasMozo = new HttpHeaders();
        cabecerasMozo.setContentType(MediaType.APPLICATION_JSON);
        cabecerasMozo.setBearerAuth(tokenMozo);

        Map<String, Object> pedido = Map.of(
                "tipo", "SALON",
                "mesaId", mesaId,
                "nombreCliente", "Mesa D1.8",
                "items", List.of(
                        Map.of("productoId", prodId, "cantidad", 1, "notas", "item-r1-a"),
                        Map.of("productoId", prodId, "cantidad", 2, "notas", "item-r1-b")));
        ResponseEntity<String> creada = rest.exchange("/ordenes", HttpMethod.POST,
                new HttpEntity<>(pedido, cabecerasMozo), String.class);
        assertEquals(HttpStatus.CREATED, creada.getStatusCode(), creada.getBody());
        Long ordenId = objectMapper.readTree(creada.getBody()).path("id").asLong();
        ordenesCreadas.add(ordenId);

        assertEquals(HttpStatus.OK, agregarItems(ordenId, 1, tokenMozo).getStatusCode()); // ronda 2 (ítem 3)
        assertEquals(HttpStatus.OK, agregarItems(ordenId, 1, tokenMozo).getStatusCode()); // ronda 3 (ítem 4)
        assertEquals(HttpStatus.OK, agregarItems(ordenId, 1, tokenMozo).getStatusCode()); // ronda 4 (ítem 5)

        JsonNode itemsIniciales = leerComanda(ordenId, tokenMozo).path("items");
        assertEquals(5, itemsIniciales.size());
        long id1 = itemsIniciales.get(0).path("id").asLong();
        long id2 = itemsIniciales.get(1).path("id").asLong();
        long id3 = itemsIniciales.get(2).path("id").asLong();
        long id4 = itemsIniciales.get(3).path("id").asLong();
        long id5 = itemsIniciales.get(4).path("id").asLong();
        BigDecimal precioUnit = new BigDecimal(itemsIniciales.get(0).path("precioUnitario").asText());

        // 1. MOZO puede quitar un ítem cuando la orden está RECIBIDO (quitamos id2 de ronda 1, cantidad 2)
        ResponseEntity<String> elimMozoRecibido = eliminarItem(ordenId, id2, tokenMozo);
        assertEquals(HttpStatus.OK, elimMozoRecibido.getStatusCode(), elimMozoRecibido.getBody());
        JsonNode trasElim1 = objectMapper.readTree(elimMozoRecibido.getBody());
        assertEquals(4, trasElim1.path("items").size());
        assertEquals(0, precioUnit.multiply(BigDecimal.valueOf(4)).compareTo(new BigDecimal(trasElim1.path("total").asText())),
                "el total debe recalcularse tras quitar el ítem");
        // Los demás ítems conservan sus IDs y rondas sin renumerar (1, 2, 3, 4)
        assertEquals(id1, trasElim1.path("items").get(0).path("id").asLong());
        assertEquals(1, trasElim1.path("items").get(0).path("ronda").asInt());
        assertEquals(id3, trasElim1.path("items").get(1).path("id").asLong());
        assertEquals(2, trasElim1.path("items").get(1).path("ronda").asInt());

        // 2. Pasar la orden a PREPARANDO: MOZO recibe 403, pero ADMIN puede quitar un ítem (quitamos id3 de ronda 2)
        assertEquals(HttpStatus.OK, cambiarEstado(ordenId, "PREPARANDO", tokenMozo).getStatusCode());

        ResponseEntity<String> intentoMozoPrep = eliminarItem(ordenId, id3, tokenMozo);
        assertEquals(HttpStatus.FORBIDDEN, intentoMozoPrep.getStatusCode(),
                "MOZO debe recibir 403 cuando intenta quitar un ítem en PREPARANDO: " + intentoMozoPrep.getBody());
        assertEquals(4, itemsEnBaseDeDatos(ordenId), "el intento rechazado de MOZO no debe eliminar el ítem");

        ResponseEntity<String> elimAdminPrep = eliminarItem(ordenId, id3, tokenAdmin);
        assertEquals(HttpStatus.OK, elimAdminPrep.getStatusCode(),
                "ADMIN debe poder quitar un ítem en PREPARANDO: " + elimAdminPrep.getBody());
        JsonNode trasElimAdminPrep = objectMapper.readTree(elimAdminPrep.getBody());
        assertEquals(3, trasElimAdminPrep.path("items").size());
        // Las rondas restantes (1, 3, 4) no se renumeran
        assertEquals(1, trasElimAdminPrep.path("items").get(0).path("ronda").asInt());
        assertEquals(3, trasElimAdminPrep.path("items").get(1).path("ronda").asInt());
        assertEquals(4, trasElimAdminPrep.path("items").get(2).path("ronda").asInt());

        // 3. Pasar la orden a LISTO: MOZO recibe 403, pero ADMIN puede quitar un ítem (quitamos id4 de ronda 3)
        assertEquals(HttpStatus.OK, cambiarEstado(ordenId, "LISTO", tokenMozo).getStatusCode());

        ResponseEntity<String> intentoMozoListo = eliminarItem(ordenId, id4, tokenMozo);
        assertEquals(HttpStatus.FORBIDDEN, intentoMozoListo.getStatusCode(),
                "MOZO debe recibir 403 cuando intenta quitar un ítem en LISTO: " + intentoMozoListo.getBody());
        assertEquals(3, itemsEnBaseDeDatos(ordenId));

        ResponseEntity<String> elimAdminListo = eliminarItem(ordenId, id4, tokenAdmin);
        assertEquals(HttpStatus.OK, elimAdminListo.getStatusCode(),
                "ADMIN debe poder quitar un ítem en LISTO: " + elimAdminListo.getBody());
        JsonNode trasElimAdminListo = objectMapper.readTree(elimAdminListo.getBody());
        assertEquals(2, trasElimAdminListo.path("items").size());
        assertEquals(id1, trasElimAdminListo.path("items").get(0).path("id").asLong());
        assertEquals(1, trasElimAdminListo.path("items").get(0).path("ronda").asInt());
        assertEquals(id5, trasElimAdminListo.path("items").get(1).path("id").asLong());
        assertEquals(4, trasElimAdminListo.path("items").get(1).path("ronda").asInt());
    }

    @Test
    void d18RolesNoAutorizadosYAnonimoReciben403AlIntentarQuitarItem() throws Exception {
        Long ordenId = crearComandaDeSalon();
        assertEquals(HttpStatus.OK, agregarItems(ordenId, 1, tokenDeMozo()).getStatusCode());

        JsonNode items = leerComanda(ordenId, tokenDeMozo()).path("items");
        long itemId = items.get(1).path("id").asLong();

        for (String rol : List.of("COCINA", "CAJERO", "REPARTIDOR", "CLIENTE")) {
            ResponseEntity<String> resp = eliminarItem(ordenId, itemId, tokenDe(8800L, rol));
            assertEquals(HttpStatus.FORBIDDEN, resp.getStatusCode(),
                    rol + " debe recibir 403 al intentar quitar un ítem: " + resp.getBody());
        }

        ResponseEntity<String> respAnonimo = eliminarItem(ordenId, itemId, null);
        assertEquals(HttpStatus.FORBIDDEN, respAnonimo.getStatusCode(),
                "Usuario anónimo debe ser rechazado con 403: " + respAnonimo.getBody());

        assertEquals(2, itemsEnBaseDeDatos(ordenId), "la comanda debe conservar intactos sus 2 ítems");
    }

    @Test
    void d18ValidacionesOrdenInexistenteItemInexistenteItemAjenoNoSalonCerradaCanceladaYUltimoItem() throws Exception {
        String tokenMozo = tokenDeMozo();
        String tokenAdmin = tokenDe(9002L, "ADMIN");
        String tokenCajero = tokenDe(9003L, "CAJERO");

        // 1. Orden inexistente -> 404
        ResponseEntity<String> ordenInexistente = eliminarItem(99999999L, 1L, tokenAdmin);
        assertEquals(HttpStatus.NOT_FOUND, ordenInexistente.getStatusCode());

        // 2. Abrir comanda en mesa principal con 2 ítems
        Long ordenId = crearComandaDeSalon();
        assertEquals(HttpStatus.OK, agregarItems(ordenId, 1, tokenMozo).getStatusCode());
        JsonNode itemsOrden1 = leerComanda(ordenId, tokenMozo).path("items");
        long item1Orden1 = itemsOrden1.get(0).path("id").asLong();
        long item2Orden1 = itemsOrden1.get(1).path("id").asLong();

        // 3. Ítem inexistente en la orden -> 404
        ResponseEntity<String> itemInexistente = eliminarItem(ordenId, 99999999L, tokenMozo);
        assertEquals(HttpStatus.NOT_FOUND, itemInexistente.getStatusCode());
        assertEquals(2, itemsEnBaseDeDatos(ordenId));

        // 4. Ítem perteneciente a otra orden -> 404 sin eliminar datos de ninguna de las dos órdenes
        Long prodId = productoIdDisponible();
        HttpHeaders cabecerasAdmin = new HttpHeaders();
        cabecerasAdmin.setContentType(MediaType.APPLICATION_JSON);
        cabecerasAdmin.setBearerAuth(tokenAdmin);
        Map<String, Object> pedidoRecojo = Map.of(
                "tipo", "RECOJO",
                "nombreCliente", "Cliente Recojo",
                "telefonoCliente", "987654321",
                "items", List.of(
                        Map.of("productoId", prodId, "cantidad", 1),
                        Map.of("productoId", prodId, "cantidad", 1)));
        ResponseEntity<String> recojoCreado = rest.exchange("/ordenes", HttpMethod.POST,
                new HttpEntity<>(pedidoRecojo, cabecerasAdmin), String.class);
        assertEquals(HttpStatus.CREATED, recojoCreado.getStatusCode(), recojoCreado.getBody());
        JsonNode bodyRecojo = objectMapper.readTree(recojoCreado.getBody());
        Long ordenRecojoId = bodyRecojo.path("id").asLong();
        ordenesCreadas.add(ordenRecojoId);
        long itemDeOtraOrden = bodyRecojo.path("items").get(0).path("id").asLong();

        ResponseEntity<String> intentoItemAjeno = eliminarItem(ordenId, itemDeOtraOrden, tokenMozo);
        assertEquals(HttpStatus.NOT_FOUND, intentoItemAjeno.getStatusCode(),
                "un ítem de otra orden debe responder 404 sin tocar ninguna de las órdenes: " + intentoItemAjeno.getBody());
        assertEquals(2, itemsEnBaseDeDatos(ordenId), "la orden SALON conserva sus 2 ítems");
        assertEquals(2, itemsEnBaseDeDatos(ordenRecojoId), "la otra orden conserva sus 2 ítems");

        // 5. Orden de tipo diferente de SALON (RECOJO) -> 400
        ResponseEntity<String> intentoNoSalon = eliminarItem(ordenRecojoId, itemDeOtraOrden, tokenAdmin);
        assertEquals(HttpStatus.BAD_REQUEST, intentoNoSalon.getStatusCode(),
                "una orden que no es SALON debe rechazarse con 400: " + intentoNoSalon.getBody());
        assertEquals(2, itemsEnBaseDeDatos(ordenRecojoId));

        // 6. Eliminar el segundo ítem de la orden SALON deja 1 ítem; intentar eliminar el último -> 409 CONFLICT
        assertEquals(HttpStatus.OK, eliminarItem(ordenId, item2Orden1, tokenMozo).getStatusCode());
        assertEquals(1, itemsEnBaseDeDatos(ordenId));

        ResponseEntity<String> intentoUltimo = eliminarItem(ordenId, item1Orden1, tokenAdmin);
        assertEquals(HttpStatus.CONFLICT, intentoUltimo.getStatusCode(),
                "intentar eliminar el último producto debe responder 409 CONFLICT: " + intentoUltimo.getBody());
        assertTrue(intentoUltimo.getBody() != null && intentoUltimo.getBody().toLowerCase().contains("sin productos"),
                "el mensaje debe indicar que no se puede dejar una comanda sin productos: " + intentoUltimo.getBody());
        assertEquals(1, itemsEnBaseDeDatos(ordenId), "el último ítem no debe eliminarse");

        // 7. Orden cerrada (ENTREGADO) -> 409 CONFLICT
        assertEquals(HttpStatus.OK, cambiarEstado(ordenId, "EN_PREPARACION", tokenMozo).getStatusCode());
        assertEquals(HttpStatus.OK, cambiarEstado(ordenId, "LISTO", tokenMozo).getStatusCode());
        assertEquals(HttpStatus.OK, servir(ordenId, tokenMozo).getStatusCode());
        assertEquals(HttpStatus.OK, cambiarEstadoMesa(mesaId, "POR_COBRAR", tokenMozo).getStatusCode());
        assertEquals(HttpStatus.OK, cambiarEstado(ordenId, "ENTREGADO", tokenCajero).getStatusCode());

        ResponseEntity<String> intentoCerrada = eliminarItem(ordenId, item1Orden1, tokenAdmin);
        assertEquals(HttpStatus.CONFLICT, intentoCerrada.getStatusCode(),
                "una orden cerrada (ENTREGADO) debe responder 409: " + intentoCerrada.getBody());

        // 8. Orden cancelada (CANCELADO) -> 409 CONFLICT
        Long ordenCanceladaId = crearComandaDeSalon();
        assertEquals(HttpStatus.OK, agregarItems(ordenCanceladaId, 1, tokenMozo).getStatusCode());
        long itemOrdenCancelada = leerComanda(ordenCanceladaId, tokenMozo).path("items").get(0).path("id").asLong();
        assertEquals(HttpStatus.OK, cambiarEstado(ordenCanceladaId, "CANCELADO", tokenAdmin).getStatusCode());

        ResponseEntity<String> intentoCancelada = eliminarItem(ordenCanceladaId, itemOrdenCancelada, tokenAdmin);
        assertEquals(HttpStatus.CONFLICT, intentoCancelada.getStatusCode(),
                "una orden cancelada (CANCELADO) debe responder 409: " + intentoCancelada.getBody());
    }

    @Test
    void d18StockSeReponeEnRecibidoSinDobleReposicionYConcurrenciaNoDejaComandaVacia() throws Exception {
        String tokenMozo = tokenDeMozo();
        String tokenAdmin = tokenDe(9004L, "ADMIN");

        // Crear un producto temporal con stock = 5 para verificar inventario real en PostgreSQL
        com.sistema.polleria.orders.entity.Producto prodTemp = productoRepository.save(
                com.sistema.polleria.orders.entity.Producto.builder()
                        .nombre("Pollo Stock Test D1.8")
                        .descripcion("Prueba stock D1.8")
                        .precio(new BigDecimal("25.00"))
                        .categoria(com.sistema.polleria.orders.entity.Categoria.values()[0])
                        .disponible(true)
                        .stock(5)
                        .build());

        try {
            // Abrir comanda en RECIBIDO con 2 ítems de prodTemp (cantidades 2 y 3 -> agota stock a 0 y disponible=false)
            HttpHeaders cabecerasMozo = new HttpHeaders();
            cabecerasMozo.setContentType(MediaType.APPLICATION_JSON);
            cabecerasMozo.setBearerAuth(tokenMozo);

            Map<String, Object> pedido = Map.of(
                    "tipo", "SALON",
                    "mesaId", mesaId,
                    "nombreCliente", "Stock Test",
                    "items", List.of(
                            Map.of("productoId", prodTemp.getId(), "cantidad", 2),
                            Map.of("productoId", prodTemp.getId(), "cantidad", 3)));
            ResponseEntity<String> creada = rest.exchange("/ordenes", HttpMethod.POST,
                    new HttpEntity<>(pedido, cabecerasMozo), String.class);
            assertEquals(HttpStatus.CREATED, creada.getStatusCode(), creada.getBody());

            JsonNode bodyCreada = objectMapper.readTree(creada.getBody());
            Long ordenId = bodyCreada.path("id").asLong();
            ordenesCreadas.add(ordenId);
            long item1Id = bodyCreada.path("items").get(0).path("id").asLong(); // cant 2
            long item2Id = bodyCreada.path("items").get(1).path("id").asLong(); // cant 3

            com.sistema.polleria.orders.entity.Producto trasCrear = productoRepository.findById(prodTemp.getId()).orElseThrow();
            assertEquals(0, trasCrear.getStock());
            org.junit.jupiter.api.Assertions.assertFalse(trasCrear.isDisponible());

            // Concurrencia: dos hilos intentan eliminar item1Id e item2Id simultáneamente sobre la comanda de 2 ítems.
            // Gracias al bloqueo pesimista, uno debe responder 200 OK y el otro debe responder 409 CONFLICT (último ítem).
            java.util.concurrent.CountDownLatch listos = new java.util.concurrent.CountDownLatch(2);
            java.util.concurrent.CountDownLatch salida = new java.util.concurrent.CountDownLatch(1);
            java.util.concurrent.ExecutorService pool = java.util.concurrent.Executors.newFixedThreadPool(2);
            List<HttpStatus> estados = java.util.Collections.synchronizedList(new ArrayList<>());

            for (long idItem : List.of(item1Id, item2Id)) {
                pool.submit(() -> {
                    listos.countDown();
                    try {
                        salida.await();
                        ResponseEntity<String> r = eliminarItem(ordenId, idItem, tokenMozo);
                        estados.add(HttpStatus.valueOf(r.getStatusCode().value()));
                    } catch (Throwable ignored) {
                    }
                });
            }

            assertTrue(listos.await(15, java.util.concurrent.TimeUnit.SECONDS));
            salida.countDown();
            pool.shutdown();
            assertTrue(pool.awaitTermination(30, java.util.concurrent.TimeUnit.SECONDS));

            assertEquals(2, estados.size());
            assertTrue(estados.contains(HttpStatus.OK), "una de las dos eliminaciones debe tener éxito (200): " + estados);
            assertTrue(estados.contains(HttpStatus.CONFLICT), "la segunda eliminación debe rechazarse con 409 para no vaciar la comanda: " + estados);
            assertEquals(1, itemsEnBaseDeDatos(ordenId), "la comanda nunca debe quedar vacía");

            // Verificar que el stock se repuso exactamente por el ítem eliminado y reactivó disponible=true
            JsonNode comandaRestante = leerComanda(ordenId, tokenMozo);
            int cantidadRestante = comandaRestante.path("items").get(0).path("cantidad").asInt();
            int cantidadEliminada = 5 - cantidadRestante;
            com.sistema.polleria.orders.entity.Producto trasEliminarUno = productoRepository.findById(prodTemp.getId()).orElseThrow();
            assertEquals(cantidadEliminada, trasEliminarUno.getStock(), "el stock debe haberse repuesto exactamente una vez");
            assertTrue(trasEliminarUno.isDisponible(), "el producto debe volver a estar disponible");

            // Si ahora se cancela la comanda en RECIBIDO, solo se repone el ítem restante (total vuelve a 5, sin doble reposición)
            assertEquals(HttpStatus.OK, cambiarEstado(ordenId, "CANCELADO", tokenAdmin).getStatusCode());
            com.sistema.polleria.orders.entity.Producto trasCancelar = productoRepository.findById(prodTemp.getId()).orElseThrow();
            assertEquals(5, trasCancelar.getStock(), "al cancelar la orden no se debe reponer dos veces el ítem ya eliminado");

            // Verificar además en BD real que al quitar ítems en PREPARANDO o LISTO (por ADMIN) NO se repone stock
            Map<String, Object> pedido2 = Map.of(
                    "tipo", "SALON",
                    "mesaId", mesaId,
                    "nombreCliente", "Stock Estados Activos Test",
                    "items", List.of(
                            Map.of("productoId", prodTemp.getId(), "cantidad", 1),
                            Map.of("productoId", prodTemp.getId(), "cantidad", 1),
                            Map.of("productoId", prodTemp.getId(), "cantidad", 1)));
            ResponseEntity<String> creada2 = rest.exchange("/ordenes", HttpMethod.POST,
                    new HttpEntity<>(pedido2, cabecerasMozo), String.class);
            assertEquals(HttpStatus.CREATED, creada2.getStatusCode(), creada2.getBody());
            JsonNode body2 = objectMapper.readTree(creada2.getBody());
            Long orden2Id = body2.path("id").asLong();
            ordenesCreadas.add(orden2Id);
            long itemPrepId = body2.path("items").get(1).path("id").asLong();
            long itemListoId = body2.path("items").get(2).path("id").asLong();

            // Stock actual = 5 - 3 = 2
            assertEquals(2, productoRepository.findById(prodTemp.getId()).orElseThrow().getStock());

            assertEquals(HttpStatus.OK, cambiarEstado(orden2Id, "PREPARANDO", tokenMozo).getStatusCode());
            assertEquals(HttpStatus.OK, eliminarItem(orden2Id, itemPrepId, tokenAdmin).getStatusCode());
            assertEquals(2, productoRepository.findById(prodTemp.getId()).orElseThrow().getStock(),
                    "al eliminar un ítem en PREPARANDO no debe reponerse stock");

            assertEquals(HttpStatus.OK, cambiarEstado(orden2Id, "LISTO", tokenMozo).getStatusCode());
            assertEquals(HttpStatus.OK, eliminarItem(orden2Id, itemListoId, tokenAdmin).getStatusCode());
            assertEquals(2, productoRepository.findById(prodTemp.getId()).orElseThrow().getStock(),
                    "al eliminar un ítem en LISTO no debe reponerse stock");
        } finally {
            // Limpiar las órdenes que referencian prodTemp antes de borrar el producto temporal
            for (Long id : new ArrayList<>(ordenesCreadas)) {
                ordenRepository.deleteById(id);
            }
            ordenesCreadas.clear();
            productoRepository.deleteById(prodTemp.getId());
        }
    }

    private ResponseEntity<String> eliminarItem(Long ordenId, Long itemId, String token) {
        HttpHeaders cabeceras = new HttpHeaders();
        if (token != null) {
            cabeceras.setBearerAuth(token);
        }
        return rest.exchange("/ordenes/" + ordenId + "/items/" + itemId, HttpMethod.DELETE,
                new HttpEntity<>(cabeceras), String.class);
    }

    private JsonNode leerComanda(Long ordenId, String token) throws Exception {
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setBearerAuth(token);
        ResponseEntity<String> resp = rest.exchange("/ordenes/" + ordenId, HttpMethod.GET,
                new HttpEntity<>(cabeceras), String.class);
        assertEquals(HttpStatus.OK, resp.getStatusCode(), resp.getBody());
        return objectMapper.readTree(resp.getBody());
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

    private ResponseEntity<String> servir(Long ordenId, String token) {
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setBearerAuth(token);
        return rest.exchange("/ordenes/" + ordenId + "/servir", HttpMethod.POST,
                new HttpEntity<>(cabeceras), String.class);
    }

    private ResponseEntity<String> cambiarEstadoMesa(Long idMesa, String estado, String token) {
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setContentType(MediaType.APPLICATION_JSON);
        cabeceras.setBearerAuth(token);
        return rest.exchange("/mesas/" + idMesa + "/estado", HttpMethod.PUT,
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
