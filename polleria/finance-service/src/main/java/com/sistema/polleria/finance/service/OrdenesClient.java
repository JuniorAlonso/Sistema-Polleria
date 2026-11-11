package com.sistema.polleria.finance.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.NoSuchElementException;

/**
 * Read-only access to orders-service (D3.16). {@code GET /ordenes/{id}} already accepts
 * {@code X-Internal-Key}, so orders-service needs no change. Any failure other than a 404 is
 * {@link OrdenesNoDisponibleException} so callers fail closed.
 */
@Slf4j
@Component
public class OrdenesClient {

    private final RestClient restClient;
    private final String internalKey;

    public OrdenesClient(@Value("${orders.service.url}") String ordersUrl,
                         @Value("${internal.api-key:}") String internalKey) {
        this.restClient = RestClient.builder().baseUrl(ordersUrl).requestFactory(TiemposEspera.fabrica()).build();
        this.internalKey = internalKey;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record OrdenTotal(Long id, BigDecimal total) {
    }

    public static class OrdenesNoDisponibleException extends RuntimeException {
        public OrdenesNoDisponibleException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    public BigDecimal obtenerTotal(Long ordenId) {
        try {
            OrdenTotal orden = restClient.get().uri("/ordenes/{id}", ordenId)
                    .headers(h -> {
                        if (internalKey != null && !internalKey.isBlank()) {
                            h.set("X-Internal-Key", internalKey);
                        }
                    })
                    .retrieve()
                    .onStatus(s -> s.value() == 404, (req, res) -> {
                        throw new NoSuchElementException("Orden no encontrada: " + ordenId);
                    })
                    .body(OrdenTotal.class);
            if (orden == null || orden.total() == null) {
                throw new OrdenesNoDisponibleException("orders-service no devolvió el total de la orden " + ordenId, null);
            }
            return orden.total();
        } catch (NoSuchElementException | OrdenesNoDisponibleException e) {
            throw e;
        } catch (Exception e) {
            log.warn("No se pudo leer la orden {} de orders-service: {}", ordenId, e.getMessage());
            throw new OrdenesNoDisponibleException(
                    "No se pudo verificar la orden " + ordenId + " en este momento. Intenta nuevamente.", e);
        }
    }
}
