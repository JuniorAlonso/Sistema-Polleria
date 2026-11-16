package com.sistema.polleria.payments.service;

import com.sistema.polleria.payments.entity.MetodoPago;
import com.sistema.polleria.payments.entity.Pago;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.Map;

/**
 * Emits an automatic BOLETA in finance-service whenever an online payment (TARJETA or YAPE_PLIN)
 * is approved, so digital sales appear in the daily balance without touching the cash drawer.
 */
@Slf4j
@Service
public class FinanceComprobanteClient {

    private final RestClient restClient;
    private final String internalKey;
    private final OrdenesClient ordenesClient;

    public FinanceComprobanteClient(
            @Value("${finance.service.url:http://localhost:8087}") String financeUrl,
            @Value("${internal.api-key:}") String internalKey,
            OrdenesClient ordenesClient) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(5));
        this.restClient = RestClient.builder()
                .baseUrl(financeUrl)
                .requestFactory(factory)
                .build();
        this.internalKey = internalKey;
        this.ordenesClient = ordenesClient;
    }

    @Async
    public void emitirBoletaDigitalAsync(Pago pago) {
        if (pago == null || pago.getOrdenId() == null || pago.getMetodoPago() == MetodoPago.CONTRAENTREGA) {
            return;
        }
        if (internalKey == null || internalKey.isBlank()) {
            log.warn("Omitiendo emisión automática de boleta para orden #{}: internal.api-key vacío", pago.getOrdenId());
            return;
        }
        String nombreCliente = "Cliente San Pollo";
        try {
            OrdenesClient.OrdenInfo orden = ordenesClient.obtener(pago.getOrdenId());
            if (orden != null && orden.nombreCliente() != null && !orden.nombreCliente().isBlank()) {
                nombreCliente = orden.nombreCliente().trim();
            }
        } catch (Exception e) {
            log.debug("No se pudo obtener nombre de cliente de orden #{} para boleta automática: {}",
                    pago.getOrdenId(), e.getMessage());
        }

        try {
            Map<String, Object> body = Map.of(
                    "ordenId", pago.getOrdenId(),
                    "tipo", "BOLETA",
                    "clienteNombre", nombreCliente,
                    "pagadoDigitalmente", true,
                    "ingresoCaja", false
            );
            restClient.post()
                    .uri("/finanzas/comprobantes")
                    .header("X-Internal-Key", internalKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            log.info("Boleta digital automática emitida en finance-service para orden #{}", pago.getOrdenId());
        } catch (Exception e) {
            log.warn("No se pudo emitir la boleta automática en finance-service para orden #{}: {}",
                    pago.getOrdenId(), e.getMessage());
        }
    }
}
