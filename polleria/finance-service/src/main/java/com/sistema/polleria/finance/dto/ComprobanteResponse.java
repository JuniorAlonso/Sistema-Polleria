package com.sistema.polleria.finance.dto;

import com.sistema.polleria.finance.entity.ComprobantePago;
import com.sistema.polleria.finance.entity.TipoComprobante;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ComprobanteResponse(
        Long id,
        Long ordenId,
        TipoComprobante tipo,
        String serieCorrelativo,
        String clienteTipoDoc,
        String clienteNumDoc,
        String clienteNombre,
        String clienteDireccion,
        BigDecimal subtotal,
        BigDecimal igv,
        BigDecimal total,
        String estadoPagoTexto,
        BigDecimal vueltoEntregado,
        LocalDateTime emitidoEn,
        Long emitidoPor
) {
    public static ComprobanteResponse from(ComprobantePago c) {
        return new ComprobanteResponse(
                c.getId(),
                c.getOrdenId(),
                c.getTipo(),
                c.getSerieCorrelativo(),
                c.getClienteTipoDoc(),
                c.getClienteNumDoc(),
                c.getClienteNombre(),
                c.getClienteDireccion(),
                c.getSubtotal(),
                c.getIgv(),
                c.getTotal(),
                c.getEstadoPagoTexto(),
                c.getVueltoEntregado(),
                c.getEmitidoEn(),
                c.getEmitidoPor()
        );
    }
}
