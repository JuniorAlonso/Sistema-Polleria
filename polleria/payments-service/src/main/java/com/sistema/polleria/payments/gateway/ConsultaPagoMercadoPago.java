package com.sistema.polleria.payments.gateway;

import com.mercadopago.client.payment.PaymentClient;
import com.mercadopago.exceptions.MPApiException;
import com.mercadopago.exceptions.MPException;
import com.mercadopago.resources.payment.Payment;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Optional;

/**
 * Reads a payment from the Mercado Pago API. The browser return URL is only a hint: its
 * {@code status} and {@code external_reference} can be typed by anyone, so the state that
 * counts is the one Mercado Pago reports for that payment id.
 */
@Slf4j
@Component
public class ConsultaPagoMercadoPago {

    public record PagoMercadoPago(String estado, String referenciaExterna, BigDecimal monto) {
        public boolean aprobado() {
            return "approved".equalsIgnoreCase(estado);
        }

        public boolean rechazado() {
            return "rejected".equalsIgnoreCase(estado) || "cancelled".equalsIgnoreCase(estado);
        }
    }

    /** Empty when Mercado Pago does not know the id or cannot be reached. */
    public Optional<PagoMercadoPago> consultar(long paymentId) {
        try {
            Payment payment = new PaymentClient().get(paymentId);
            return Optional.of(new PagoMercadoPago(payment.getStatus(), payment.getExternalReference(),
                    payment.getTransactionAmount()));
        } catch (MPApiException e) {
            log.warn("Mercado Pago no devolvió el pago {} (status {})", paymentId, e.getStatusCode());
        } catch (MPException e) {
            log.warn("No se pudo consultar el pago {} en Mercado Pago: {}", paymentId, e.getMessage());
        }
        return Optional.empty();
    }
}
