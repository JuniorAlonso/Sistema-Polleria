package com.sistema.polleria.payments.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/**
 * Registro y confirmación obligatoria del cobro de efectivo por parte del repartidor o cajero.
 *
 * <p>{@code monto} must be the order total and {@code montoRecibido}, when sent, cannot be lower
 * (S6). {@code codigoTicket} is required for RECOJO orders and must be {@code POL-<ordenId>} (S7).
 */
public record CobroEfectivoRequest(
        @NotNull(message = "El ID de la orden es obligatorio")
        Long ordenId,

        @NotNull(message = "El monto es obligatorio")
        @DecimalMin(value = "0.10", message = "El monto debe ser mayor a 0")
        BigDecimal monto,

        BigDecimal montoRecibido,
        BigDecimal vueltoEntregado,

        @Size(max = 40, message = "El código de ticket no puede superar 40 caracteres")
        String codigoTicket
) {
    /** Request without a pickup ticket (DELIVERY collections). */
    public CobroEfectivoRequest(Long ordenId, BigDecimal monto, BigDecimal montoRecibido, BigDecimal vueltoEntregado) {
        this(ordenId, monto, montoRecibido, vueltoEntregado, null);
    }
}
