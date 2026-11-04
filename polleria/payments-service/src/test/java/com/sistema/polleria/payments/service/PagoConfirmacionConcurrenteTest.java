package com.sistema.polleria.payments.service;

import com.sistema.polleria.payments.dto.ConfirmarPagoRequest;
import com.sistema.polleria.payments.dto.PagoResponse;
import com.sistema.polleria.payments.entity.EstadoPago;
import com.sistema.polleria.payments.entity.MetodoPago;
import com.sistema.polleria.payments.entity.Pago;
import com.sistema.polleria.payments.repository.PagoRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.math.BigDecimal;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * D4 — Mercado Pago reintenta sus webhooks y puede entregar varios a la vez para el mismo
 * pago. La confirmación debe ser idempotente: exactamente una notificación de WhatsApp y un
 * único cambio de estado, aunque lleguen muchos webhooks concurrentes.
 *
 * PagoServiceTest solo cubre la idempotencia secuencial con mocks; esta prueba ejerce la
 * carrera real contra PostgreSQL.
 */
@SpringBootTest
@ActiveProfiles("test")
class PagoConfirmacionConcurrenteTest {

    private static final int WEBHOOKS = 12;

    @Autowired
    private PagoService pagoService;

    @Autowired
    private PagoRepository pagoRepository;

    @MockitoBean
    private WhatsappNotificationClient whatsappNotificationClient;

    private Long pagoId;

    @AfterEach
    void limpiar() {
        if (pagoId != null) {
            pagoRepository.deleteById(pagoId);
        }
    }

    @Test
    void doceWebhooksConcurrentesConfirmanUnaSolaVez() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        Pago pago = new Pago();
        pago.setOrdenId(9001L);
        pago.setClienteId(1L);
        pago.setMonto(new BigDecimal("50.00"));
        pago.setMetodoPago(MetodoPago.YAPE_PLIN);
        pagoId = pagoRepository.save(pago).getId();

        CountDownLatch listos = new CountDownLatch(WEBHOOKS);
        CountDownLatch salida = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(WEBHOOKS);
        List<EstadoPago> respuestas = Collections.synchronizedList(new ArrayList<>());
        List<Throwable> errores = Collections.synchronizedList(new ArrayList<>());

        for (int i = 0; i < WEBHOOKS; i++) {
            pool.submit(() -> {
                listos.countDown();
                try {
                    salida.await();
                    PagoResponse res = pagoService.confirmar(
                            pagoId, new ConfirmarPagoRequest("MP-" + pagoId, "reintento"), "");
                    respuestas.add(res.estado());
                } catch (Throwable t) {
                    errores.add(t);
                }
            });
        }

        assertTrue(listos.await(15, TimeUnit.SECONDS), "los webhooks no arrancaron");
        salida.countDown();
        pool.shutdown();
        assertTrue(pool.awaitTermination(120, TimeUnit.SECONDS), "los webhooks no terminaron");

        assertEquals(List.of(), errores,
                "ningún webhook reintentado debe fallar: la confirmación debe ser idempotente");
        assertEquals(WEBHOOKS, respuestas.size());
        assertTrue(respuestas.stream().allMatch(e -> e == EstadoPago.APROBADO),
                "todas las respuestas deben reportar APROBADO. Obtenido: " + respuestas);

        assertEquals(EstadoPago.APROBADO, pagoRepository.findById(pagoId).orElseThrow().getEstado());
        verify(whatsappNotificationClient, times(1))
                .notificarPagoConfirmado(any(), any(), any());
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
