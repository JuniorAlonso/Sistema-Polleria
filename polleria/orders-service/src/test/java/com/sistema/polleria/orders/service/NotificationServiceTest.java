package com.sistema.polleria.orders.service;

import com.sistema.polleria.orders.entity.Orden;
import com.sistema.polleria.orders.entity.OrdenEstado;
import com.sistema.polleria.orders.entity.OrdenTipo;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The customer's WhatsApp hears about the order states that change what they must do. A local
 * HTTP server stands in for notification-service; the method is called directly (no Spring
 * proxy), so the @Async call runs synchronously.
 */
class NotificationServiceTest {

    private HttpServer servidor;
    private final List<String> cuerpos = new CopyOnWriteArrayList<>();
    private NotificationService service;

    @BeforeEach
    void iniciar() throws IOException {
        servidor = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        servidor.createContext("/api/notificaciones/whatsapp/estado", intercambio -> {
            cuerpos.add(new String(intercambio.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            intercambio.sendResponseHeaders(202, -1);
            intercambio.close();
        });
        servidor.start();
        service = new NotificationService("http://127.0.0.1:" + servidor.getAddress().getPort(), "clave");
    }

    @AfterEach
    void detener() {
        servidor.stop(0);
    }

    private Orden orden(OrdenTipo tipo) {
        return Orden.builder().id(40L).numeroCliente(3).tipo(tipo)
                .telefonoCliente("999888777").nombreCliente("Ana").build();
    }

    @Test
    void elPedidoFantasmaDeDeliverySeAvisaAlCliente() {
        service.notificarCambioEstado(orden(OrdenTipo.DELIVERY), OrdenEstado.PEDIDO_FANTASMA);

        assertEquals(1, cuerpos.size());
        assertTrue(cuerpos.get(0).contains("\"estadoNuevo\":\"PEDIDO_FANTASMA\""), cuerpos.get(0));
    }

    @Test
    void elPedidoFantasmaDeRecojoSeAvisaAlCliente() {
        service.notificarCambioEstado(orden(OrdenTipo.RECOJO), OrdenEstado.PEDIDO_FANTASMA);

        assertEquals(1, cuerpos.size());
        assertTrue(cuerpos.get(0).contains("\"ordenId\":40"), cuerpos.get(0));
    }

    @Test
    void preservaQueUnEstadoNoNotificableNoSeEnvia() {
        service.notificarCambioEstado(orden(OrdenTipo.DELIVERY), OrdenEstado.LISTO);
        service.notificarCambioEstado(orden(OrdenTipo.RECOJO), OrdenEstado.EN_CAMINO);

        assertEquals(0, cuerpos.size());
    }

    @Test
    void preservaElAvisoDeCancelado() {
        service.notificarCambioEstado(orden(OrdenTipo.DELIVERY), OrdenEstado.CANCELADO);

        assertEquals(1, cuerpos.size());
    }
}
