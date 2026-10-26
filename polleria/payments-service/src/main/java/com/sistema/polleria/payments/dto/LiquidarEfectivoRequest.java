package com.sistema.polleria.payments.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/** Marks cash payments as handed in under a courier settlement (S6). */
public record LiquidarEfectivoRequest(
        @NotEmpty(message = "pagoIds es obligatorio")
        List<@NotNull Long> pagoIds,

        @NotNull(message = "liquidacionId es obligatorio")
        Long liquidacionId
) {
}
