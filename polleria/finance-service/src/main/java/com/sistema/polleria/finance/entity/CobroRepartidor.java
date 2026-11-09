package com.sistema.polleria.finance.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "cobros_repartidores", indexes = {
        @Index(name = "idx_cobros_repartidores_repartidor", columnList = "repartidor_id"),
        @Index(name = "idx_cobros_repartidores_fecha", columnList = "fecha"),
        @Index(name = "idx_cobros_repartidores_liquidacion", columnList = "liquidacion_id")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CobroRepartidor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "repartidor_id", nullable = false)
    private Long repartidorId;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal monto;

    @Column(name = "arqueo_caja_id")
    private Long arqueoCajaId;

    @Column(name = "cobrado_por", nullable = false)
    private Long cobradoPor;

    @Builder.Default
    @Column(nullable = false)
    private LocalDateTime fecha = LocalDateTime.now();

    @Column(length = 255)
    private String observaciones;

    @Column(name = "liquidacion_id")
    private Long liquidacionId;
}

