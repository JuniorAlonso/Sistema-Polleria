package com.sistema.polleria.finance.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record RecargaFondoRequest(
        @NotNull(message = "El monto a recargar es obligatorio")
        @DecimalMin(value = "0.01", message = "El monto a recargar debe ser mayor a 0")
        BigDecimal monto,

        String motivo
) {}

