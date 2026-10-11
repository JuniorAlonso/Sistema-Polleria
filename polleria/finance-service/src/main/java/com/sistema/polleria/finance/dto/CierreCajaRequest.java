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
public class CierreCajaRequest {

    @NotNull(message = "El monto en efectivo contado es obligatorio")
    @PositiveOrZero(message = "El monto en efectivo no puede ser negativo")
    private BigDecimal montoCierreEfectivo;

    @NotNull(message = "El monto cobrado por POS físico es obligatorio")
    @PositiveOrZero(message = "El monto POS no puede ser negativo")
    private BigDecimal montoCierrePos;

    private BigDecimal ventasDigitales;

    private String observaciones;
}
