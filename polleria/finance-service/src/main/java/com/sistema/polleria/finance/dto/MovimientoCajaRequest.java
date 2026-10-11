package com.sistema.polleria.finance.dto;

import com.sistema.polleria.finance.entity.TipoMovimiento;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MovimientoCajaRequest {

    @NotNull(message = "El tipo de movimiento es obligatorio (INGRESO o EGRESO)")
    private TipoMovimiento tipo;

    @NotNull(message = "El monto es obligatorio")
    @Positive(message = "El monto debe ser positivo")
    private BigDecimal monto;

    @NotBlank(message = "El motivo o justificación es obligatorio")
    private String motivo;
}
