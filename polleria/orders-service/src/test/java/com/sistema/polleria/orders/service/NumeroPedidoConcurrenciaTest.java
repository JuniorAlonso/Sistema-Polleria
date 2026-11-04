package com.sistema.polleria.orders.service;

import com.sistema.polleria.orders.entity.Orden;
import com.sistema.polleria.orders.entity.OrdenTipo;
import com.sistema.polleria.orders.repository.OrdenRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Connection;
import java.sql.DriverManager;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * D1 — El número de pedido que ve el cliente ("tu pedido N.° 3") debe ser único por cliente.
 *
 * Bajo concurrencia dos mozos pueden tomar un pedido del mismo cliente al mismo tiempo.
 * Sin serialización ambos leen el mismo MAX(numero_cliente) y asignan el MISMO número.
 */
@SpringBootTest
@ActiveProfiles("test")
class NumeroPedidoConcurrenciaTest {

    private static final Long CLIENTE_ID = 4242L;
    private static final int HILOS = 12;

    @Autowired
    private NumeroPedidoService numeroPedidoService;

    @Autowired
    private OrdenRepository ordenRepository;

    @Autowired
    private PlatformTransactionManager txManager;

    @AfterEach
    void limpiar() {
        ordenRepository.deleteAll(ordenRepository.findByClienteIdOrderByCreadoEnDesc(CLIENTE_ID));
    }

    @Test
    void pedidosConcurrentesDelMismoClienteNoRepitenNumero() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        TransactionTemplate tx = new TransactionTemplate(txManager);
        CountDownLatch listos = new CountDownLatch(HILOS);
        CountDownLatch salida = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(HILOS);
        List<Integer> numeros = Collections.synchronizedList(new ArrayList<>());
        List<Throwable> errores = Collections.synchronizedList(new ArrayList<>());

        for (int i = 0; i < HILOS; i++) {
            pool.submit(() -> {
                listos.countDown();
                try {
                    salida.await();                    // todos arrancan a la vez
                    Integer numero = tx.execute(status -> {
                        Orden orden = Orden.builder()
                                .tipo(OrdenTipo.RECOJO)
                                .clienteId(CLIENTE_ID)
                                .build();
                        numeroPedidoService.asignar(orden);
                        ordenRepository.save(orden);
                        return orden.getNumeroCliente();
                    });
                    numeros.add(numero);
                } catch (Throwable t) {
                    errores.add(t);
                }
            });
        }

        assertTrue(listos.await(10, TimeUnit.SECONDS), "los hilos no arrancaron");
        salida.countDown();
        pool.shutdown();
        assertTrue(pool.awaitTermination(90, TimeUnit.SECONDS), "los hilos no terminaron");

        assertEquals(List.of(), errores, "ninguna petición concurrente debe fallar");
        assertEquals(HILOS, numeros.size(), "faltan números asignados");

        Set<Integer> distintos = new HashSet<>(numeros);
        assertEquals(HILOS, distintos.size(),
                "numeroCliente duplicado bajo concurrencia. Valores asignados: " + new TreeSet<>(numeros));
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
