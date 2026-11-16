package com.sistema.polleria.payments.dto;

import com.sistema.polleria.payments.entity.MetodoPago;
import jakarta.validation.constraints.NotBlank;

public record ConfirmarPagoRequest(
    @NotBlank(message = "referenciaExterna requerida")
    String referenciaExterna,
    String detalle,
    MetodoPago metodoPago,
    String mpPaymentId
) {
    public ConfirmarPagoRequest(String referenciaExterna, String detalle) {
        this(referenciaExterna, detalle, null, null);
    }

    public ConfirmarPagoRequest(String referenciaExterna, String detalle, MetodoPago metodoPago) {
        this(referenciaExterna, detalle, metodoPago, null);
    }

    public ConfirmarPagoRequest sinMpPaymentId() {
        return new ConfirmarPagoRequest(referenciaExterna, detalle, metodoPago, null);
    }
}
