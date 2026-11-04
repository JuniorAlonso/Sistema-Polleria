package com.sistema.polleria.payments.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.math.BigDecimal;

/**
 * Solicitud de cobro directo mediante Yape integrado en Mercado Pago.
 * El cliente ingresa su celular y el código OTP de aprobación de 6 dígitos generado en su app Yape.
 */
public record YapeOtpPagoRequest(
        @NotNull(message = "El ID de la orden es obligatorio")
        Long ordenId,

        @NotNull(message = "El monto es obligatorio")
        @DecimalMin(value = "0.10", message = "El monto debe ser mayor a 0")
        BigDecimal monto,

        @NotBlank(message = "El celular de Yape es obligatorio")
        @Pattern(regexp = "^9\\d{8}$", message = "El celular debe ser peruano de 9 dígitos comenzando con 9")
        String telefono,

        @NotBlank(message = "El código OTP de aprobación es obligatorio")
        @Pattern(regexp = "^\\d{6}$", message = "El código OTP de Yape debe tener exactamente 6 dígitos")
        String otp,

        String email
) {}
