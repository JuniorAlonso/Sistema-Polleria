package com.sistema.polleria.inventory.dto;

import com.sistema.polleria.inventory.entity.Insumo;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InsumoResponse {
    private Long id;
    private String nombre;
    private String unidadMedida;
    private BigDecimal stockActual;
    private BigDecimal stockMinimoAlerta;
    private BigDecimal costoUnitario;
    private boolean enAlertaCritica;

    public static InsumoResponse from(Insumo i) {
        if (i == null) return null;
        boolean alerta = i.getStockActual() != null && i.getStockMinimoAlerta() != null
                && i.getStockActual().compareTo(i.getStockMinimoAlerta()) <= 0;
        return InsumoResponse.builder()
                .id(i.getId())
                .nombre(i.getNombre())
                .unidadMedida(i.getUnidadMedida())
                .stockActual(i.getStockActual())
                .stockMinimoAlerta(i.getStockMinimoAlerta())
                .costoUnitario(i.getCostoUnitario())
                .enAlertaCritica(alerta)
                .build();
    }
}
