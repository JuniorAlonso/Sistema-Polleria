package com.sistema.polleria.payments.gateway;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mercadopago.MercadoPagoConfig;
import com.mercadopago.client.payment.PaymentClient;
import com.mercadopago.client.paymentmethod.PaymentMethodClient;
import com.mercadopago.exceptions.MPApiException;
import com.mercadopago.exceptions.MPException;
import com.mercadopago.net.MPResourceList;
import com.mercadopago.resources.paymentmethod.PaymentMethod;
import com.sistema.polleria.payments.dto.IniciarPagoRequest;
import com.sistema.polleria.payments.dto.PreferenceResponse;
import com.sistema.polleria.payments.entity.EstadoPago;
import com.sistema.polleria.payments.entity.MetodoPago;
import com.sistema.polleria.payments.entity.Pago;
import com.sistema.polleria.payments.repository.PagoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class MercadoPagoGateway implements PaymentGateway {

    private final PagoRepository pagoRepository;

    @Value("${mercadopago.webhook.url:}")
    private String webhookUrl;

    @Value("${mercadopago.back-urls.success:http://localhost:4200/checkout/success}")
    private String successUrl;

    @Value("${mercadopago.back-urls.failure:http://localhost:4200/checkout/failure}")
    private String failureUrl;

    @Value("${mercadopago.back-urls.pending:http://localhost:4200/checkout/pending}")
    private String pendingUrl;

    @Value("${mercadopago.sandbox:true}")
    private boolean sandbox;

    @Value("${mercadopago.access-token:}")
    private String accessToken;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public boolean supports(MetodoPago metodoPago) {
        return metodoPago == MetodoPago.TARJETA || metodoPago == MetodoPago.YAPE_PLIN;
    }

    @Override
    @Transactional
    public GatewayResult procesar(IniciarPagoRequest request, Long clienteId) {
        PreferenceResponse pref = crearPreferencia(request, clienteId);
        String redirectUrl = sandbox
                ? (pref.sandboxInitPoint() != null ? pref.sandboxInitPoint() : pref.initPoint())
                : pref.initPoint();

        return new GatewayResult(
                EstadoPago.PENDIENTE,
                pref.preferenceId(),
                "Checkout Pro generado. Redirigir a pasarela Mercado Pago",
                redirectUrl
        );
    }

    @Transactional
    public PreferenceResponse crearPreferencia(IniciarPagoRequest request, Long clienteId) {
        log.info("Creando orden de Mercado Pago Checkout Pro (Orders API) para ordenId={}, clienteId={}, monto={}",
                request.ordenId(), clienteId, request.monto());

        // 1. Obtener o registrar la entidad Pago
        Optional<Pago> pagoExistente = pagoRepository.findByOrdenId(request.ordenId());
        Pago pago;
        if (pagoExistente.isPresent()) {
            pago = pagoExistente.get();
            if (pago.getEstado() == EstadoPago.APROBADO) {
                throw new IllegalStateException("La orden " + request.ordenId() + " ya tiene un pago aprobado.");
            }
            pago.setMonto(request.monto());
            pago.setMetodoPago(request.metodoPago() != null ? request.metodoPago() : MetodoPago.TARJETA);
            pago.setEstado(EstadoPago.PENDIENTE);
        } else {
            pago = new Pago();
            pago.setOrdenId(request.ordenId());
            pago.setClienteId(clienteId);
            pago.setMonto(request.monto());
            pago.setMetodoPago(request.metodoPago() != null ? request.metodoPago() : MetodoPago.TARJETA);
            pago.setEstado(EstadoPago.PENDIENTE);
        }
        pago = pagoRepository.save(pago);

        // 2. URLs de retorno para redirección del cliente
        String safeSuccessUrl = (successUrl != null && !successUrl.isBlank()) ? successUrl : "http://localhost:4200/checkout/success";
        String safeFailureUrl = (failureUrl != null && !failureUrl.isBlank()) ? failureUrl : "http://localhost:4200/checkout/failure";
        String safePendingUrl = (pendingUrl != null && !pendingUrl.isBlank()) ? pendingUrl : "http://localhost:4200/checkout/pending";

        String formattedAmount = String.format(java.util.Locale.US, "%.2f", request.monto());
        String token = (accessToken != null && !accessToken.isBlank())
                ? accessToken
                : MercadoPagoConfig.getAccessToken();

        if (token == null || token.isBlank()) {
            throw new IllegalStateException("Mercado Pago Access Token no configurado en el servidor");
        }

        // 3. Construir el payload JSON para https://api.mercadopago.com/v1/orders
        Map<String, Object> itemMap = Map.of(
                "title", "Pedido #" + request.ordenId() + " - El San Pollo",
                "quantity", 1,
                "unit_price", formattedAmount
        );

        Map<String, Object> onlineConfig = Map.of(
                "success_url", safeSuccessUrl,
                "failure_url", safeFailureUrl,
                "pending_url", safePendingUrl,
                "auto_return", "approved"
        );

        Map<String, Object> orderPayload = new java.util.HashMap<>();
        orderPayload.put("type", "online");
        orderPayload.put("processing_mode", "manual");
        orderPayload.put("total_amount", formattedAmount);
        orderPayload.put("description", "Pedido #" + request.ordenId() + " - El San Pollo");
        orderPayload.put("external_reference", String.valueOf(pago.getId()));
        orderPayload.put("payer", Map.of("email", "cliente" + (clienteId != null ? clienteId : "anonimo") + "@polleria.pe"));
        orderPayload.put("items", List.of(itemMap));
        orderPayload.put("config", Map.of("online", onlineConfig));

        try {
            String jsonBody = objectMapper.writeValueAsString(orderPayload);
            String idempotencyKey = UUID.randomUUID().toString();

            HttpClient httpClient = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(10))
                    .build();

            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.mercadopago.com/v1/orders"))
                    .header("Authorization", "Bearer " + token)
                    .header("X-Idempotency-Key", idempotencyKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 400) {
                log.error("Error API Mercado Pago /v1/orders (status={}): {}", response.statusCode(), response.body());
                throw new RuntimeException("Error en pasarela Mercado Pago (Orders API): " + response.body());
            }

            JsonNode rootNode = objectMapper.readTree(response.body());
            String orderId = rootNode.path("id").asText();
            String checkoutUrl = rootNode.path("checkout_url").asText();

            pago.setReferenciaExterna(orderId);
            pago.setDetalle("Mercado Pago Order generada: " + orderId);
            pago.setCheckoutUrl(checkoutUrl);
            pagoRepository.save(pago);

            log.info("Order Mercado Pago creada con éxito. ID: {}, checkoutUrl: {}", orderId, checkoutUrl);

            return new PreferenceResponse(
                    orderId,
                    checkoutUrl,
                    checkoutUrl,
                    pago.getId(),
                    request.ordenId(),
                    checkoutUrl
            );

        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Llamada a Mercado Pago interrumpida", ie);
        } catch (Exception e) {
            log.error("Excepción al crear orden en Mercado Pago: {}", e.getMessage(), e);
            throw new RuntimeException("Error al conectar con Mercado Pago (Orders API): " + e.getMessage(), e);
        }
    }

    public boolean esPagoMercadoPago(Pago pago) {
        if (pago == null) return false;
        String ref = pago.getReferenciaExterna();
        String detalle = pago.getDetalle();
        // D4.6: ref.contains("-") gave false positives (UUIDs, tickets). Only Mercado Pago patterns:
        // MP-<payment id>, a bare payment id, or an Orders API id (ORD...).
        return (ref != null && (ref.matches("^MP-\\d+$") || ref.matches("^\\d+$") || ref.startsWith("ORD")))
                || (detalle != null && detalle.toLowerCase().contains("mercado pago"));
    }

    public void procesarReembolso(Pago pago, BigDecimal monto) {
        log.info("Procesando reembolso en Mercado Pago para pagoId={}, ordenId={}", pago.getId(), pago.getOrdenId());
        String ref = pago.getReferenciaExterna();
        if (ref == null || ref.isBlank()) {
            log.warn("El pago ID={} no cuenta con referencia de Mercado Pago", pago.getId());
            return;
        }

        Long mpPaymentId = null;
        try {
            if (ref.startsWith("MP-")) {
                mpPaymentId = Long.parseLong(ref.substring(3).trim());
            } else if (ref.matches("^\\d+$")) {
                mpPaymentId = Long.parseLong(ref.trim());
            }
        } catch (NumberFormatException e) {
            log.warn("No se pudo extraer el ID numérico de Mercado Pago de '{}': {}", ref, e.getMessage());
        }

        if (mpPaymentId != null) {
            try {
                PaymentClient client = new PaymentClient();
                if (monto != null) {
                    var refund = client.refund(mpPaymentId, monto);
                    log.info("Reembolso parcial exitoso en Mercado Pago: refundId={}, status={}", refund.getId(), refund.getStatus());
                } else {
                    var refund = client.refund(mpPaymentId);
                    log.info("Reembolso total exitoso en Mercado Pago: refundId={}, status={}", refund.getId(), refund.getStatus());
                }
            } catch (MPApiException apiException) {
                log.error("Error API Mercado Pago al reembolsar (status={}): {}",
                        apiException.getStatusCode(), apiException.getApiResponse().getContent());
                throw new RuntimeException("Error en Mercado Pago al procesar reembolso: " + apiException.getApiResponse().getContent(), apiException);
            } catch (MPException mpException) {
                log.error("Error SDK Mercado Pago al reembolsar: {}", mpException.getMessage());
                throw new RuntimeException("Error al conectar con Mercado Pago para reembolso: " + mpException.getMessage(), mpException);
            }
        } else {
            log.info("Pago ID={} con referencia '{}' registrado para reembolso", pago.getId(), ref);
        }
    }

    public List<PaymentMethod> listarMediosDePago() {
        try {
            PaymentMethodClient client = new PaymentMethodClient();
            MPResourceList<PaymentMethod> response = client.list();
            return response != null && response.getResults() != null ? response.getResults() : List.of();
        } catch (MPApiException apiException) {
            log.error("Error API Mercado Pago al listar medios de pago (status={}): {}",
                    apiException.getStatusCode(), apiException.getApiResponse().getContent());
            throw new RuntimeException("Error en pasarela Mercado Pago al consultar medios de pago: " + apiException.getApiResponse().getContent(), apiException);
        } catch (MPException mpException) {
            log.error("Error SDK Mercado Pago al listar medios de pago: {}", mpException.getMessage());
            throw new RuntimeException("Error al conectar con Mercado Pago para consultar medios de pago: " + mpException.getMessage(), mpException);
        }
    }
}
