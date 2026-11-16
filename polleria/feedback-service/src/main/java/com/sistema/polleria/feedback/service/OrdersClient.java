package com.sistema.polleria.feedback.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Map;
import java.util.NoSuchElementException;

@Slf4j
@Service
public class OrdersClient {

    private final RestClient restClient;
    private final String ordersServiceUrl;
    private final String internalApiKey;

    @Autowired
    public OrdersClient(
            @Value("${orders.service.url:http://localhost:8082}") String ordersServiceUrl,
            @Value("${internal.api-key:}") String internalApiKey
    ) {
        this(crearRestClientPorDefecto(), ordersServiceUrl, internalApiKey);
    }

    OrdersClient(RestClient restClient, String ordersServiceUrl, String internalApiKey) {
        this.restClient = restClient;
        this.ordersServiceUrl = ordersServiceUrl;
        this.internalApiKey = internalApiKey;
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
     * Obtiene y valida la orden. Fail-closed: si orders-service no responde, lanza 503
     * en lugar de permitir el reclamo sin validación (Plan 4 fixes).
     */
    public Map<String, Object> obtenerYValidarOrden(Long ordenId, Long clienteId, boolean esAdmin) {
        try {
            var request = restClient.get()
                    .uri(ordersServiceUrl + "/ordenes/" + ordenId);

            if (internalApiKey != null && !internalApiKey.isBlank()) {
                request.header("X-Internal-Key", internalApiKey);
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> orden = request.retrieve().body(Map.class);

            if (orden == null) {
                throw new NoSuchElementException("La orden #" + ordenId + " no existe");
            }

            // Validar pertenencia
            if (!esAdmin && clienteId != null) {
                Object rawClienteId = orden.get("clienteId");
                Long ordenClienteId = rawClienteId instanceof Number n ? n.longValue() : null;
                if (ordenClienteId == null || !ordenClienteId.equals(clienteId)) {
                    throw new AccessDeniedException("No tiene permisos para reclamar una orden que no le pertenece");
                }
            }

            // Validar estado ENTREGADO en reclamos/reseñas iniciados por el cliente
            String estado = (String) orden.get("estado");
            if (!esAdmin && estado != null && !"ENTREGADO".equalsIgnoreCase(estado)) {
                throw new IllegalStateException("Solo se puede reportar una orden con estado ENTREGADO. Estado actual: " + estado);
            }

            return orden;

        } catch (HttpClientErrorException.NotFound e) {
            throw new NoSuchElementException("La orden #" + ordenId + " no existe");
        } catch (HttpClientErrorException.Forbidden | HttpClientErrorException.Unauthorized e) {
            throw new AccessDeniedException("Acceso no autorizado a la orden #" + ordenId);
        } catch (IllegalStateException | AccessDeniedException | NoSuchElementException e) {
            throw e;
        } catch (Exception e) {
            // Fail-closed: si orders-service no responde, rechazar el reclamo con 503
            log.error("No se pudo validar la orden #{} con orders-service: {}", ordenId, e.getMessage());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "El servicio de órdenes no está disponible. Intenta nuevamente en unos minutos.");
        }
    }
}
