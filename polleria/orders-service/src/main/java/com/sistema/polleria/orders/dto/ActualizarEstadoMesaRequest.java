package com.sistema.polleria.orders.dto;

import com.sistema.polleria.orders.entity.MesaEstado;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ActualizarEstadoMesaRequest {
    @NotNull(message = "El estado de la mesa es obligatorio")
    private MesaEstado estado;
}
