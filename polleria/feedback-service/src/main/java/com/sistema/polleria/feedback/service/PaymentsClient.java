package com.sistema.polleria.feedback.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.Map;

@Slf4j
@Service
public class PaymentsClient {

    private final RestClient restClient;
    private final String paymentsServiceUrl;

    public PaymentsClient(@Value("${payments.service.url:http://localhost:8083}") String paymentsServiceUrl) {
        this.paymentsServiceUrl = paymentsServiceUrl;
        this.restClient = RestClient.create();
    }

    public void emitirReembolsoPorOrden(Long ordenId, Long reporteId, BigDecimal monto, String motivo, String bearerToken) {
        try {
            Map<String, Object> body = Map.of(
                    "monto", monto != null ? monto : BigDecimal.ZERO,
                    "motivo", motivo != null ? motivo : "Reembolso por incidencia aprobada"
            );

            var request = restClient.post()
                    .uri(paymentsServiceUrl + "/pagos/orden/" + ordenId + "/reembolso")
                    .header("Content-Type", "application/json")
                    .header("Idempotency-Key", "RECLAMO-" + ordenId + "-" + (reporteId != null ? reporteId : "0"));

            if (bearerToken != null && !bearerToken.isBlank()) {
                request.header("Authorization", bearerToken.startsWith("Bearer ") ? bearerToken : "Bearer " + bearerToken);
            }

            request.body(body)
                    .retrieve()
                    .toBodilessEntity();

            log.info("Reembolso emitido con éxito en payments-service para orden #{}, reporte #{}, monto: S/ {}",
                    ordenId, reporteId, monto);
        } catch (Exception e) {
            log.error("Fallo crítico al emitir reembolso en payments-service para orden #{}: {}", ordenId, e.getMessage());
            throw new IllegalStateException("Error al emitir el reembolso en la pasarela/servicio de pagos: " + e.getMessage(), e);
        }
    }
}
