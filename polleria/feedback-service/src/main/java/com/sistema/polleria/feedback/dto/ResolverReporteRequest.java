package com.sistema.polleria.feedback.dto;

import com.sistema.polleria.feedback.entity.EstadoReclamo;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
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

    @DecimalMin(value = "0.10", message = "El monto mínimo de reembolso es S/ 0.10")
    @Digits(integer = 8, fraction = 2, message = "El formato de moneda debe tener máximo 2 decimales")
    private BigDecimal montoReembolso;

    @AssertTrue(message = "Si el reembolso procede, debe especificarse un monto mayor a cero y el estado debe ser RESUELTO")
    public boolean isReembolsoValido() {
        if (!Boolean.TRUE.equals(reembolsoProcedente)) {
            return true;
        }
        return montoReembolso != null &&
                montoReembolso.compareTo(BigDecimal.ZERO) > 0 &&
                estado == EstadoReclamo.RESUELTO;
    }
}
