package com.sistema.polleria.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LoginRequest {

    // Puede ser email o teléfono
    @NotBlank(message = "El usuario (correo o celular) es obligatorio")
    private String identifier;

    @NotBlank(message = "La contraseña es obligatoria")
    private String password;
}
