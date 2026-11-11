package com.sistema.polleria.finance.service;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.NoSuchElementException;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** HTTP contract of the reads that feed the receipt total (D3.15, D3.16), against a local stub server. */
class ClientesHttpComprobanteTest {

    private HttpServer server;
    private String baseUrl;
    private final AtomicReference<String> claveRecibida = new AtomicReference<>();
    private final AtomicReference<String> bearerRecibido = new AtomicReference<>();

    @BeforeEach
    void iniciar() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/pagos/orden/1", ex -> responder(ex, 200,
                "{\"id\":5,\"ordenId\":1,\"monto\":64.50,\"estado\":\"APROBADO\",\"metodoPago\":\"EFECTIVO\"}"));
        server.createContext("/pagos/orden/2", ex -> responder(ex, 404, "{\"error\":\"No hay pago\"}"));
        server.createContext("/ordenes/3", ex -> responder(ex, 200, "{\"id\":3,\"total\":82.00,\"estado\":\"RECIBIDO\"}"));
        server.createContext("/ordenes/4", ex -> responder(ex, 404, "{\"error\":\"Orden no encontrada\"}"));
        server.start();
        baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @AfterEach
    void detener() {
        server.stop(0);
    }

    private void responder(com.sun.net.httpserver.HttpExchange ex, int status, String body) throws IOException {
        claveRecibida.set(ex.getRequestHeaders().getFirst("X-Internal-Key"));
        bearerRecibido.set(ex.getRequestHeaders().getFirst("Authorization"));
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().add("Content-Type", "application/json");
        ex.sendResponseHeaders(status, bytes.length);
        ex.getResponseBody().write(bytes);
        ex.close();
    }

    @Test
    void pagoDeOrdenReenviaElJwtYLeeMontoYEstado() {
        var pago = new PagosClient(baseUrl, "k").obtenerPagoDeOrden(1L, "Bearer cajero");

        assertThat(pago).isPresent();
        assertThat(pago.get().monto()).isEqualByComparingTo("64.50");
        assertThat(pago.get().estado()).isEqualTo("APROBADO");
        assertThat(bearerRecibido.get()).isEqualTo("Bearer cajero");
    }

    @Test
    void ordenSinPagoDevuelveVacio() {
        assertThat(new PagosClient(baseUrl, "k").obtenerPagoDeOrden(2L, "Bearer cajero")).isEmpty();
    }

    @Test
    void paymentsInalcanzableFallaCerrado() {
        assertThatThrownBy(() -> new PagosClient("http://localhost:1", "k").obtenerPagoDeOrden(1L, "Bearer t"))
                .isInstanceOf(PagosClient.PagosNoDisponibleException.class);
    }

    @Test
    void totalDeOrdenUsaLaClaveInterna() {
        assertThat(new OrdenesClient(baseUrl, "clave-interna").obtenerTotal(3L)).isEqualByComparingTo("82.00");
        assertThat(claveRecibida.get()).isEqualTo("clave-interna");
    }

    @Test
    void ordenInexistenteEsNoEncontrada() {
        assertThatThrownBy(() -> new OrdenesClient(baseUrl, "k").obtenerTotal(4L))
                .isInstanceOf(NoSuchElementException.class);
    }

    @Test
    void ordersInalcanzableFallaCerrado() {
        assertThatThrownBy(() -> new OrdenesClient("http://localhost:1", "k").obtenerTotal(3L))
                .isInstanceOf(OrdenesClient.OrdenesNoDisponibleException.class);
    }
}
