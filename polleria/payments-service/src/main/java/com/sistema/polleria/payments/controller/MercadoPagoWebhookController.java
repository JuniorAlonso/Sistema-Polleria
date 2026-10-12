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

    @RequestMapping(value = "/mercadopago", method = {RequestMethod.POST, RequestMethod.GET})
    public ResponseEntity<Void> handleWebhook(
            @RequestHeader(value = "x-signature", required = false) String xSignature,
            @RequestHeader(value = "x-request-id", required = false) String xRequestId,
            @RequestParam(value = "type", required = false) String type,
            @RequestParam(value = "topic", required = false) String topic,
            @RequestParam(value = "id", required = false) String paramId,
            @RequestParam(value = "data.id", required = false) String dataId,
            @RequestBody(required = false) Map<String, Object> body) {

        log.info("Webhook recibido de Mercado Pago: type={}, topic={}, id={}, data.id={}, body={}",
                type, topic, paramId, dataId, body);

        String paymentId = resolvePaymentId(type, topic, paramId, dataId, body);

        if (!esFirmaValida(xSignature, xRequestId, paymentId)) {
            log.warn("Firma de webhook inválida. Rechazando solicitud.");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            if (paymentId != null) {
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

                        switch (status) {
                            case "approved" -> {
                                if (pago.getEstado() != EstadoPago.APROBADO) {
                                    ConfirmarPagoRequest req = new ConfirmarPagoRequest(
                                            "MP-" + paymentId,
                                            "Pago aprobado por Mercado Pago (Medio: " + payment.getPaymentMethodId() + ")"
                                    );
                                    pagoService.confirmar(pagoId, req, "");
                                    log.info("Pago ID={} confirmado con éxito vía Webhook de Mercado Pago", pagoId);
                                } else {
                                    log.info("El pago ID={} ya se encontraba aprobado previamente", pagoId);
                                }
                            }
                            case "rejected" -> {
                                pago.setEstado(EstadoPago.RECHAZADO);
                                pago.setDetalle("Pago rechazado por Mercado Pago: " + payment.getStatusDetail());
                                pagoRepository.save(pago);
                                log.warn("Pago ID={} marcado como RECHAZADO por Mercado Pago", pagoId);
                            }
                            case "cancelled" -> {
                                pago.setEstado(EstadoPago.CANCELADO);
                                pago.setDetalle("Pago cancelado por Mercado Pago");
                                pagoRepository.save(pago);
                                log.warn("Pago ID={} marcado como CANCELADO por Mercado Pago", pagoId);
                            }
                            case "refunded" -> {
                                pago.setEstado(EstadoPago.REEMBOLSADO);
                                pago.setDetalle("Pago reembolsado por Mercado Pago");
                                pagoRepository.save(pago);
                                log.info("Pago ID={} marcado como REEMBOLSADO por Mercado Pago", pagoId);
                            }
                            case "in_process", "pending" -> {
                                pago.setEstado(EstadoPago.PENDIENTE);
                                pago.setDetalle("Pago en proceso en Mercado Pago (" + payment.getStatusDetail() + ")");
                                pagoRepository.save(pago);
                                log.info("Pago ID={} en estado PENDIENTE en Mercado Pago", pagoId);
                            }
                            default -> log.info("Estado de pago no mapeado: {}", status);
                        }
                    } else {
                        log.warn("No se encontró entidad Pago con ID={}", pagoId);
                    }
                }
            } else {
                log.info("No se identificó paymentId en el webhook recibido (puede ser evento de merchants u otro tipo)");
            }
        } catch (Exception e) {
            log.error("Error al procesar webhook de Mercado Pago: {}", e.getMessage(), e);
        }

        // Responder siempre 200 OK a Mercado Pago para confirmar recepción
        return ResponseEntity.ok().build();
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
            return true; // En desarrollo o sin secret configurado se acepta
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
                log.warn("Formato inválido de cabecera x-signature: {}", xSignature);
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

            boolean valida = hex.toString().equalsIgnoreCase(hashV1);
            if (!valida) {
                log.warn("Firma HMAC de webhook no coincide. Recibido: {}, Calculado: {}", hashV1, hex);
            }
            return valida;
        } catch (Exception e) {
            log.error("Error al validar firma HMAC: {}", e.getMessage());
            return false;
        }
    }
}
