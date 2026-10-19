package com.sistema.polleria.feedback.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "resenias",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_resenia_orden_cliente", columnNames = {"orden_id", "cliente_id"})
        },
        indexes = {
                @Index(name = "idx_resenias_orden", columnList = "orden_id"),
                @Index(name = "idx_resenias_cliente", columnList = "cliente_id"),
                @Index(name = "idx_resenias_producto", columnList = "producto_id")
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Resenia {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "orden_id", nullable = false)
    private Long ordenId;

    @Column(name = "cliente_id", nullable = false)
    private Long clienteId;

    @Column(name = "producto_id")
    private Long productoId;

    @Min(1)
    @Max(5)
    @Column(nullable = false)
    private Integer calificacion;

    @Column(length = 1000)
    private String comentario;

    @Column(name = "respuesta_admin", length = 1000)
    private String respuestaAdmin;

    @Column(name = "respondido_en")
    private LocalDateTime respondidoEn;

    @Builder.Default
    @Column(nullable = false)
    private Boolean visible = true;

    @Builder.Default
    @Column(name = "creado_en", nullable = false, updatable = false)
    private LocalDateTime creadoEn = LocalDateTime.now();
}
