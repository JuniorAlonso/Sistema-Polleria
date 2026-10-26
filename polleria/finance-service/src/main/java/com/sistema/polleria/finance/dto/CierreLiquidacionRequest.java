package com.sistema.polleria.finance.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record CierreLiquidacionRequest(
        @NotNull(message = "El total rendido en efectivo es obligatorio")
        @DecimalMin(value = "0.00", message = "El total rendido no puede ser negativo")
        BigDecimal totalRendido,

        @DecimalMin(value = "0.00", message = "El total cobrado en efectivo no puede ser negativo")
        BigDecimal totalCobradoEfectivo,

        String observaciones
) {}
