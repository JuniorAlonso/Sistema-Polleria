package com.sistema.polleria.finance.dto;

import com.sistema.polleria.finance.service.PagosClient;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/** Cash a courier must hand in for his open liquidation (S6). */
public record EfectivoPendienteLiquidacionResponse(
        Long repartidorId,
        Long liquidacionId,
        LocalDateTime desde,
        BigDecimal total,
        int cantidad,
        List<PagosClient.EfectivoPendiente.Item> pagos
) {
}
