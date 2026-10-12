package com.sistema.polleria.payments.service;

import com.sistema.polleria.payments.entity.MetodoPago;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

/**
 * RF30 — Avisa al notification-service que el pago de un pedido DELIVERY fue aprobado.
 * Los datos de contacto (teléfono, nombre) se leen de la orden en orders-service.
 * Corre en segundo plano: si falla, el pago no se ve afectado.
 */
@Slf4j
@Component
public class WhatsappNotificationClient {

    private final RestClient ordersRestClient;
    private final RestClient notificationRestClient;
    private final String internalKey;
    private final String ordersInternalKey;
    private final String tiempoEstimado;

    public WhatsappNotificationClient(
            @Qualifier("ordersRestClient") RestClient ordersRestClient,
            @Value("${notification.service.url:http://localhost:3001}") String notificationUrl,
            @Value("${notification.service.internal-key:}") String internalKey,
            @Value("${orders.service.internal-key:}") String ordersInternalKey,
            @Value("${notification.whatsapp.tiempo-estimado:35-45 min}") String tiempoEstimado) {
        this.ordersRestClient = ordersRestClient;
        this.notificationRestClient = RestClient.builder().baseUrl(notificationUrl).build();
        this.internalKey = internalKey;
        this.ordersInternalKey = ordersInternalKey;
        this.tiempoEstimado = tiempoEstimado;
    }

    @Async
    public void notificarPagoConfirmado(Long ordenId, BigDecimal monto, MetodoPago metodoPago) {
        try {
            Map<String, Object> orden = ordersRestClient.get()
                    .uri("/ordenes/{id}", ordenId)
                    .header("X-Internal-Key", ordersInternalKey)
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});

            if (orden == null || !"DELIVERY".equals(orden.get("tipo"))) {
                return;
            }

            Object telefono = orden.get("telefonoCliente");
            if (telefono == null || telefono.toString().isBlank()) {
                log.debug("Orden #{} sin teléfono, omitiendo WhatsApp de pago", ordenId);
                return;
            }

            Map<String, Object> body = new HashMap<>();
            body.put("ordenId", ordenId);
            body.put("numeroPedido", orden.get("numeroCliente"));
            body.put("telefono", telefono.toString());
            body.put("nombreCliente", orden.getOrDefault("nombreCliente", "Cliente"));
            body.put("montoTotal", monto);
            body.put("metodoPago", metodoPago.name());
            body.put("tiempoEstimado", tiempoEstimado);

            notificationRestClient.post()
                    .uri("/api/notificaciones/whatsapp/pago")
                    .header("Content-Type", "application/json")
                    .header("X-Internal-Key", internalKey)
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();

            log.info("WhatsApp de pago encolado — orden #{}", ordenId);
        } catch (Exception e) {
            log.warn("No se pudo encolar WhatsApp de pago para orden #{}: {}", ordenId, e.getMessage());
        }
    }
}
