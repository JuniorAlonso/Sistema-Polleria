package com.sistema.polleria.incident.dto;

import com.sistema.polleria.incident.entity.Severidad;
import com.sistema.polleria.incident.entity.TipoIncidente;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CrearIncidenteRequest {

    @NotBlank(message = "El título del incidente es obligatorio")
    private String titulo;

    @NotNull(message = "La severidad es obligatoria")
    private Severidad severidad;

    @NotNull(message = "El tipo de incidente es obligatorio")
    private TipoIncidente tipo;

    @NotBlank(message = "La descripción no puede estar vacía")
    private String descripcion;

    private String responsable;
}
