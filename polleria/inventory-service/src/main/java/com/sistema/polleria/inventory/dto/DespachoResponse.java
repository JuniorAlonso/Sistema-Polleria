package com.sistema.polleria.inventory.dto;

import com.sistema.polleria.inventory.entity.DespachoCocina;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DespachoResponse {
    private Long id;
    private Long solicitanteId;
    private String solicitanteNombre;
    private LocalDateTime fechaDespacho;
    private List<ItemDespachoDto> items;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ItemDespachoDto {
        private Long id;
        private Long insumoId;
        private String insumoNombre;
        private BigDecimal cantidad;
        private String observaciones;
    }

    public static DespachoResponse from(DespachoCocina d) {
        if (d == null) return null;
        List<ItemDespachoDto> itemsDto = d.getItems() != null ? d.getItems().stream()
                .map(i -> ItemDespachoDto.builder()
                        .id(i.getId())
                        .insumoId(i.getInsumoId())
                        .insumoNombre(i.getInsumoNombre())
                        .cantidad(i.getCantidad())
                        .observaciones(i.getObservaciones())
                        .build())
                .toList() : List.of();

        return DespachoResponse.builder()
                .id(d.getId())
                .solicitanteId(d.getSolicitanteId())
                .solicitanteNombre(d.getSolicitanteNombre())
                .fechaDespacho(d.getFechaDespacho())
                .items(itemsDto)
                .build();
    }
}
