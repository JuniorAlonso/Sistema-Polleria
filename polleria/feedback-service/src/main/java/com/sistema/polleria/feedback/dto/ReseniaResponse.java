package com.sistema.polleria.feedback.dto;

import com.sistema.polleria.feedback.entity.Resenia;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReseniaResponse {
    private Long id;
    private Long ordenId;
    private Long clienteId;
    private Long productoId;
    private Integer calificacion;
    private String comentario;
    private String respuestaAdmin;
    private LocalDateTime respondidoEn;
    private Boolean visible;
    private LocalDateTime creadoEn;

    public static ReseniaResponse from(Resenia r) {
        if (r == null) return null;
        return ReseniaResponse.builder()
                .id(r.getId())
                .ordenId(r.getOrdenId())
                .clienteId(r.getClienteId())
                .productoId(r.getProductoId())
                .calificacion(r.getCalificacion())
                .comentario(r.getComentario())
                .respuestaAdmin(r.getRespuestaAdmin())
                .respondidoEn(r.getRespondidoEn())
                .visible(r.getVisible())
                .creadoEn(r.getCreadoEn())
                .build();
    }
}
