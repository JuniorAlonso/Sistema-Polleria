package com.sistema.polleria.feedback.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Map;

@Slf4j
@Service
public class FinanceClient {

    private final RestClient restClient;
    private final String financeServiceUrl;

    public FinanceClient(@Value("${finance.service.url:http://localhost:8087}") String financeServiceUrl) {
        this.financeServiceUrl = financeServiceUrl;
        this.restClient = RestClient.create();
    }

    /**
     * Registra un egreso de caja por devolución en ventanilla (Plan 4, flujo 4.4 paso 4).
     * El JWT del cajero viaja como Bearer para que finance-service valide el rol.
     */
    public void registrarEgresoDevolución(Long reporteId, Long ordenId, BigDecimal monto, String bearerToken) {
        String motivo = "DEVOLUCION-RECLAMO #" + reporteId + " ORDEN #" + ordenId;
        // DEVOLUCION + reclamoId lets finance register the egress once per claim: a retry gets the
        // stored egress back instead of taking the cash out of the drawer twice.
        Map<String, Object> body = Map.of(
                "tipo", "EGRESO",
                "monto", monto,
                "motivo", motivo,
                "categoria", "DEVOLUCION",
                "reclamoId", reporteId
        );

        try {
            var req = restClient.post()
                    .uri(financeServiceUrl + "/finanzas/caja/movimientos")
                    .header("Content-Type", "application/json");

            if (bearerToken != null && !bearerToken.isBlank()) {
                req.header("Authorization", bearerToken.startsWith("Bearer ") ? bearerToken : "Bearer " + bearerToken);
            }

            req.body(body).retrieve().toBodilessEntity();
            log.info("Egreso de caja registrado: {}", motivo);

        } catch (org.springframework.web.client.HttpClientErrorException.Conflict e) {
            // 409 from finance: closed register or a simultaneous registration of the same claim.
            // Its own message says which one.
            throw new ResponseStatusException(HttpStatus.CONFLICT, motivoDeFinance(e.getResponseBodyAsString()));
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error al registrar egreso de caja para reclamo #{}: {}", reporteId, e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "No se pudo registrar el movimiento de caja: " + e.getMessage());
        }
    }

    private static String motivoDeFinance(String cuerpo) {
        String porDefecto = "No se pudo registrar la devolución en caja. Verifica que la caja esté abierta.";
        if (cuerpo == null || cuerpo.isBlank()) return porDefecto;
        try {
            Object error = new com.fasterxml.jackson.databind.ObjectMapper().readValue(cuerpo, Map.class).get("error");
            return error != null ? error.toString() : porDefecto;
        } catch (Exception e) {
            return porDefecto;
        }
    }
}
