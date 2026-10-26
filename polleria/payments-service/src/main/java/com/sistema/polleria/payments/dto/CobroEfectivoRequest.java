package com.sistema.polleria.payments.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/**
 * Registro y confirmación obligatoria del cobro de efectivo por parte del repartidor o cajero.
 */
public record CobroEfectivoRequest(
        @NotNull(message = "El ID de la orden es obligatorio")
        Long ordenId,

        @NotNull(message = "El monto es obligatorio")
        @DecimalMin(value = "0.10", message = "El monto debe ser mayor a 0")
        BigDecimal monto,

        BigDecimal montoRecibido,
        BigDecimal vueltoEntregado
) {}
