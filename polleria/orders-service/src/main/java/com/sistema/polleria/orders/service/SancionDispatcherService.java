package com.sistema.polleria.orders.service;

import com.sistema.polleria.orders.entity.Orden;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.HashMap;
import java.util.Map;

/**
 * Notifica a auth-service e incident-service cuando una orden cae en PEDIDO_FANTASMA,
 * para registrar la sanción permanente (bloqueo de ContraPago por IP/Teléfono/Email)
 * y levantar el incidente operativo.
 */
@Slf4j
@Service
public class SancionDispatcherService {

    private final RestClient restClient;
    private final String authServiceUrl;
    private final String incidentServiceUrl;
    private final String internalApiKey;

    public SancionDispatcherService(
            @Value("${auth.service.url:http://localhost:8081}") String authServiceUrl,
            @Value("${incident.service.url:http://localhost:8087}") String incidentServiceUrl,
            @Value("${internal.api-key:}") String internalApiKey) {
        this.authServiceUrl = authServiceUrl;
        this.incidentServiceUrl = incidentServiceUrl;
        this.internalApiKey = internalApiKey;

        var requestFactory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(java.time.Duration.ofSeconds(3));
        requestFactory.setReadTimeout(java.time.Duration.ofSeconds(5));
        this.restClient = RestClient.builder().requestFactory(requestFactory).build();
    }

    /**
     * Consulta sincrónica a auth-service para verificar si un cliente está sancionado para ContraPago.
     */
    public boolean tieneSancionActiva(String telefono, String email, String ip) {
        try {
            StringBuilder sb = new StringBuilder(authServiceUrl).append("/auth/sanciones/verificar?");
            if (telefono != null && !telefono.isBlank()) sb.append("telefono=").append(telefono).append("&");
            if (email != null && !email.isBlank()) sb.append("email=").append(email).append("&");
            if (ip != null && !ip.isBlank()) sb.append("ip=").append(ip);

            Map<String, Object> resp = restClient.get()
                    .uri(sb.toString())
                    .retrieve()
                    .body(new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {});

            if (resp != null && Boolean.TRUE.equals(resp.get("bloqueadoEfectivo"))) {
                return true;
            }
        } catch (Exception e) {
            log.warn("No se pudo verificar sanción con auth-service: {}", e.getMessage());
        }
        return false;
    }

    @Async
    public void registrarSancionPorPedidoFantasma(Orden orden, String motivo) {
        log.warn("Disparando sanción por PEDIDO_FANTASMA para orden #{} (motivo: {})", orden.getId(), motivo);

        // 1. Notificar a auth-service para registrar bloqueo de teléfono/IP/Email
        try {
            Map<String, Object> sancionPayload = new HashMap<>();
            sancionPayload.put("telefono", orden.getTelefonoCliente());
            sancionPayload.put("email", null); // si se tiene en clienteId o DTO se pasa
            sancionPayload.put("ipAddress", orden.getIpOrigen());
            sancionPayload.put("ordenId", orden.getId());
            sancionPayload.put("motivo", "PEDIDO_FANTASMA: " + (motivo != null ? motivo : "No entregado / Abandonado"));
            sancionPayload.put("bloqueadoEfectivo", true);

            var req = restClient.post()
                    .uri(authServiceUrl + "/auth/sanciones")
                    .header("Content-Type", "application/json");
            if (internalApiKey != null && !internalApiKey.isBlank()) {
                req.header("X-Internal-Key", internalApiKey);
            }
            req.body(sancionPayload).retrieve().toBodilessEntity();
            log.info("Sanción registrada exitosamente en auth-service para orden #{}", orden.getId());
        } catch (Exception e) {
            log.warn("No se pudo registrar la sanción en auth-service para orden #{}: {}", orden.getId(), e.getMessage());
        }

        // 2. Notificar a incident-service
        try {
            Map<String, Object> incidentePayload = new HashMap<>();
            incidentePayload.put("titulo", "PEDIDO FANTASMA #" + orden.getId() + " - " + orden.getTipo());
            incidentePayload.put("severidad", "ALTA");
            incidentePayload.put("tipo", "LOGISTICO");
            incidentePayload.put("descripcion", "Pedido #" + orden.getId() + " marcado como PEDIDO_FANTASMA. Motivo: "
                    + motivo + ". Cliente: " + orden.getNombreCliente() + " (" + orden.getTelefonoCliente() + ").");

            var reqInc = restClient.post()
                    .uri(incidentServiceUrl + "/incidentes")
                    .header("Content-Type", "application/json");
            if (internalApiKey != null && !internalApiKey.isBlank()) {
                reqInc.header("X-Internal-Key", internalApiKey);
            }
            reqInc.body(incidentePayload).retrieve().toBodilessEntity();
            log.info("Incidente registrado exitosamente en incident-service para orden #{}", orden.getId());
        } catch (Exception e) {
            log.warn("No se pudo registrar el incidente en incident-service para orden #{}: {}", orden.getId(), e.getMessage());
        }
    }
}
