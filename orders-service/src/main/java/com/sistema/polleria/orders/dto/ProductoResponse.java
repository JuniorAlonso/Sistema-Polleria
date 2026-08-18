package com.sistema.polleria.orders.dto;

import com.sistema.polleria.orders.entity.Categoria;
import com.sistema.polleria.orders.entity.Producto;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class ProductoResponse {
    private Long id;
    private String nombre;
    private String descripcion;
    private BigDecimal precio;
    private Categoria categoria;
    private String imagenUrl;
    private boolean disponible;
    private LocalDateTime creadoEn;

    public static ProductoResponse from(Producto p) {
        return ProductoResponse.builder()
                .id(p.getId())
                .nombre(p.getNombre())
                .descripcion(p.getDescripcion())
                .precio(p.getPrecio())
                .categoria(p.getCategoria())
                .imagenUrl(p.getImagenUrl())
                .disponible(p.isDisponible())
                .creadoEn(p.getCreadoEn())
                .build();
    }
}
