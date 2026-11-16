package com.sistema.polleria.orders.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;

/**
 * Timeout-bounded internal client used by orders-service to verify payment state in
 * payments-service before mutating a salon order (e.g., adding extra rounds after payment).
 */
@Slf4j
@Service
public class PagosConsultaClient {

    private final RestClient restClient;
    private final String paymentsServiceUrl;
    private final String internalApiKey;

    @Autowired
    public PagosConsultaClient(
            @Value("${payments.service.url:}") String paymentsServiceUrl,
            @Value("${internal.api-key:}") String internalApiKey) {
        this(crearRestClientPorDefecto(), paymentsServiceUrl, internalApiKey);
    }

    PagosConsultaClient(RestClient restClient, String paymentsServiceUrl, String internalApiKey) {
        this.restClient = restClient;
        this.paymentsServiceUrl = paymentsServiceUrl != null ? paymentsServiceUrl.trim() : "";
        this.internalApiKey = internalApiKey != null ? internalApiKey.trim() : "";
    }

    private static RestClient crearRestClientPorDefecto() {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(Duration.ofSeconds(5));
        return RestClient.builder().requestFactory(factory).build();
    }

    /** Returns the payment status for the order if available, or empty when no payment exists or payments-service is unavailable. */
    public Optional<String> consultarEstadoPago(Long ordenId) {
        if (ordenId == null || paymentsServiceUrl.isEmpty() || internalApiKey.isEmpty()) {
            return Optional.empty();
        }
        try {
            Map<String, Object> body = restClient.get()
                    .uri(paymentsServiceUrl + "/pagos/orden/{ordenId}", ordenId)
                    .header("X-Internal-Key", internalApiKey)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});
            Object estado = body != null ? body.get("estado") : null;
            return estado instanceof String s && !s.isBlank() ? Optional.of(s) : Optional.empty();
        } catch (HttpClientErrorException.NotFound ignored) {
            return Optional.empty();
        } catch (Exception e) {
            log.warn("No se pudo consultar el estado del pago para la orden #{}: {}", ordenId, e.getMessage());
            return Optional.empty();
        }
    }

    public boolean tienePagoAprobado(Long ordenId) {
        return consultarEstadoPago(ordenId)
                .map(estado -> "APROBADO".equals(estado)
                        || "REEMBOLSADO".equals(estado)
                        || "REEMBOLSADO_PARCIAL".equals(estado))
                .orElse(false);
    }
}
