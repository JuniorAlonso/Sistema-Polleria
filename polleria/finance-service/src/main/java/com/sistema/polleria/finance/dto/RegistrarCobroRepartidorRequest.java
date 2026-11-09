package com.sistema.polleria.finance.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record RegistrarCobroRepartidorRequest(
        @NotNull(message = "repartidorId es requerido")
        Long repartidorId,

        String repartidorNombre,

        @NotNull(message = "El monto es requerido")
        @DecimalMin(value = "0.01", message = "El monto a cobrar debe ser mayor a 0")
        BigDecimal monto,

        String observaciones
) {
}

