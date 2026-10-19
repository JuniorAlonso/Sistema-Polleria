package com.sistema.polleria.feedback.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ResponderReseniaRequest {

    @NotBlank(message = "La respuesta del administrador no puede estar vacía")
    @Size(max = 1000, message = "La respuesta no puede exceder los 1000 caracteres")
    private String respuestaAdmin;
}
