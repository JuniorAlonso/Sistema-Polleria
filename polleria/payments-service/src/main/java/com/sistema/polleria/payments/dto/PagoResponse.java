package com.sistema.polleria.payments.dto;

import com.sistema.polleria.payments.entity.EstadoPago;
import com.sistema.polleria.payments.entity.MetodoPago;
import com.sistema.polleria.payments.entity.Pago;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record PagoResponse(
    Long id,
    Long ordenId,
    Long clienteId,
    BigDecimal monto,
    MetodoPago metodoPago,
    EstadoPago estado,
    String referenciaExterna,
    String detalle,
    LocalDateTime creadoEn,
    LocalDateTime actualizadoEn
) {
    public static PagoResponse from(Pago p) {
        return new PagoResponse(
            p.getId(),
            p.getOrdenId(),
            p.getClienteId(),
            p.getMonto(),
            p.getMetodoPago(),
            p.getEstado(),
            p.getReferenciaExterna(),
            p.getDetalle(),
            p.getCreadoEn(),
            p.getActualizadoEn()
        );
    }
}
