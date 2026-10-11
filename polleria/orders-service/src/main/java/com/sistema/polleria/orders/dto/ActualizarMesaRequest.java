package com.sistema.polleria.orders.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ActualizarMesaRequest {
    private Integer numero;
    private Integer capacidad;
    private Integer posicionX;
    private Integer posicionY;
    private String zona;
    private Boolean activo;
}
