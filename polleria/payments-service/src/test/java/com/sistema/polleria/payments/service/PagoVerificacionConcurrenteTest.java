package com.sistema.polleria.payments.service;

import com.sistema.polleria.payments.dto.PagoResponse;
import com.sistema.polleria.payments.dto.VerificarPagoRequest;
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
import java.time.LocalDateTime;
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
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * S14 (B6) — Two cashiers approving the same Yape capture at the same time must produce exactly one
 * APROBADO and one rejection; the order advances once. Exercises the real pessimistic lock against
 * PostgreSQL, following {@link PagoConfirmacionConcurrenteTest}.
 */
@SpringBootTest
@ActiveProfiles("test")
class PagoVerificacionConcurrenteTest {

    private static final int CAJEROS = 2;

    @Autowired
    private PagoService pagoService;

    @Autowired
    private PagoRepository pagoRepository;

    @MockitoBean
    private WhatsappNotificationClient whatsappNotificationClient;

    @MockitoBean
    private NotificadorOrden notificadorOrden;

    @MockitoBean
    private OrdenesClient ordenesClient;

    private Long pagoId;

    @AfterEach
    void limpiar() {
        if (pagoId != null) {
            pagoRepository.deleteById(pagoId);
        }
    }

    @Test
    void dosAprobacionesConcurrentesDejanUnSoloAprobado() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433 (levanta el stack Docker)");

        long ordenId = 979201L;
        when(ordenesClient.obtener(anyLong())).thenReturn(new OrdenesClient.OrdenInfo(
                ordenId, "PENDIENTE_PAGO", "DELIVERY", new BigDecimal("45.50"), null, LocalDateTime.now()));

        Pago pago = new Pago();
        pago.setOrdenId(ordenId);
        pago.setClienteId(0L);
        pago.setMonto(new BigDecimal("45.50"));
        pago.setMetodoPago(MetodoPago.YAPE_PLIN);
        pago.setEstado(EstadoPago.PENDIENTE_VERIFICACION);
        pago.setComprobanteClave("comprobantes/yape/979201/concurrente.jpg");
        pagoId = pagoRepository.saveAndFlush(pago).getId();

        CountDownLatch listos = new CountDownLatch(CAJEROS);
        CountDownLatch salida = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(CAJEROS);
        List<EstadoPago> aprobados = Collections.synchronizedList(new ArrayList<>());
        List<Throwable> rechazos = Collections.synchronizedList(new ArrayList<>());

        for (int i = 0; i < CAJEROS; i++) {
            String cajero = "cajero" + i + "@prueba.local";
            pool.submit(() -> {
                listos.countDown();
                try {
                    salida.await();
                    PagoResponse res = pagoService.verificar(
                            pagoId, new VerificarPagoRequest(true, null), cajero, "Bearer t");
                    aprobados.add(res.estado());
                } catch (Throwable t) {
                    rechazos.add(t);
                }
            });
        }

        assertTrue(listos.await(15, TimeUnit.SECONDS), "los cajeros no arrancaron");
        salida.countDown();
        pool.shutdown();
        assertTrue(pool.awaitTermination(60, TimeUnit.SECONDS), "las aprobaciones no terminaron");

        assertEquals(List.of(EstadoPago.APROBADO), aprobados, "exactamente una aprobación debe ganar");
        assertEquals(1, rechazos.size(), "la otra aprobación debe rechazarse. Obtenido: " + rechazos);
        assertTrue(rechazos.get(0) instanceof IllegalStateException,
                "el perdedor recibe 409 (IllegalStateException). Obtenido: " + rechazos.get(0));

        assertEquals(EstadoPago.APROBADO, pagoRepository.findById(pagoId).orElseThrow().getEstado());
        verify(notificadorOrden, times(1)).notificarPagoAprobado(any(), any());
        verify(whatsappNotificationClient, times(1)).notificarPagoConfirmado(any(), any(), any());
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
