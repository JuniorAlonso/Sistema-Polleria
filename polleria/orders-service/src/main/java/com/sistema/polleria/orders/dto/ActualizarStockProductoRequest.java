package com.sistema.polleria.orders.dto;

import jakarta.validation.constraints.Min;
import lombok.Data;

/** Stock nuevo de un producto. {@code null} quita el control de stock. */
@Data
public class ActualizarStockProductoRequest {

    @Min(value = 0, message = "El stock no puede ser negativo")
    private Integer stock;
}
