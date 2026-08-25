package com.sistema.polleria.orders.service;

import com.sistema.polleria.orders.entity.Orden;
import com.sistema.polleria.orders.entity.OrdenEstado;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.Map;

@Slf4j
@Service
public class NotificationService {

    private final RestClient restClient;
    private final String notificationUrl;

    public NotificationService(
            @Value("${notification.service.url:http://localhost:3001}") String notificationUrl) {
        this.notificationUrl = notificationUrl;
        this.restClient = RestClient.create();
    }

    @Async
    public void notificarCambioEstado(Orden orden, OrdenEstado nuevoEstado) {
        String telefono = orden.getTelefonoCliente();
        if (telefono == null || telefono.isBlank()) {
            log.debug("Orden #{} sin teléfono, omitiendo notificación WhatsApp", orden.getId());
            return;
        }

        try {
            Map<String, Object> body = Map.of(
                    "telefono", telefono,
                    "orderId", orden.getId(),
                    "estado", nuevoEstado.name(),
                    "nombreCliente", orden.getNombreCliente() != null ? orden.getNombreCliente() : "Cliente"
            );

            restClient.post()
                    .uri(notificationUrl + "/notificar")
                    .header("Content-Type", "application/json")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();

            log.info("WhatsApp notificado — Orden #{} → {}", orden.getId(), nuevoEstado);
        } catch (Exception e) {
            log.warn("No se pudo enviar WhatsApp para orden #{}: {}", orden.getId(), e.getMessage());
        }
    }
}
