package com.sistema.polleria.feedback.service;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The claim refund egress is idempotent in finance only if it travels with its category and claim. */
class FinanceClientTest {

    private HttpServer server;
    private final AtomicReference<String> cuerpo = new AtomicReference<>();

    private String levantar(int status, String respuesta) throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/finanzas/caja/movimientos", ex -> {
            cuerpo.set(new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] out = respuesta.getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().add("Content-Type", "application/json");
            ex.sendResponseHeaders(status, out.length);
            ex.getResponseBody().write(out);
            ex.close();
        });
        server.start();
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @AfterEach
    void parar() {
        if (server != null) server.stop(0);
    }

    @Test
    void mandaLaDevolucionConSuCategoriaYReclamo() throws IOException {
        FinanceClient client = new FinanceClient(levantar(201, "{\"id\":1}"));

        client.registrarEgresoDevolución(42L, 130L, new BigDecimal("30.00"), "Bearer t");

        assertThat(cuerpo.get())
                .contains("\"categoria\":\"DEVOLUCION\"")
                .contains("\"reclamoId\":42")
                .contains("\"tipo\":\"EGRESO\"");
    }

    @Test
    void unConflictoMuestraElMotivoDeFinanceYNoSiempreCajaCerrada() throws IOException {
        FinanceClient client = new FinanceClient(levantar(409,
                "{\"error\":\"La devolución del reclamo #42 se registró en otra solicitud. Reintenta.\"}"));

        assertThatThrownBy(() -> client.registrarEgresoDevolución(42L, 130L, new BigDecimal("30.00"), "Bearer t"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> {
                    ResponseStatusException rse = (ResponseStatusException) e;
                    assertThat(rse.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(rse.getReason()).contains("reclamo #42");
                });
    }
}
