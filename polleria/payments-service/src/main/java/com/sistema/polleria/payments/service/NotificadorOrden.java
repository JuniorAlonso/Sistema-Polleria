package com.sistema.polleria.payments.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.HashMap;
import java.util.Map;

/**
 * Notificaciones de cambio de estado hacia orders-service.
 *
 * Vive en su propio bean a propósito: cuando el método {@code @Async} estaba dentro de
 * {@link PagoService}, las llamadas internas (por ejemplo desde {@code confirmar}) no pasaban
 * por el proxy de Spring, así que {@code @Async} se ignoraba y la llamada HTTP corría
 * **sincrónica dentro de la transacción**, reteniendo el bloqueo del pago hasta que el otro
 * servicio respondiera. Ahora toda llamada cruza el proxy y se ejecuta fuera de la transacción.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NotificadorOrden {

    private final RestClient ordersRestClient;

    @Value("${orders.service.internal-key:}")
    private String ordersInternalKey;

    @Async
    public void notificarPagoAprobado(Long ordenId, String bearerToken) {
        notificarEstado(ordenId, "EN_PREPARACION", bearerToken);
    }

    @Async
    public void notificarEstado(Long ordenId, String nuevoEstado, String bearerToken) {
        enviarEstado(ordenId, nuevoEstado, null, bearerToken);
    }

    /**
     * Same as {@link #notificarEstado(Long, String, String)} but also sends the pickup ticket
     * ({@code codigoTicket}), which orders-service requires to mark a RECOJO order ENTREGADO (S7).
     */
    @Async
    public void notificarEstado(Long ordenId, String nuevoEstado, String codigoTicket, String bearerToken) {
        enviarEstado(ordenId, nuevoEstado, codigoTicket, bearerToken);
    }

    private void enviarEstado(Long ordenId, String nuevoEstado, String codigoTicket, String bearerToken) {
        log.info("Notificando a orders-service para orden {} → nuevoEstado={}", ordenId, nuevoEstado);
        if (ordersRestClient == null) {
            return;
        }
        try {
            Map<String, Object> cuerpo = new HashMap<>();
            cuerpo.put("estado", nuevoEstado);
            cuerpo.put("nuevoEstado", nuevoEstado);
            if (codigoTicket != null) {
                cuerpo.put("codigoTicket", codigoTicket);
            }
            var spec = ordersRestClient.patch()
                    .uri("/ordenes/{id}/estado", ordenId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(cuerpo);
            if (ordersInternalKey != null && !ordersInternalKey.isBlank()) {
                spec.header("X-Internal-Key", ordersInternalKey);
            }
            if (bearerToken != null && !bearerToken.isBlank()) {
                spec.header("Authorization",
                        bearerToken.startsWith("Bearer ") ? bearerToken : "Bearer " + bearerToken);
            }
            spec.retrieve().toBodilessEntity();
            log.info("Orden {} actualizada automáticamente a {} en orders-service", ordenId, nuevoEstado);
        } catch (Exception e) {
            log.warn("No se pudo notificar a orders-service para orden {}: {}", ordenId, e.getMessage());
        }
    }
}
