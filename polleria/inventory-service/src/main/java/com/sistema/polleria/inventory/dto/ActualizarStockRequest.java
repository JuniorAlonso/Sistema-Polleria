package com.sistema.polleria.inventory.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ActualizarStockRequest {

    @NotNull(message = "El delta o nuevo stock es obligatorio")
    private BigDecimal cantidad;

    // true: suma/resta delta. false: sobreescribe el stock total
    @Builder.Default
    private boolean esDelta = true;

    private String motivo;
}
