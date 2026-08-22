package com.sistema.polleria.orders.dto;

import com.sistema.polleria.orders.entity.OrdenEstado;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ActualizarEstadoRequest {

    @NotNull(message = "El estado es obligatorio")
    private OrdenEstado estado;

    private Long repartidorId;
}
