package com.sistema.polleria.feedback.dto;

import com.sistema.polleria.feedback.entity.EstadoReclamo;
import com.sistema.polleria.feedback.entity.MotivoReclamo;
import com.sistema.polleria.feedback.entity.ReporteIncidencia;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReporteResponse {
    private Long id;
    private Long ordenId;
    private Long clienteId;
    private MotivoReclamo motivo;
    private String descripcion;
    private String fotoEvidenciaUrl;
    private EstadoReclamo estado;
    private String respuestaAdmin;
    private Boolean reembolsoProcedente;
    private BigDecimal montoReembolso;
    private LocalDateTime creadoEn;
    private LocalDateTime resueltoEn;

    public static ReporteResponse from(ReporteIncidencia r) {
        if (r == null) return null;
        return ReporteResponse.builder()
                .id(r.getId())
                .ordenId(r.getOrdenId())
                .clienteId(r.getClienteId())
                .motivo(r.getMotivo())
                .descripcion(r.getDescripcion())
                .fotoEvidenciaUrl(r.getFotoEvidenciaUrl())
                .estado(r.getEstado())
                .respuestaAdmin(r.getRespuestaAdmin())
                .reembolsoProcedente(r.getReembolsoProcedente())
                .montoReembolso(r.getMontoReembolso())
                .creadoEn(r.getCreadoEn())
                .resueltoEn(r.getResueltoEn())
                .build();
    }
}
