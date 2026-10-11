package com.sistema.polleria.orders.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ActualizarPosicionMesaRequest {
    @NotNull(message = "posicionX es obligatorio")
    private Integer posicionX;

    @NotNull(message = "posicionY es obligatorio")
    private Integer posicionY;
}
