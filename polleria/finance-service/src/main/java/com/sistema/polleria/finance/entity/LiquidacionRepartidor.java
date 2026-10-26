package com.sistema.polleria.finance.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "liquidaciones_repartidores", indexes = {
        @Index(name = "idx_liquidaciones_repartidor", columnList = "repartidor_id"),
        @Index(name = "idx_liquidaciones_estado", columnList = "estado")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LiquidacionRepartidor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "repartidor_id", nullable = false)
    private Long repartidorId;

    @Column(name = "repartidor_nombre", nullable = false, length = 100)
    private String repartidorNombre;

    @Column(name = "arqueo_caja_id")
    private Long arqueoCajaId;

    @Column(name = "fondo_inicial", nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal fondoInicial = BigDecimal.ZERO;

    @Column(name = "total_cobrado_efectivo", nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal totalCobradoEfectivo = BigDecimal.ZERO;

    @Column(name = "total_rendido", nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal totalRendido = BigDecimal.ZERO;

    @Column(nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal diferencia = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private EstadoLiquidacion estado = EstadoLiquidacion.ABIERTA;

    @Column(length = 500)
    private String observaciones;

    @Builder.Default
    @Column(name = "creado_en", nullable = false)
    private LocalDateTime creadoEn = LocalDateTime.now();

    @Column(name = "cerrado_en")
    private LocalDateTime cerradoEn;

    @Column(name = "cerrado_por")
    private Long cerradoPor;
}
