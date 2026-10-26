package com.sistema.polleria.finance.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record AperturaLiquidacionRequest(
        @NotNull(message = "El ID del repartidor es obligatorio")
        Long repartidorId,

        @NotBlank(message = "El nombre del repartidor es obligatorio")
        String repartidorNombre,

        @NotNull(message = "El fondo inicial es obligatorio")
        @DecimalMin(value = "0.00", message = "El fondo inicial no puede ser negativo")
        BigDecimal fondoInicial,

        String observaciones
) {}
