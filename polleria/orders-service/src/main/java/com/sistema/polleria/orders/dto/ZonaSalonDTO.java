package com.sistema.polleria.orders.dto;

import com.sistema.polleria.orders.entity.ZonaSalon;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ZonaSalonDTO {
    private Long id;
    private String slug;
    private String nombre;
    private Integer filas;
    private Integer columnas;
    private String color;
    private Integer orden;
    private Boolean activo;

    public static ZonaSalonDTO from(ZonaSalon entity) {
        return ZonaSalonDTO.builder()
                .id(entity.getId())
                .slug(entity.getSlug())
                .nombre(entity.getNombre())
                .filas(entity.getFilas())
                .columnas(entity.getColumnas())
                .color(entity.getColor())
                .orden(entity.getOrden())
                .activo(entity.getActivo())
                .build();
    }
}
