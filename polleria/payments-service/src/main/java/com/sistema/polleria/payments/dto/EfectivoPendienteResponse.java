package com.sistema.polleria.payments.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/** Cash a courier collected at the door and has not handed in yet (S6). */
public record EfectivoPendienteResponse(
        Long repartidorId,
        BigDecimal total,
        int cantidad,
        List<Item> pagos
) {
    public record Item(Long pagoId, Long ordenId, BigDecimal monto, LocalDateTime verificadoEn) {
    }
}
