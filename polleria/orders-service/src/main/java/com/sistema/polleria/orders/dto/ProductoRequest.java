package com.sistema.polleria.orders.dto;

import com.sistema.polleria.orders.entity.Categoria;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class ProductoRequest {

    @NotBlank(message = "El nombre es obligatorio")
    @Size(max = 100)
    private String nombre;

    @Size(max = 500)
    private String descripcion;

    @NotNull(message = "El precio es obligatorio")
    @DecimalMin(value = "0.01", message = "El precio debe ser mayor a 0")
    private BigDecimal precio;

    @NotNull(message = "La categoría es obligatoria")
    private Categoria categoria;

    private String imagenUrl;

    private boolean disponible = true;
}
