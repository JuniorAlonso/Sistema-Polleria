package com.sistema.polleria.payments.dto;

import jakarta.validation.constraints.NotBlank;

public record ConfirmarPagoRequest(
    @NotBlank(message = "referenciaExterna requerida")
    String referenciaExterna,
    String detalle
) {}
