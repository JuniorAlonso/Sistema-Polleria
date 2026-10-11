package com.sistema.polleria.inventory.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RentabilidadInventarioResponse {
    private BigDecimal valorTotalInventario;
    private BigDecimal costoTotalMermas;
    private Integer totalInsumos;
    private Integer totalInsumosCriticos;
    private List<AlertaStockResponse> alertasCriticas;
}
