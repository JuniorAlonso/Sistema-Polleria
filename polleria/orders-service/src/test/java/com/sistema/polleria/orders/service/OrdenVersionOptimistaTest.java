package com.sistema.polleria.orders.service;

import com.sistema.polleria.orders.entity.Orden;
import com.sistema.polleria.orders.entity.OrdenEstado;
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
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * D2 — Dos cambios de estado simultáneos sobre la MISMA orden no deben pisarse.
 *
 * {@code OrdenService.actualizarEstado} hacía leer→validar→escribir sin control de versión:
 * dos peticiones que leían el mismo estado pasaban ambas la validación y la última en
 * confirmar borraba el cambio de la otra (actualización perdida). La entidad {@link Orden}
 * ahora lleva {@code @Version}, así que la segunda transacción recibe un conflicto.
 *
 * La intercalación es determinista (no depende del azar del planificador): ambas
 * transacciones leen la orden y quedan esperando en un pestillo antes de escribir.
 */
@SpringBootTest
@ActiveProfiles("test")
class OrdenVersionOptimistaTest {

    @Autowired
    private OrdenRepository ordenRepository;

    @Autowired
    private PlatformTransactionManager txManager;

    private Long ordenId;

    @AfterEach
    void limpiar() {
        if (ordenId != null) {
            ordenRepository.deleteById(ordenId);
        }
    }

    @Test
    void dosTransaccionesQueModificanLaMismaOrdenNoSePisan() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        ordenId = ordenRepository.saveAndFlush(Orden.builder()
                .tipo(OrdenTipo.RECOJO)
                .build()).getId();

        TransactionTemplate tx = new TransactionTemplate(txManager);
        CountDownLatch ambasLeyeron = new CountDownLatch(2);
        CountDownLatch salida = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);

        Callable<String> intentoDeCambio = () -> {
            try {
                return tx.execute(status -> {
                    Orden orden = ordenRepository.findById(ordenId).orElseThrow();
                    orden.setEstado(OrdenEstado.EN_PREPARACION);

                    ambasLeyeron.countDown();      // ambas ya leyeron la misma version
                    esperar(salida);               // y escriben a la vez

                    ordenRepository.saveAndFlush(orden);
                    return "CONFIRMADO";
                });
            } catch (Exception e) {
                return "CONFLICTO";
            }
        };

        List<Future<String>> futuros = new ArrayList<>();
        futuros.add(pool.submit(intentoDeCambio));
        futuros.add(pool.submit(intentoDeCambio));

        assertTrue(ambasLeyeron.await(20, TimeUnit.SECONDS), "las transacciones no llegaron a leer");
        salida.countDown();
        pool.shutdown();
        assertTrue(pool.awaitTermination(90, TimeUnit.SECONDS), "las transacciones no terminaron");

        List<String> resultados = new ArrayList<>();
        for (Future<String> f : futuros) {
            resultados.add(f.get());
        }

        assertEquals(1, Collections.frequency(resultados, "CONFIRMADO"),
                "exactamente una transacción debe confirmar. Resultados: " + resultados);
        assertEquals(1, Collections.frequency(resultados, "CONFLICTO"),
                "la otra debe recibir conflicto de versión en lugar de sobrescribir. Resultados: " + resultados);
    }

    private static void esperar(CountDownLatch pestillo) {
        try {
            if (!pestillo.await(20, TimeUnit.SECONDS)) {
                throw new IllegalStateException("tiempo de espera agotado");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
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
