package com.sistema.polleria.feedback.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductoReseniasResponse {
    private Long productoId;
    private Double promedioCalificacion;
    private Integer totalResenias;
    private List<ReseniaResponse> resenias;
}
