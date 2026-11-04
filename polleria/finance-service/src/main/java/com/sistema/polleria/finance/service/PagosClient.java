package com.sistema.polleria.finance.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Reads and settles courier cash payments held by payments-service (S6). It forwards the caller's JWT
 * (payments authorizes ADMIN/CAJERO/own REPARTIDOR) and also sends {@code X-Internal-Key}. Every failure
 * other than a 409 is {@link PagosNoDisponibleException} so callers fail closed.
 */
@Slf4j
@Component
public class PagosClient {

    private final RestClient restClient;
    private final String internalKey;

    public PagosClient(@Value("${payments.service.url}") String paymentsUrl,
                       @Value("${internal.api-key:}") String internalKey) {
        this.restClient = RestClient.builder().baseUrl(paymentsUrl).build();
        this.internalKey = internalKey;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record EfectivoPendiente(Long repartidorId, BigDecimal total, int cantidad, List<Item> pagos) {
        @JsonIgnoreProperties(ignoreUnknown = true)
        public record Item(Long pagoId, Long ordenId, BigDecimal monto, LocalDateTime verificadoEn) {
        }
    }

    public record LiquidarRequest(List<Long> pagoIds, Long liquidacionId) {
    }

    public static class PagosNoDisponibleException extends RuntimeException {
        public PagosNoDisponibleException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    public EfectivoPendiente obtenerPendiente(Long repartidorId, LocalDateTime desde, String bearer) {
        try {
            EfectivoPendiente res = restClient.get()
                    .uri(u -> {
                        u.path("/pagos/efectivo/repartidor/{id}");
                        if (desde != null) {
                            u.queryParam("desde", desde.toString());
                        }
                        return u.build(repartidorId);
                    })
                    .headers(h -> aplicarCabeceras(h, bearer))
                    .retrieve()
                    .body(EfectivoPendiente.class);
            if (res == null) {
                throw new PagosNoDisponibleException("payments-service devolvió una respuesta vacía", null);
            }
            return res;
        } catch (PagosNoDisponibleException e) {
            throw e;
        } catch (Exception e) {
            log.warn("No se pudo leer el efectivo pendiente del repartidor {}: {}", repartidorId, e.getMessage());
            throw new PagosNoDisponibleException(
                    "No se pudo calcular el efectivo esperado en este momento. Intenta nuevamente.", e);
        }
    }

    /** Marks the payments as settled; a payment already settled by another liquidation is a 409. */
    public void liquidar(List<Long> pagoIds, Long liquidacionId, String bearer) {
        try {
            restClient.post().uri("/pagos/efectivo/liquidar")
                    .headers(h -> aplicarCabeceras(h, bearer))
                    .body(new LiquidarRequest(pagoIds, liquidacionId))
                    .retrieve()
                    .onStatus(s -> s.value() == 409, (req, res) -> {
                        throw new IllegalStateException(
                                "Alguno de los cobros en efectivo ya fue liquidado en otra liquidación");
                    })
                    .toBodilessEntity();
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            log.warn("No se pudieron marcar los cobros como liquidados (liq #{}): {}", liquidacionId, e.getMessage());
            throw new PagosNoDisponibleException(
                    "No se pudo registrar la liquidación de los cobros en este momento. Intenta nuevamente.", e);
        }
    }

    private void aplicarCabeceras(org.springframework.http.HttpHeaders headers, String bearer) {
        if (bearer != null && !bearer.isBlank()) {
            headers.set("Authorization", bearer);
        }
        if (internalKey != null && !internalKey.isBlank()) {
            headers.set("X-Internal-Key", internalKey);
        }
    }
}
