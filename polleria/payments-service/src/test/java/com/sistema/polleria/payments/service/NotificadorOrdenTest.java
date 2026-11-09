package com.sistema.polleria.payments.service;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * An approved payment (Yape capture verified by the cashier, Mercado Pago, Yape OTP) puts the order
 * in the kitchen QUEUE (RECIBIDO, "por preparar"), so the kitchen starts it. Before it was moved
 * straight to EN_PREPARACION and the kitchen never got to start it.
 */
class NotificadorOrdenTest {

    private HttpServer server;
    private final List<String> cuerpos = new ArrayList<>();
    private final List<String> rutas = new ArrayList<>();
    private final List<String> claves = new ArrayList<>();
    private NotificadorOrden notificador;

    @BeforeEach
    void iniciar() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            rutas.add(exchange.getRequestMethod() + " " + exchange.getRequestURI().getPath());
            claves.add(exchange.getRequestHeaders().getFirst("X-Internal-Key"));
            cuerpos.add(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            exchange.sendResponseHeaders(200, -1);
            exchange.close();
        });
        server.start();
        RestClient cliente = RestClient.builder()
                .baseUrl("http://127.0.0.1:" + server.getAddress().getPort())
                .build();
        notificador = new NotificadorOrden(cliente);
        ReflectionTestUtils.setField(notificador, "ordersInternalKey", "clave-interna");
    }

    @AfterEach
    void detener() {
        server.stop(0);
    }

    @Test
    void elPagoAprobadoMandaElPedidoALaColaDeCocina() {
        notificador.notificarPagoAprobado(77L, "");

        assertThat(rutas).containsExactly("PATCH /ordenes/77/estado");
        assertThat(cuerpos.get(0)).contains("\"estado\":\"RECIBIDO\"");
        assertThat(cuerpos.get(0)).doesNotContain("EN_PREPARACION");
        assertThat(claves.get(0)).isEqualTo("clave-interna");
    }
}
