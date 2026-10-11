package com.sistema.polleria.finance.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AperturaCajaRequest {

    @NotNull(message = "El monto de apertura en efectivo es obligatorio")
    @PositiveOrZero(message = "El monto inicial no puede ser negativo")
    private BigDecimal montoApertura;

    private String usuarioNombre;
    private String observaciones;
}
