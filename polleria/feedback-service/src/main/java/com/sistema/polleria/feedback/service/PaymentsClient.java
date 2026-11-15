package com.sistema.polleria.feedback.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Map;

@Slf4j
@Service
public class PaymentsClient {

    private final RestClient restClient;
    private final String paymentsServiceUrl;

    @Autowired
    public PaymentsClient(@Value("${payments.service.url:http://localhost:8083}") String paymentsServiceUrl) {
        this(crearRestClientPorDefecto(), paymentsServiceUrl);
    }

    PaymentsClient(RestClient restClient, String paymentsServiceUrl) {
        this.restClient = restClient;
        this.paymentsServiceUrl = paymentsServiceUrl;
    }

    private static RestClient crearRestClientPorDefecto() {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(Duration.ofSeconds(5));
        return RestClient.builder().requestFactory(requestFactory).build();
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

    static String detectarCanal(Map<String, Object> response) {
        if (response == null) return "VENTANILLA";
        Object canal = response.get("canalDevolucion");
        if (canal instanceof String s && !s.isBlank()) return s.toUpperCase();
        Object metodo = response.get("metodoPago");
        if (metodo instanceof String m && "CONTRAENTREGA".equalsIgnoreCase(m.trim())) {
            return "VENTANILLA";
        }
        // DIN-11: usar el ID verificado de Mercado Pago; nunca tratar una referencia numérica libre de cajero como MP.
        Object mpPaymentId = response.get("mpPaymentId");
        if (mpPaymentId != null && mpPaymentId.toString().trim().matches("^\\d+$")) {
            return "MERCADOPAGO";
        }
        Object ref = response.get("referenciaExterna") != null ? response.get("referenciaExterna") : response.get("referenciaPago");
        if (ref instanceof String r && (r.matches("^MP-\\d+$") || r.startsWith("ORD"))) {
            return "MERCADOPAGO";
        }
        Object detalle = response.get("detalle");
        if (detalle instanceof String d && d.toLowerCase().contains("mercado pago")) {
            return "MERCADOPAGO";
        }
        return "VENTANILLA";
    }
}
