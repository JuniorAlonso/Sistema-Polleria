package com.sistema.polleria.finance.dto;

import com.sistema.polleria.finance.entity.CobroRepartidor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record CobroRepartidorResponse(
        Long id,
        Long repartidorId,
        BigDecimal monto,
        Long arqueoCajaId,
        Long cobradoPor,
        LocalDateTime fecha,
        String observaciones,
        Long liquidacionId,
        BigDecimal saldoRestante
) {
    public static CobroRepartidorResponse from(CobroRepartidor c, BigDecimal saldoRestante) {
        return new CobroRepartidorResponse(
                c.getId(),
                c.getRepartidorId(),
                c.getMonto(),
                c.getArqueoCajaId(),
                c.getCobradoPor(),
                c.getFecha(),
                c.getObservaciones(),
                c.getLiquidacionId(),
                saldoRestante
        );
    }
}

