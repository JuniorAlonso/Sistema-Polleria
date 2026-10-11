package com.sistema.polleria.inventory.dto;

import com.sistema.polleria.inventory.entity.Merma;
import com.sistema.polleria.inventory.entity.MotivoMerma;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MermaResponse {
    private Long id;
    private Long insumoId;
    private String insumoNombre;
    private BigDecimal cantidad;
    private MotivoMerma motivo;
    private String justificacion;
    private Long registradoPor;
    private LocalDateTime fecha;

    public static MermaResponse from(Merma m) {
        if (m == null) return null;
        return MermaResponse.builder()
                .id(m.getId())
                .insumoId(m.getInsumoId())
                .insumoNombre(m.getInsumoNombre())
                .cantidad(m.getCantidad())
                .motivo(m.getMotivo())
                .justificacion(m.getJustificacion())
                .registradoPor(m.getRegistradoPor())
                .fecha(m.getFecha())
                .build();
    }
}
