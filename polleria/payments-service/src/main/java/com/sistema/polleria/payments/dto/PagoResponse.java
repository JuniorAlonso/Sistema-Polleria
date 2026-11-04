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
    LocalDateTime actualizadoEn,
    String checkoutUrl,
    String comprobanteClave,
    String comprobanteUrl
) {
    public PagoResponse(
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
        this(id, ordenId, clienteId, monto, metodoPago, estado, referenciaExterna, detalle, creadoEn, actualizadoEn, null, null, null);
    }

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
            p.getActualizadoEn(),
            p.getCheckoutUrl(),
            p.getComprobanteClave(),
            null
        );
    }

    /**
     * Copia con la URL firmada de vida corta del comprobante. La usa solo el controlador y solo
     * cuando quien consulta es {@code ADMIN} (T6c, S7).
     */
    public PagoResponse conUrlComprobante(String url) {
        return new PagoResponse(
            id, ordenId, clienteId, monto, metodoPago, estado, referenciaExterna, detalle,
            creadoEn, actualizadoEn, checkoutUrl, comprobanteClave, url
        );
    }

    /**
     * Copia sin la clave ni la URL del comprobante. El bucket es privado y la referencia opaca al
     * objeto no se expone a roles distintos de {@code ADMIN} (T6c, S7).
     */
    public PagoResponse sinComprobante() {
        return new PagoResponse(
            id, ordenId, clienteId, monto, metodoPago, estado, referenciaExterna, detalle,
            creadoEn, actualizadoEn, checkoutUrl, null, null
        );
    }
}
