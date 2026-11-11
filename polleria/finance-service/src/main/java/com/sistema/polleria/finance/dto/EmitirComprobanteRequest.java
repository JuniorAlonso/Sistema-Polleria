package com.sistema.polleria.finance.dto;

import com.sistema.polleria.finance.entity.TipoComprobante;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record EmitirComprobanteRequest(
        @NotNull(message = "El ID de la orden es obligatorio")
        Long ordenId,

        @NotNull(message = "El tipo de comprobante es obligatorio (BOLETA o FACTURA)")
        TipoComprobante tipo,

        String clienteTipoDoc, // DNI o RUC
        String clienteNumDoc,

        @NotBlank(message = "El nombre o razón social del cliente es obligatorio")
        String clienteNombre,

        String clienteDireccion,

        /**
         * Ignored since D3.15: finance takes the total from the approved payment or the order.
         * Kept so existing clients that still send it keep working.
         */
        BigDecimal total,

        @NotNull(message = "Debe indicar si el pedido ya fue pagado o es contraentrega")
        Boolean pagadoDigitalmente,

        BigDecimal vueltoEstimado,

        /** Optional (D3.2): when true, the cash income of the sale is registered once per order. */
        Boolean ingresoCaja
) {
    /** Shape used before {@code ingresoCaja} existed; equivalent to {@code ingresoCaja=false}. */
    public EmitirComprobanteRequest(Long ordenId, TipoComprobante tipo, String clienteTipoDoc,
                                    String clienteNumDoc, String clienteNombre, String clienteDireccion,
                                    BigDecimal total, Boolean pagadoDigitalmente, BigDecimal vueltoEstimado) {
        this(ordenId, tipo, clienteTipoDoc, clienteNumDoc, clienteNombre, clienteDireccion, total,
                pagadoDigitalmente, vueltoEstimado, null);
    }

    public boolean registraIngresoCaja() {
        return Boolean.TRUE.equals(ingresoCaja);
    }
}
