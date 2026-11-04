package com.sistema.polleria.orders.controller;

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
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * T11 (S10) — carrera real: varios repartidores reclaman el MISMO pedido a la vez.
 *
 * La promesa del dueño es que un pedido no se reparta dos veces. La prueba limpia el camino
 * feliz y el 409 secuencial; esta prueba dispara todos los reclamos juntos para verificar que es
 * el bloqueo pesimista de la fila —y no solo la guarda— el que sostiene la regla: exactamente un
 * repartidor gana y en la base queda un único repartidor, en estado LISTO.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class ReclamoPedidoConcurrenteTest {

    private static final String SECRETO = "sanpollo-dev-secret-key-2026-super-segura-256bits-minimo";
    private static final int REPARTIDORES = 6;
    private static final long PRIMER_REPARTIDOR = 800L;

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private OrdenRepository ordenRepository;

    private Long ordenId;

    @AfterEach
    void limpiar() {
        if (ordenId != null) {
            ordenRepository.deleteById(ordenId);
            ordenId = null;
        }
    }

    @Test
    void soloUnRepartidorGanaElReclamoCuandoVariosLoIntentanALaVez() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        ordenId = sembrar(OrdenEstado.LISTO);

        CountDownLatch listos = new CountDownLatch(REPARTIDORES);
        CountDownLatch salida = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(REPARTIDORES);
        List<Long> ganadores = Collections.synchronizedList(new ArrayList<>());
        List<String> conflictos = Collections.synchronizedList(new ArrayList<>());
        List<Throwable> inesperados = Collections.synchronizedList(new ArrayList<>());

        for (int i = 0; i < REPARTIDORES; i++) {
            final long repartidorId = PRIMER_REPARTIDOR + i;
            pool.submit(() -> {
                listos.countDown();
                try {
                    salida.await();                 // todos entran a la vez
                    ResponseEntity<String> r = reclamar(ordenId, tokenDe(repartidorId));
                    if (r.getStatusCode() == HttpStatus.OK) {
                        ganadores.add(repartidorId);
                    } else if (r.getStatusCode() == HttpStatus.CONFLICT) {
                        conflictos.add(r.getBody());
                    } else {
                        inesperados.add(new AssertionError(
                                "el repartidor " + repartidorId + " recibió " + r.getStatusCode()
                                + " en vez de 200 o 409: " + r.getBody()));
                    }
                } catch (Throwable t) {
                    inesperados.add(t);
                }
            });
        }

        assertTrue(listos.await(15, TimeUnit.SECONDS), "los repartidores no arrancaron");
        salida.countDown();
        pool.shutdown();
        assertTrue(pool.awaitTermination(120, TimeUnit.SECONDS), "los repartidores no terminaron");

        assertEquals(List.of(), inesperados,
                "ningún repartidor debe recibir un error distinto de 409 por perder el pedido");

        assertEquals(1, ganadores.size(),
                "solo un repartidor debe ganar el pedido. Ganadores: " + ganadores);
        assertEquals(REPARTIDORES - 1, conflictos.size(),
                "todos los demás deben recibir 409. Conflictos: " + conflictos.size());

        Orden enBase = ordenRepository.findById(ordenId)
                .orElseThrow(() -> new IllegalStateException("la orden " + ordenId + " no existe"));
        assertEquals(ganadores.get(0), enBase.getRepartidorId(),
                "en la base debe quedar el repartidor ganador y ninguno más");
        assertEquals(OrdenEstado.LISTO, enBase.getEstado(),
                "el reclamo concurrente no debe mover el estado a EN_CAMINO");
    }

    // ---------------------------------------------------------------------------------------

    private Long sembrar(OrdenEstado estado) {
        Orden orden = Orden.builder()
                .tipo(OrdenTipo.DELIVERY)
                .canalOrigen(CanalOrigen.WEB)
                .estado(estado)
                .direccionEntrega("Av. Prueba 123")
                .nombreCliente("Cliente Concurrente")
                .telefonoCliente("931000001")
                .build();
        return ordenRepository.save(orden).getId();
    }

    private ResponseEntity<String> reclamar(Long id, String token) {
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.setBearerAuth(token);
        return rest.exchange("/ordenes/" + id + "/reclamo", HttpMethod.POST,
                new HttpEntity<>(cabeceras), String.class);
    }

    private String tokenDe(long userId) {
        SecretKey clave = Keys.hmacShaKeyFor(SECRETO.getBytes(StandardCharsets.UTF_8));
        return Jwts.builder()
                .subject("repartidor" + userId + "@prueba.local")
                .claim("role", "REPARTIDOR")
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
