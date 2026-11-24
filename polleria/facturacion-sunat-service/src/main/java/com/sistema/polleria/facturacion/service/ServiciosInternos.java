package com.sistema.polleria.facturacion.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.net.http.HttpClient;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.NoSuchElementException;

/**
 * Lee comprobante y orden desde finance-service y orders-service reenviando el token del usuario.
 */
@Slf4j
@Component
public class ServiciosInternos {

    private final RestClient finanzas;
    private final RestClient ordenes;

    public ServiciosInternos(@Value("${finance.service.url}") String financeUrl,
                             @Value("${orders.service.url}") String ordersUrl) {
        HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
        JdkClientHttpRequestFactory fabrica = new JdkClientHttpRequestFactory(http);
        fabrica.setReadTimeout(Duration.ofSeconds(8));
        this.finanzas = RestClient.builder().baseUrl(financeUrl).requestFactory(fabrica).build();
        this.ordenes = RestClient.builder().baseUrl(ordersUrl).requestFactory(fabrica).build();
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Comprobante(Long id, Long ordenId, String tipo, String serieCorrelativo,
                              String clienteTipoDoc, String clienteNumDoc, String clienteNombre,
                              String clienteDireccion, BigDecimal total, LocalDateTime emitidoEn,
                              Boolean anulado) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Orden(Long id, BigDecimal total, List<Item> items) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Item(Long productoId, String productoNombre, Integer cantidad, BigDecimal precioUnitario) {
    }

    public Comprobante comprobanteDeOrden(Long ordenId, String bearer) {
        return leer(finanzas, "finance-service", "/finanzas/comprobantes/orden/{id}", ordenId, bearer, Comprobante.class,
                "No hay comprobante emitido para la orden #" + ordenId + ". Primero emite la boleta o factura en caja.");
    }

    public Orden orden(Long ordenId, String bearer) {
        return leer(ordenes, "orders-service", "/ordenes/{id}", ordenId, bearer, Orden.class,
                "Orden no encontrada: " + ordenId);
    }

    private <T> T leer(RestClient cliente, String nombreServicio, String ruta, Long id, String bearer,
                       Class<T> tipo, String mensaje404) {
        try {
            T cuerpo = cliente.get().uri(ruta, id)
                    .headers(h -> {
                        if (bearer != null) {
                            h.set("Authorization", bearer);
                        }
                    })
                    .retrieve()
                    .onStatus(s -> s.value() == 404, (req, res) -> {
                        throw new NoSuchElementException(mensaje404);
                    })
                    .onStatus(s -> s.value() == 401 || s.value() == 403, (req, res) -> {
                        throw new AccesoRechazadoInternoException(res.getStatusCode().value(),
                                "Tu sesión no tiene permisos válidos en " + nombreServicio);
                    })
                    .body(tipo);
            if (cuerpo == null) {
                throw new ServicioNoDisponibleException("Respuesta vacía de " + nombreServicio);
            }
            return cuerpo;
        } catch (NoSuchElementException | AccesoRechazadoInternoException | ServicioNoDisponibleException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Fallo al consultar {} ({}): {}", nombreServicio, id, e.getMessage());
            throw new ServicioNoDisponibleException("No se pudo consultar " + nombreServicio
                    + ". Verifica que esté disponible.");
        }
    }

    public static class ServicioNoDisponibleException extends RuntimeException {
        public ServicioNoDisponibleException(String mensaje) {
            super(mensaje);
        }
    }
}
