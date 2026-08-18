package com.sistema.polleria.payments.dto;

import com.sistema.polleria.payments.entity.MetodoPago;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

public record IniciarPagoRequest(

    @NotNull(message = "ordenId requerido")
    Long ordenId,

    @NotNull(message = "monto requerido")
    @DecimalMin(value = "0.01", message = "El monto debe ser mayor a cero")
    BigDecimal monto,

    @NotNull(message = "metodoPago requerido")
    MetodoPago metodoPago,

    /** Para TARJETA: token de la pasarela (Culqi token, etc.) */
    String tokenPasarela,

    /** Para YAPE_PLIN: número de teléfono registrado */
    String telefonoYape
) {}
