package com.sistema.polleria.feedback.dto;

import com.sistema.polleria.feedback.entity.EstadoReclamo;
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
public class ResolverReporteRequest {

    @NotNull(message = "El estado de resolución es obligatorio")
    private EstadoReclamo estado;

    private String respuestaAdmin;

    @Builder.Default
    private Boolean reembolsoProcedente = false;

    private BigDecimal montoReembolso;
}
