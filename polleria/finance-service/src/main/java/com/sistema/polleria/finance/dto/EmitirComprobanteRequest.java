package com.sistema.polleria.finance.dto;

import com.sistema.polleria.finance.entity.TipoComprobante;
import jakarta.validation.constraints.DecimalMin;
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

        @NotNull(message = "El total es obligatorio")
        @DecimalMin(value = "0.10", message = "El total debe ser mayor a 0")
        BigDecimal total,

        @NotNull(message = "Debe indicar si el pedido ya fue pagado o es contraentrega")
        Boolean pagadoDigitalmente,

        BigDecimal vueltoEstimado
) {}
