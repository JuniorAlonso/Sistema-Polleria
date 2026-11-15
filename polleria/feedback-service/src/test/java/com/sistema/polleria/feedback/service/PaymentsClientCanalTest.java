package com.sistema.polleria.feedback.service;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A refund already executed through Mercado Pago must never be classified as VENTANILLA: the
 * claim would then show up for the cashier and the money would be paid out twice.
 */
class PaymentsClientCanalTest {

    private HttpServer server;

    private String canalPara(String respuesta) throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/pagos/orden/", ex -> {
            ex.getRequestBody().readAllBytes();
            byte[] out = respuesta.getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().add("Content-Type", "application/json");
            ex.sendResponseHeaders(200, out.length);
            ex.getResponseBody().write(out);
            ex.close();
        });
        server.start();
        PaymentsClient client = new PaymentsClient("http://127.0.0.1:" + server.getAddress().getPort());
        return client.emitirReembolsoPorOrden(130L, 42L, new BigDecimal("30.00"), "motivo", "Bearer t");
    }

    @AfterEach
    void parar() {
        if (server != null) server.stop(0);
    }

    @Test
    void referenciaExternaDeMercadoPagoEsMercadoPago() throws IOException {
        assertThat(canalPara("{\"referenciaExterna\":\"MP-123456\"}")).isEqualTo("MERCADOPAGO");
        server.stop(0);
        assertThat(canalPara("{\"mpPaymentId\":\"123456\"}")).isEqualTo("MERCADOPAGO");
    }

    @Test
    void referenciaNumericaSinMpPaymentIdEsVentanilla() throws IOException {
        assertThat(canalPara("{\"referenciaExterna\":\"123456\"}")).isEqualTo("VENTANILLA");
    }

    @Test
    void ordenDeOrdersApiEsMercadoPago() throws IOException {
        assertThat(canalPara("{\"referenciaExterna\":\"ORD01JQ4S4KY8HWQ6NA5\"}")).isEqualTo("MERCADOPAGO");
    }

    @Test
    void detalleDeMercadoPagoEsMercadoPago() throws IOException {
        assertThat(canalPara("{\"referenciaExterna\":\"X\",\"detalle\":\"Pago aprobado por Mercado Pago\"}"))
                .isEqualTo("MERCADOPAGO");
    }

    @Test
    void pagoEnEfectivoEsVentanilla() throws IOException {
        assertThat(canalPara("{\"referenciaExterna\":\"EFECTIVO-REP-9\",\"metodoPago\":\"CONTRAENTREGA\"}"))
                .isEqualTo("VENTANILLA");
    }

    @Test
    void elCanalExplicitoDePaymentsManda() throws IOException {
        assertThat(canalPara("{\"canalDevolucion\":\"ventanilla\",\"referenciaExterna\":\"MP-1\"}"))
                .isEqualTo("VENTANILLA");
    }
}
