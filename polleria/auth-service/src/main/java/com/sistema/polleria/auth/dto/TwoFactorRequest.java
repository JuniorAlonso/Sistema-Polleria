package com.sistema.polleria.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class TwoFactorRequest {

    @NotBlank(message = "El correo es obligatorio")
    private String email;

    @NotBlank(message = "El código de verificación es obligatorio")
    private String code;
}
