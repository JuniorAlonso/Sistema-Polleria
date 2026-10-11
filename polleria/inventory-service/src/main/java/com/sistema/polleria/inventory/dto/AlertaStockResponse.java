package com.sistema.polleria.inventory.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertaStockResponse {
    private Long insumoId;
    private String insumoNombre;
    private BigDecimal stockActual;
    private BigDecimal stockMinimoAlerta;
    private String unidadMedida;
    private String nivelCriticidad; // ALTO, MEDIO, CRITICO
    private String mensaje;
}
