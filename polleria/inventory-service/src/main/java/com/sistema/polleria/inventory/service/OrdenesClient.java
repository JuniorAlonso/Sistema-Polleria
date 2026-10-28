package com.sistema.polleria.inventory.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Reads an order from orders-service with {@code X-Internal-Key} (S9). Every failure is
 * {@link OrdenesNoDisponibleException} so callers fail closed.
 */
@Slf4j
@Component
public class OrdenesClient {

    private final RestClient restClient;
    private final String internalKey;

    public OrdenesClient(@Value("${orders.service.url}") String ordersUrl,
                         @Value("${internal.api-key:}") String internalKey) {
        this.restClient = RestClient.builder().baseUrl(ordersUrl).build();
        this.internalKey = internalKey;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Orden(Long id, String estado) {
    }

    public static class OrdenesNoDisponibleException extends RuntimeException {
        public OrdenesNoDisponibleException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    /** Current estado of the order, as orders-service reports it. */
    public String obtenerEstado(Long ordenId) {
        try {
            Orden orden = restClient.get().uri("/ordenes/{id}", ordenId)
                    .headers(h -> {
                        if (internalKey != null && !internalKey.isBlank()) {
                            h.set("X-Internal-Key", internalKey);
                        }
                    })
                    .retrieve()
                    .body(Orden.class);
            if (orden == null || orden.estado() == null) {
                throw new OrdenesNoDisponibleException("orders-service devolvió una respuesta vacía", null);
            }
            return orden.estado();
        } catch (OrdenesNoDisponibleException e) {
            throw e;
        } catch (Exception e) {
            log.warn("No se pudo leer la orden #{} en orders-service: {}", ordenId, e.getMessage());
            throw new OrdenesNoDisponibleException("No se pudo consultar la orden #" + ordenId, e);
        }
    }
}
