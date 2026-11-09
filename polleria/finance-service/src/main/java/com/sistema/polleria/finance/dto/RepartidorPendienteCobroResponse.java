package com.sistema.polleria.finance.dto;

import java.math.BigDecimal;

public record RepartidorPendienteCobroResponse(
        Long repartidorId,
        String repartidorNombre,
        BigDecimal totalCobrado,
        BigDecimal totalRendido,
        BigDecimal saldoPendiente,
        int cantidadOrdenes,
        Long liquidacionId
) {
}

