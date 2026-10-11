package com.sistema.polleria.incident.dto;

import com.sistema.polleria.incident.entity.EstadoIncidente;
import com.sistema.polleria.incident.entity.Incidente;
import com.sistema.polleria.incident.entity.Severidad;
import com.sistema.polleria.incident.entity.TipoIncidente;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IncidenteResponse {
    private Long id;
    private String titulo;
    private Severidad severidad;
    private TipoIncidente tipo;
    private String descripcion;
    private String causaRaiz;
    private String solucionAplicada;
    private EstadoIncidente estado;
    private LocalDateTime ocurridoEn;
    private LocalDateTime resueltoEn;
    private String responsable;

    public static IncidenteResponse from(Incidente i) {
        if (i == null) return null;
        return IncidenteResponse.builder()
                .id(i.getId())
                .titulo(i.getTitulo())
                .severidad(i.getSeveridad())
                .tipo(i.getTipo())
                .descripcion(i.getDescripcion())
                .causaRaiz(i.getCausaRaiz())
                .solucionAplicada(i.getSolucionAplicada())
                .estado(i.getEstado())
                .ocurridoEn(i.getOcurridoEn())
                .resueltoEn(i.getResueltoEn())
                .responsable(i.getResponsable())
                .build();
    }
}
