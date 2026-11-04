package com.sistema.polleria.payments.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sistema.polleria.payments.entity.MetodoPago;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * T3 (S2) — Los avisos de pago aprobado y de comprobante rechazado llegan también a los pedidos
 * RECOJO por WhatsApp, no solo a DELIVERY; los pedidos de SALON siguen sin aviso. Se ejerce el
 * cliente contra un servidor HTTP falso que hace de orders-service y de notification-service.
 */
class WhatsappNotificationClientTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final AtomicReference<String> ordenJson = new AtomicReference<>();
    private final List<String> rutas = new CopyOnWriteArrayList<>();
    private final List<JsonNode> cuerpos = new CopyOnWriteArrayList<>();
    private HttpServer server;
    private WhatsappNotificationClient client;

    @BeforeEach
    void iniciar() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/ordenes/", ex -> {
            byte[] body = ordenJson.get().getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().add("Content-Type", "application/json");
            ex.sendResponseHeaders(200, body.length);
            ex.getResponseBody().write(body);
            ex.close();
        });
        server.createContext("/api/notificaciones/", ex -> {
            rutas.add(ex.getRequestURI().getPath());
            cuerpos.add(mapper.readTree(ex.getRequestBody()));
            ex.sendResponseHeaders(202, -1);
            ex.close();
        });
        server.start();
        String base = "http://127.0.0.1:" + server.getAddress().getPort();
        client = new WhatsappNotificationClient(
                RestClient.builder().baseUrl(base).build(), base, "clave-noti", "clave-ordenes", "35-45 min");
    }

    @AfterEach
    void detener() {
        server.stop(0);
    }

    private void orden(String tipo, String telefono) throws IOException {
        ordenJson.set(mapper.writeValueAsString(telefono == null
                ? Map.of("id", 81, "tipo", tipo, "numeroCliente", 5, "nombreCliente", "Ana")
                : Map.of("id", 81, "tipo", tipo, "numeroCliente", 5, "nombreCliente", "Ana",
                        "telefonoCliente", telefono)));
    }

    @Test
    @DisplayName("T3: un pedido RECOJO recibe el aviso de pago aprobado")
    void pagoConfirmado_recojo_avisa() throws IOException {
        orden("RECOJO", "51987654321");

        client.notificarPagoConfirmado(81L, new BigDecimal("45.50"), MetodoPago.YAPE_PLIN);

        assertThat(rutas).containsExactly("/api/notificaciones/whatsapp/pago");
        JsonNode body = cuerpos.get(0);
        assertThat(body.get("ordenId").asLong()).isEqualTo(81L);
        assertThat(body.get("telefono").asText()).isEqualTo("51987654321");
        assertThat(body.get("montoTotal").decimalValue()).isEqualByComparingTo("45.50");
        assertThat(body.get("numeroPedido").asInt()).isEqualTo(5);
        assertThat(body.has("tiempoEstimado")).isFalse();
    }

    @Test
    @DisplayName("T3: un pedido RECOJO recibe el aviso de comprobante rechazado")
    void comprobanteRechazado_recojo_avisa() throws IOException {
        orden("RECOJO", "51987654321");

        client.notificarComprobanteRechazado(81L, "Captura ilegible");

        assertThat(rutas).containsExactly("/api/notificaciones/whatsapp/comprobante-rechazado");
        assertThat(cuerpos.get(0).get("motivo").asText()).isEqualTo("Captura ilegible");
        assertThat(cuerpos.get(0).get("telefono").asText()).isEqualTo("51987654321");
    }

    @Test
    @DisplayName("PRESERVE T3: un pedido DELIVERY sigue recibiendo ambos avisos")
    void delivery_sigueAvisando() throws IOException {
        orden("DELIVERY", "51987654321");

        client.notificarPagoConfirmado(81L, new BigDecimal("45.50"), MetodoPago.YAPE_PLIN);
        client.notificarComprobanteRechazado(81L, "Monto incorrecto");

        assertThat(rutas).containsExactly(
                "/api/notificaciones/whatsapp/pago", "/api/notificaciones/whatsapp/comprobante-rechazado");
        assertThat(cuerpos.get(0).get("tiempoEstimado").asText()).isEqualTo("35-45 min");
    }

    @Test
    @DisplayName("PRESERVE T3: un pedido de SALON no recibe avisos por WhatsApp")
    void salon_noAvisa() throws IOException {
        orden("SALON", "51987654321");

        client.notificarPagoConfirmado(81L, new BigDecimal("45.50"), MetodoPago.YAPE_PLIN);
        client.notificarComprobanteRechazado(81L, "Monto incorrecto");

        assertThat(rutas).isEmpty();
    }

    @Test
    @DisplayName("PRESERVE T3: un pedido RECOJO sin teléfono no recibe avisos")
    void recojoSinTelefono_noAvisa() throws IOException {
        orden("RECOJO", null);

        client.notificarPagoConfirmado(81L, new BigDecimal("45.50"), MetodoPago.YAPE_PLIN);
        client.notificarComprobanteRechazado(81L, "Monto incorrecto");

        assertThat(rutas).isEmpty();
    }
}
