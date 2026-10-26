package com.sistema.polleria.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record CrearSancionRequest(
        String telefono,
        String email,
        String ipAddress,

        @NotBlank(message = "El motivo de la sanción es obligatorio")
        String motivo,

        Long ordenId,
        Boolean bloqueadoEfectivo,
        Boolean bloqueadoTotal
) {}
