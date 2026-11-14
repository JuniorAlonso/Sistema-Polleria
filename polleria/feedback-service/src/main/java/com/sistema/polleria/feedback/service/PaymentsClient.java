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

    /**
     * Emite un reembolso en payments-service y retorna el canal de devolución detectado
     * ("MERCADOPAGO" | "VENTANILLA"). Si no se puede detectar, devuelve "VENTANILLA"
     * como valor conservador (requiere entrega manual en caja).
     */
    public String emitirReembolsoPorOrden(Long ordenId, Long reporteId, BigDecimal monto, String motivo, String bearerToken) {
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

            @SuppressWarnings("unchecked")
            Map<String, Object> response = request.body(body).retrieve().body(Map.class);

            String canal = detectarCanal(response);
            log.info("Reembolso emitido para orden #{}, reporte #{}, monto: S/ {}, canal: {}",
                    ordenId, reporteId, monto, canal);
            return canal;

        } catch (Exception e) {
            log.error("Fallo al emitir reembolso en payments-service para orden #{}: {}", ordenId, e.getMessage());
            throw new IllegalStateException("Error al emitir el reembolso en la pasarela/servicio de pagos: " + e.getMessage(), e);
        }
    }

    private static String detectarCanal(Map<String, Object> response) {
        if (response == null) return "VENTANILLA";
        // Intentar leer canalDevolucion si payments-service lo devuelve
        Object canal = response.get("canalDevolucion");
        if (canal instanceof String s && !s.isBlank()) return s.toUpperCase();
        // Inferir desde referenciaPago (D4.6 logic mirror)
        Object ref = response.get("referenciaPago");
        if (ref instanceof String r) {
            if (r.matches("^MP-\\d+$") || r.matches("^\\d+$")) return "MERCADOPAGO";
        }
        return "VENTANILLA";
    }
}
