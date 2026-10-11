package com.sistema.polleria.incident.dto;

import com.sistema.polleria.incident.entity.EstadoIncidente;
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
public class ResolverIncidenteRequest {

    @NotNull(message = "El estado resultante es obligatorio")
    @Builder.Default
    private EstadoIncidente estado = EstadoIncidente.RESUELTO;

    @NotBlank(message = "La causa raíz es obligatoria para cerrar el incidente")
    private String causaRaiz;

    @NotBlank(message = "La solución aplicada es obligatoria para cerrar el incidente")
    private String solucionAplicada;

    private String responsable;
}
