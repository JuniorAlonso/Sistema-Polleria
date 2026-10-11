package com.sistema.polleria.incident.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "incidentes", indexes = {
        @Index(name = "idx_incidentes_severidad", columnList = "severidad"),
        @Index(name = "idx_incidentes_estado", columnList = "estado")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Incidente {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String titulo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Severidad severidad;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TipoIncidente tipo;

    @Column(length = 4000, nullable = false)
    private String descripcion;

    @Column(name = "causa_raiz", length = 4000)
    private String causaRaiz;

    @Column(name = "solucion_aplicada", length = 4000)
    private String solucionAplicada;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 25)
    @Builder.Default
    private EstadoIncidente estado = EstadoIncidente.ABIERTO;

    @Builder.Default
    @Column(name = "ocurrido_en", nullable = false)
    private LocalDateTime ocurridoEn = LocalDateTime.now();

    @Column(name = "resuelto_en")
    private LocalDateTime resueltoEn;

    @Column(length = 100)
    private String responsable;
}
