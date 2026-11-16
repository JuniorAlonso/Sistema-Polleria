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

    /**
     * The paid order enters the kitchen queue (RECIBIDO, "por preparar"): the kitchen starts it.
     * Moving it straight to EN_PREPARACION skipped that step.
     */
    @Async
    public void notificarPagoAprobado(Long ordenId, String bearerToken) {
        notificarEstado(ordenId, "RECIBIDO", bearerToken);
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
        Map<String, Object> cuerpo = new HashMap<>();
        cuerpo.put("estado", nuevoEstado);
        cuerpo.put("nuevoEstado", nuevoEstado);
        if (codigoTicket != null) {
            cuerpo.put("codigoTicket", codigoTicket);
        }
        int maxIntentos = 3;
        for (int intento = 1; intento <= maxIntentos; intento++) {
            try {
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
                return;
            } catch (org.springframework.web.client.HttpClientErrorException e) {
                log.warn("orders-service rechazó actualización ({}) para orden {}: {}",
                        e.getStatusCode(), ordenId, e.getMessage());
                return;
            } catch (Exception e) {
                if (intento == maxIntentos) {
                    log.warn("No se pudo notificar a orders-service para orden {} tras {} intentos: {}",
                            ordenId, maxIntentos, e.getMessage());
                    return;
                }
                log.debug("Reintentando notificación a orders-service para orden {} (intento {}/{}): {}",
                        ordenId, intento, maxIntentos, e.getMessage());
                try {
                    Thread.sleep(150L * intento);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    log.warn("Reintento de notificación interrumpido para orden {}", ordenId);
                    return;
                }
            }
        }
    }
}
