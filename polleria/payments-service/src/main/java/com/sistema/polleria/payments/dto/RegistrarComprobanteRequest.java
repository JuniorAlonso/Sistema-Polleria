package com.sistema.polleria.payments.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/**
 * Evidencia de un pago por Yape hecho por WhatsApp (T6a, S6). La envía el notification-service
 * cuando el cliente manda la imagen del comprobante; payments-service solo guarda la referencia
 * opaca al objeto del bucket, nunca el archivo (eso es T6b).
 *
 * @param ordenId          orden de la que es el pago (obligatorio, positivo)
 * @param telefono         celular del cliente que envió el comprobante (opcional)
 * @param monto            monto declarado en el comprobante (opcional)
 * @param comprobanteClave clave del objeto en el bucket, para que el admin lo vea después (T6c)
 */
public record RegistrarComprobanteRequest(

    @NotNull(message = "ordenId requerido")
    @Positive(message = "ordenId debe ser mayor a cero")
    Long ordenId,

    String telefono,

    @DecimalMin(value = "0.01", message = "El monto debe ser mayor a cero")
    BigDecimal monto,

    @NotBlank(message = "comprobanteClave requerida")
    @Size(max = 300, message = "comprobanteClave no puede superar 300 caracteres")
    String comprobanteClave
) {}
