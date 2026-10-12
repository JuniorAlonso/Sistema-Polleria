package com.sistema.polleria.orders.service;

import com.sistema.polleria.orders.dto.CrearOrdenRequest;
import com.sistema.polleria.orders.dto.OrdenItemRequest;
import com.sistema.polleria.orders.entity.Mesa;
import com.sistema.polleria.orders.entity.MesaEstado;
import com.sistema.polleria.orders.entity.OrdenEstado;
import com.sistema.polleria.orders.entity.OrdenTipo;
import com.sistema.polleria.orders.exception.ConflictoDeEstadoException;
import com.sistema.polleria.orders.repository.MesaRepository;
import com.sistema.polleria.orders.repository.OrdenRepository;
import com.sistema.polleria.orders.repository.ProductoRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

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
 * D3 — Carrera real: varios mozos abren una comanda en la MISMA mesa al mismo tiempo.
 *
 * `MesaComandaUnicaTest` comprueba la regla de forma secuencial (segundo POST después del
 * primero). Esta prueba dispara todos los POST a la vez para verificar que el bloqueo
 * pesimista sobre la fila de la mesa —y no solo la guarda— es lo que sostiene la regla.
 */
@SpringBootTest
@ActiveProfiles("test")
class MesaComandaUnicaConcurrenteTest {

    private static final int MOZOS = 8;
    private static final List<OrdenEstado> TERMINALES =
            List.of(OrdenEstado.ENTREGADO, OrdenEstado.CANCELADO);

    @Autowired
    private OrdenService ordenService;

    @Autowired
    private MesaRepository mesaRepository;

    @Autowired
    private ProductoRepository productoRepository;

    @Autowired
    private OrdenRepository ordenRepository;

    @AfterEach
    void liberarMesas() {
        mesaRepository.findByEstadoAndActivoTrue(MesaEstado.OCUPADA).forEach(mesa -> {
            mesa.setEstado(MesaEstado.LIBRE);
            mesaRepository.save(mesa);
        });
    }

    @Test
    void soloUnaComandaSobreviveCuandoVariosMozosPidenLaMismaMesaALaVez() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        Mesa mesa = mesaRepository.findByEstadoAndActivoTrue(MesaEstado.LIBRE).stream()
                .findFirst().orElseThrow(() -> new IllegalStateException("no hay mesas libres"));

        OrdenItemRequest item = new OrdenItemRequest();
        item.setProductoId(productoRepository.findByDisponibleTrue().get(0).getId());
        item.setCantidad(1);

        CrearOrdenRequest pedido = new CrearOrdenRequest();
        pedido.setTipo(OrdenTipo.SALON);
        pedido.setMesaId(mesa.getId());
        pedido.setNombreCliente("Mozo Concurrente");
        pedido.setItems(List.of(item));

        CountDownLatch listos = new CountDownLatch(MOZOS);
        CountDownLatch salida = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(MOZOS);
        List<String> resultados = Collections.synchronizedList(new ArrayList<>());
        List<Throwable> inesperados = Collections.synchronizedList(new ArrayList<>());

        for (int i = 0; i < MOZOS; i++) {
            pool.submit(() -> {
                listos.countDown();
                try {
                    salida.await();                 // todos entran a la vez
                    ordenService.crear(pedido, 0L);
                    resultados.add("CREADA");
                } catch (ConflictoDeEstadoException e) {
                    resultados.add("CONFLICTO");
                } catch (Throwable t) {
                    inesperados.add(t);
                }
            });
        }

        assertTrue(listos.await(15, TimeUnit.SECONDS), "los mozos no arrancaron");
        salida.countDown();
        pool.shutdown();
        assertTrue(pool.awaitTermination(120, TimeUnit.SECONDS), "los mozos no terminaron");

        assertEquals(List.of(), inesperados,
                "ningún mozo debe recibir un error distinto de 409 por conflicto");

        long creadas = resultados.stream().filter("CREADA"::equals).count();
        long conflictos = resultados.stream().filter("CONFLICTO"::equals).count();
        assertEquals(1, creadas, "solo una comanda debe crearse. Resultados: " + resultados);
        assertEquals(MOZOS - 1, conflictos, "el resto debe recibir conflicto. Resultados: " + resultados);

        assertEquals(1, ordenRepository.findByMesaIdAndEstadoNotIn(mesa.getId(), TERMINALES).size(),
                "la mesa debe quedar con exactamente una comanda activa");
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
