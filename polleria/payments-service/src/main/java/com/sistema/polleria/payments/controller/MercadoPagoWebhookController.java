package com.sistema.polleria.payments.controller;

import com.mercadopago.client.payment.PaymentClient;
import com.mercadopago.resources.payment.Payment;
import com.sistema.polleria.payments.dto.ConfirmarPagoRequest;
import com.sistema.polleria.payments.entity.EstadoPago;
import com.sistema.polleria.payments.entity.Pago;
import com.sistema.polleria.payments.repository.PagoRepository;
import com.sistema.polleria.payments.service.PagoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/pagos/webhook")
@RequiredArgsConstructor
public class MercadoPagoWebhookController {

    private final PagoRepository pagoRepository;
    private final PagoService pagoService;

    @Value("${mercadopago.webhook.secret:}")
    private String webhookSecret;

    @Value("${mercadopago.sandbox:true}")
    private boolean sandbox = true;

    @RequestMapping(value = "/mercadopago", method = {RequestMethod.POST, RequestMethod.GET})
    public ResponseEntity<Void> handleWebhook(
            @RequestHeader(value = "x-signature", required = false) String xSignature,
            @RequestHeader(value = "x-request-id", required = false) String xRequestId,
            @RequestParam(value = "type", required = false) String type,
            @RequestParam(value = "topic", required = false) String topic,
            @RequestParam(value = "id", required = false) String paramId,
            @RequestParam(value = "data.id", required = false) String dataId,
            @RequestBody(required = false) Map<String, Object> body) {

        log.info("Webhook recibido de Mercado Pago: type={}, topic={}, id={}, data.id={}",
                type, topic, paramId, dataId);

        String paymentId = resolvePaymentId(type, topic, paramId, dataId, body);

        if (!esFirmaValida(xSignature, xRequestId, paymentId)) {
            log.warn("Firma de webhook inválida. Rechazando solicitud.");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        // 1. Checkout Pro Orders API (type=order): the body is only a notification. Its status and
        // external_reference are not trusted; the payment is re-read from Mercado Pago and must be
        // approved for this pago and its amount (same check as the browser return).
        if (body != null && body.get("data") instanceof Map<?, ?> dataMap
                && dataMap.get("external_reference") != null
                && !dataMap.get("external_reference").toString().isBlank()) {
            String subPaymentId = null;
            if (dataMap.get("transactions") instanceof Map<?, ?> transMap
                    && transMap.get("payments") instanceof java.util.List<?> pList && !pList.isEmpty()
                    && pList.get(0) instanceof Map<?, ?> pFirst
                    && pFirst.get("reference") instanceof Map<?, ?> refMap && refMap.get("id") != null) {
                subPaymentId = String.valueOf(refMap.get("id"));
            } else if (paymentId != null && paymentId.matches("\\d+")) {
                subPaymentId = paymentId;
            }
            if (subPaymentId == null || !subPaymentId.matches("\\d+")) {
                log.warn("Webhook de Order sin id de pago verificable: {}", dataMap.get("id"));
                return ResponseEntity.ok().build();
            }
            try {
                pagoService.procesarRetornoMercadoPago(subPaymentId, null, dataMap.get("external_reference").toString().trim());
                return ResponseEntity.ok().build();
            } catch (IllegalArgumentException | java.util.NoSuchElementException ex) {
                log.warn("Webhook Order con referencia no procesable ({}): {}", dataMap.get("external_reference"), ex.getMessage());
                return ResponseEntity.ok().build();
            } catch (Exception ex) {
                log.error("Error local al procesar webhook de Order (MP reintentará): {}", ex.getMessage(), ex);
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
            }
        }

        try {
            if (paymentId != null && paymentId.matches("\\d+")) {
                String mpAccessToken = com.mercadopago.MercadoPagoConfig.getAccessToken();
                if (sandbox && (mpAccessToken == null || mpAccessToken.isBlank())) {
                    log.warn("Mercado Pago access token no configurado en sandbox; omitiendo consulta de paymentId={}",
                            paymentId);
                    return ResponseEntity.ok().build();
                }
                log.info("Consultando estado de pago en Mercado Pago para paymentId={}", paymentId);
                PaymentClient client = new PaymentClient();
                Payment payment = client.get(Long.parseLong(paymentId));

                log.info("Resultado de Mercado Pago: paymentId={}, status={}, statusDetail={}, externalReference={}",
                        payment.getId(), payment.getStatus(), payment.getStatusDetail(), payment.getExternalReference());

                if (payment.getExternalReference() != null && !payment.getExternalReference().isBlank()) {
                    Long pagoId = Long.parseLong(payment.getExternalReference());
                    var optPago = pagoRepository.findById(pagoId);

                    if (optPago.isPresent()) {
                        Pago pago = optPago.get();
                        String status = payment.getStatus() != null ? payment.getStatus().toLowerCase() : "";
                        aplicarEstadoDePasarela(pago, status, paymentId, payment.getStatusDetail(),
                                payment.getPaymentMethodId());
                    } else {
                        log.warn("No se encontró entidad Pago con ID={}", pagoId);
                    }
                }
            } else {
                log.info("No se identificó paymentId en el webhook recibido (puede ser evento de merchants u otro tipo)");
            }
            return ResponseEntity.ok().build();
        } catch (com.mercadopago.exceptions.MPApiException e) {
            int status = e.getStatusCode();
            if (status == 400 || status == 404) {
                log.warn("Webhook Mercado Pago con recurso inválido/inexistente (paymentId={}, http={}): {}",
                        paymentId, status, e.getMessage());
                return ResponseEntity.ok().build();
            }
            log.error("Error transitorio en API de Mercado Pago (paymentId={}, http={}): {}",
                    paymentId, status, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        } catch (IllegalArgumentException | java.util.NoSuchElementException e) {
            log.warn("Webhook Mercado Pago no procesable (paymentId={}): {}", paymentId, e.getMessage());
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.error("Error local al procesar webhook de Mercado Pago (MP reintentará): {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Applies a Mercado Pago payment status to our pago. A rejected or cancelled attempt does NOT
     * cancel the order (S7): the customer may retry with another card until the payment window
     * ends, and the expiry scheduler cancels it if they never pay. Only a full refund closes the order.
     */
    void aplicarEstadoDePasarela(Pago pago, String status, String paymentId, String statusDetail,
                                 String paymentMethodId) {
        Long pagoId = pago.getId();
        switch (status) {
            case "approved" -> {
                if (pago.getEstado() == EstadoPago.REEMBOLSADO || pago.getEstado() == EstadoPago.REEMBOLSADO_PARCIAL) {
                    log.info("Ignorando webhook 'approved' para pago ID={} ya en estado {}", pagoId, pago.getEstado());
                } else if (pago.getEstado() != EstadoPago.APROBADO) {
                    ConfirmarPagoRequest req = new ConfirmarPagoRequest(
                            "MP-" + paymentId,
                            "Pago aprobado por Mercado Pago (Medio: " + paymentMethodId + ")",
                            null,
                            paymentId
                    );
                    pagoService.confirmar(pagoId, req, "");
                    log.info("Pago ID={} confirmado con éxito vía Webhook de Mercado Pago", pagoId);
                } else {
                    log.info("El pago ID={} ya se encontraba aprobado previamente", pagoId);
                }
            }
            case "partially_refunded" -> {
                pagoService.actualizarEstadoDesdePasarela(pagoId, EstadoPago.REEMBOLSADO_PARCIAL,
                        "Reembolso parcial informado por Mercado Pago (" + statusDetail + ")");
                log.info("Pago ID={} marcado como REEMBOLSADO_PARCIAL por Mercado Pago", pagoId);
            }
            case "rejected" -> {
                pagoService.actualizarEstadoDesdePasarela(pagoId, EstadoPago.RECHAZADO,
                        "Pago rechazado por Mercado Pago: " + statusDetail);
                log.warn("Pago ID={} rechazado por Mercado Pago; la orden {} sigue esperando el pago",
                        pagoId, pago.getOrdenId());
            }
            case "cancelled" -> {
                pagoService.actualizarEstadoDesdePasarela(pagoId, EstadoPago.CANCELADO,
                        "Pago cancelado por Mercado Pago");
                log.warn("Pago ID={} cancelado en Mercado Pago; la orden {} sigue esperando el pago",
                        pagoId, pago.getOrdenId());
            }
            case "refunded" -> {
                pagoService.actualizarEstadoDesdePasarela(pagoId, EstadoPago.REEMBOLSADO,
                        "Pago reembolsado por Mercado Pago");
                pagoService.notificarOrdenEstadoAsync(pago.getOrdenId(), "CANCELADO", "");
                log.info("Pago ID={} marcado como REEMBOLSADO por Mercado Pago y orden {} notificada", pagoId, pago.getOrdenId());
            }
            case "in_process", "pending" -> {
                // Si el pago ya estaba APROBADO, actualizarEstadoDesdePasarela lo ignora:
                // un webhook 'in_process' tardío no debe degradarlo a PENDIENTE.
                pagoService.actualizarEstadoDesdePasarela(pagoId, EstadoPago.PENDIENTE,
                        "Pago en proceso en Mercado Pago (" + statusDetail + ")");
                log.info("Pago ID={} en estado PENDIENTE en Mercado Pago", pagoId);
            }
            default -> log.info("Estado de pago no mapeado: {}", status);
        }
    }

    private String resolvePaymentId(String type, String topic, String paramId, String dataId, Map<String, Object> body) {
        if (dataId != null && !dataId.isBlank()) {
            return dataId;
        }
        if (paramId != null && !paramId.isBlank()) {
            if (type == null && topic == null) {
                return paramId;
            }
            if ("payment".equalsIgnoreCase(type) || "payment".equalsIgnoreCase(topic)) {
                return paramId;
            }
        }
        if (body != null) {
            if (body.containsKey("data")) {
                Object dataObj = body.get("data");
                if (dataObj instanceof Map<?, ?> dataMap && dataMap.get("id") != null) {
                    return String.valueOf(dataMap.get("id"));
                }
            }
            if (body.containsKey("resource")) {
                String resource = String.valueOf(body.get("resource"));
                if (resource.contains("/payments/")) {
                    return resource.substring(resource.lastIndexOf('/') + 1);
                }
            }
            if (body.containsKey("id") && ("payment".equalsIgnoreCase(type) || "payment".equalsIgnoreCase(topic) || "payment.created".equals(body.get("action")) || "payment.updated".equals(body.get("action")))) {
                return String.valueOf(body.get("id"));
            }
        }
        return null;
    }

    private boolean esFirmaValida(String xSignature, String xRequestId, String paymentId) {
        if (webhookSecret == null || webhookSecret.isBlank()) {
            if (!sandbox) {
                log.error("mercadopago.webhook.secret vacío con sandbox=false: webhook rechazado (fail-closed)");
                return false;
            }
            return true; // En sandbox sin secret configurado se acepta
        }
        if (xSignature == null || xSignature.isBlank()) {
            log.warn("Webhook recibido sin cabecera x-signature");
            return false;
        }

        try {
            String ts = null;
            String hashV1 = null;

            for (String part : xSignature.split(",")) {
                String[] kv = part.trim().split("=", 2);
                if (kv.length == 2) {
                    if ("ts".equalsIgnoreCase(kv[0])) ts = kv[1];
                    else if ("v1".equalsIgnoreCase(kv[0])) hashV1 = kv[1];
                }
            }

            if (ts == null || hashV1 == null) {
                log.warn("Formato inválido de cabecera x-signature");
                return false;
            }

            String manifest = "id:" + (paymentId != null ? paymentId : "") + ";request-id:" + (xRequestId != null ? xRequestId : "") + ";ts:" + ts + ";";

            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKeySpec = new SecretKeySpec(webhookSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKeySpec);
            byte[] hmacBytes = mac.doFinal(manifest.getBytes(StandardCharsets.UTF_8));

            StringBuilder hex = new StringBuilder();
            for (byte b : hmacBytes) {
                hex.append(String.format("%02x", b));
            }

            boolean valida = MessageDigest.isEqual(
                    hex.toString().getBytes(StandardCharsets.UTF_8),
                    hashV1.trim().toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8));
            if (!valida) {
                log.warn("Firma HMAC de webhook no coincide");
            }
            return valida;
        } catch (Exception e) {
            log.error("Error al validar firma HMAC: {}", e.getMessage());
            return false;
        }
    }
}
