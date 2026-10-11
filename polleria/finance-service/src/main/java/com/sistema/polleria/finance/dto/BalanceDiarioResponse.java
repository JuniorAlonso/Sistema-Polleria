package com.sistema.polleria.finance.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BalanceDiarioResponse {
    private String fecha;
    private IngresosDto ingresos;
    private EgresosDto egresos;
    private BigDecimal balanceNeto;
    private Integer ordenesAtendidas;
    private BigDecimal ticketPromedio;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class IngresosDto {
        private BigDecimal pasarelaDigital;
        private BigDecimal efectivoSalon;
        private BigDecimal posFisicoSalon;
        private BigDecimal totalIngresos;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EgresosDto {
        private BigDecimal reembolsosEmitidos;
        private BigDecimal gastosCajaChica;
        private BigDecimal totalEgresos;
    }
}
