package com.sistema.polleria.payments.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.NoSuchElementException;

/**
 * Read-only view of an order held by orders-service. Used by payments-service to check business
 * rules that depend on the order (total, state, type, owner, creation time) instead of trusting
 * what the caller sends.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OrdenesClient {

    private final RestClient ordersRestClient;

    @Value("${orders.service.internal-key:}")
    private String ordersInternalKey;

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record OrdenInfo(
            Long id,
            String estado,
            String tipo,
            BigDecimal total,
            Long clienteId,
            LocalDateTime creadoEn) {
    }

    /** Thrown when the order cannot be read (network error, 5xx, unparsable body). */
    public static class OrdenNoDisponibleException extends RuntimeException {
        public OrdenNoDisponibleException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    /**
     * Fetches the order. 404 becomes {@link NoSuchElementException}; any other failure becomes
     * {@link OrdenNoDisponibleException} so callers can fail closed.
     */
    public OrdenInfo obtener(Long ordenId) {
        try {
            var spec = ordersRestClient.get().uri("/ordenes/{id}", ordenId);
            if (ordersInternalKey != null && !ordersInternalKey.isBlank()) {
                spec.header("X-Internal-Key", ordersInternalKey);
            }
            OrdenInfo orden = spec.retrieve()
                    .onStatus(s -> s.value() == 404, (req, res) -> {
                        throw new NoSuchElementException("Orden no encontrada: " + ordenId);
                    })
                    .body(OrdenInfo.class);
            if (orden == null) {
                throw new OrdenNoDisponibleException(
                        "orders-service devolvió una respuesta vacía para la orden " + ordenId, null);
            }
            return orden;
        } catch (NoSuchElementException | OrdenNoDisponibleException e) {
            throw e;
        } catch (Exception e) {
            log.warn("No se pudo leer la orden {} de orders-service: {}", ordenId, e.getMessage());
            throw new OrdenNoDisponibleException(
                    "No se pudo verificar la orden " + ordenId + " en este momento. Intenta nuevamente.", e);
        }
    }
}
