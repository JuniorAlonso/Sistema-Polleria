package com.sistema.polleria.finance.dto;

import com.sistema.polleria.finance.entity.EstadoLiquidacion;
import com.sistema.polleria.finance.entity.LiquidacionRepartidor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record LiquidacionResponse(
        Long id,
        Long repartidorId,
        String repartidorNombre,
        Long arqueoCajaId,
        BigDecimal fondoInicial,
        BigDecimal totalCobradoEfectivo,
        BigDecimal totalEsperadoEfectivo,
        BigDecimal diferenciaEfectivo,
        BigDecimal totalRendido,
        BigDecimal diferencia,
        EstadoLiquidacion estado,
        String observaciones,
        LocalDateTime creadoEn,
        LocalDateTime cerradoEn,
        Long cerradoPor
) {
    public static LiquidacionResponse from(LiquidacionRepartidor l) {
        return new LiquidacionResponse(
                l.getId(),
                l.getRepartidorId(),
                l.getRepartidorNombre(),
                l.getArqueoCajaId(),
                l.getFondoInicial(),
                l.getTotalCobradoEfectivo(),
                l.getTotalEsperadoEfectivo(),
                l.getDiferenciaEfectivo(),
                l.getTotalRendido(),
                l.getDiferencia(),
                l.getEstado(),
                l.getObservaciones(),
                l.getCreadoEn(),
                l.getCerradoEn(),
                l.getCerradoPor()
        );
    }
}
