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
public class CrearMesaRequest {
    @NotNull(message = "El número de mesa es obligatorio")
    private Integer numero;

    @NotNull(message = "La capacidad de la mesa es obligatoria")
    private Integer capacidad;

    private Integer posicionX;
    private Integer posicionY;
}
