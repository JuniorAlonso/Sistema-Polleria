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
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/pagos/webhook")
@RequiredArgsConstructor
public class MercadoPagoWebhookController {

    private final PagoRepository pagoRepository;
    private final PagoService pagoService;

    @RequestMapping(value = "/mercadopago", method = {RequestMethod.POST, RequestMethod.GET})
    public ResponseEntity<Void> handleWebhook(
            @RequestParam(value = "type", required = false) String type,
            @RequestParam(value = "topic", required = false) String topic,
            @RequestParam(value = "id", required = false) String paramId,
            @RequestParam(value = "data.id", required = false) String dataId,
            @RequestBody(required = false) Map<String, Object> body) {

        log.info("Webhook recibido de Mercado Pago: type={}, topic={}, id={}, data.id={}, body={}",
                type, topic, paramId, dataId, body);

        try {
            String paymentId = null;

            if (dataId != null && !dataId.isBlank()) {
                paymentId = dataId;
            } else if (paramId != null && !paramId.isBlank() && ("payment".equalsIgnoreCase(type) || "payment".equalsIgnoreCase(topic))) {
                paymentId = paramId;
            } else if (body != null && body.containsKey("data")) {
                Object dataObj = body.get("data");
                if (dataObj instanceof Map<?, ?> dataMap && dataMap.get("id") != null) {
                    paymentId = String.valueOf(dataMap.get("id"));
                }
            }

            if (paymentId != null) {
                log.info("Consultando estado de pago en Mercado Pago para paymentId={}", paymentId);
                PaymentClient client = new PaymentClient();
                Payment payment = client.get(Long.parseLong(paymentId));

                log.info("Resultado de Mercado Pago: paymentId={}, status={}, externalReference={}",
                        payment.getId(), payment.getStatus(), payment.getExternalReference());

                if (payment.getExternalReference() != null && !payment.getExternalReference().isBlank()) {
                    Long pagoId = Long.parseLong(payment.getExternalReference());
                    var optPago = pagoRepository.findById(pagoId);

                    if (optPago.isPresent()) {
                        Pago pago = optPago.get();
                        if ("approved".equalsIgnoreCase(payment.getStatus())) {
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
                        } else if ("rejected".equalsIgnoreCase(payment.getStatus())) {
                            pago.setEstado(EstadoPago.RECHAZADO);
                            pago.setDetalle("Pago rechazado por Mercado Pago: " + payment.getStatusDetail());
                            pagoRepository.save(pago);
                            log.warn("Pago ID={} marcado como RECHAZADO por Mercado Pago", pagoId);
                        }
                    } else {
                        log.warn("No se encontró entidad Pago con ID={}", pagoId);
                    }
                }
            }
        } catch (Exception e) {
            log.error("Error al procesar webhook de Mercado Pago: {}", e.getMessage(), e);
        }

        // Responder siempre 200 OK para evitar reintentos innecesarios de Mercado Pago
        return ResponseEntity.ok().build();
    }
}
