package com.sistema.polleria.payments.dto;

public record PreferenceResponse(
    String preferenceId,
    String initPoint,
    String sandboxInitPoint,
    Long pagoId,
    Long ordenId
) {}
