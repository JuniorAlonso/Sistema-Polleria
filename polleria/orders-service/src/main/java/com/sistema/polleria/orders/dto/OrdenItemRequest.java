package com.sistema.polleria.orders.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class OrdenItemRequest {

    @NotNull(message = "El ID del producto es obligatorio")
    private Long productoId;

    @NotNull
    @Min(value = 1, message = "La cantidad mínima es 1")
    private Integer cantidad;

    private String notas;
}
