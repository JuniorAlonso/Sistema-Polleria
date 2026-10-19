package com.sistema.polleria.feedback.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "reportes_incidencia", indexes = {
        @Index(name = "idx_reportes_orden", columnList = "orden_id"),
        @Index(name = "idx_reportes_cliente", columnList = "cliente_id"),
        @Index(name = "idx_reportes_estado", columnList = "estado")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReporteIncidencia {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "orden_id", nullable = false)
    private Long ordenId;

    @Column(name = "cliente_id", nullable = false)
    private Long clienteId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private MotivoReclamo motivo;

    @Column(length = 2000, nullable = false)
    private String descripcion;

    @Column(name = "foto_evidencia_url", length = 500)
    private String fotoEvidenciaUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private EstadoReclamo estado = EstadoReclamo.ABIERTO;

    @Column(name = "respuesta_admin", length = 2000)
    private String respuestaAdmin;

    @Builder.Default
    @Column(name = "reembolso_procedente")
    private Boolean reembolsoProcedente = false;

    @Column(name = "monto_reembolso", precision = 10, scale = 2)
    private BigDecimal montoReembolso;

    @Version
    private Long version;

    @Builder.Default
    @Column(name = "creado_en", nullable = false, updatable = false)
    private LocalDateTime creadoEn = LocalDateTime.now();

    @Column(name = "resuelto_en")
    private LocalDateTime resueltoEn;
}
