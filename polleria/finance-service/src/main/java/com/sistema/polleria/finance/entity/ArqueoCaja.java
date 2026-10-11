package com.sistema.polleria.finance.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "arqueos_caja")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ArqueoCaja {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "usuario_id", nullable = false)
    private Long usuarioId;

    @Column(name = "usuario_nombre")
    private String usuarioNombre;

    @Builder.Default
    @Column(name = "fecha_apertura", nullable = false)
    private LocalDateTime fechaApertura = LocalDateTime.now();

    @Column(name = "monto_apertura", nullable = false, precision = 10, scale = 2)
    private BigDecimal montoApertura;

    @Column(name = "fecha_cierre")
    private LocalDateTime fechaCierre;

    @Column(name = "monto_cierre_efectivo", precision = 10, scale = 2)
    private BigDecimal montoCierreEfectivo;

    @Column(name = "monto_cierre_pos", precision = 10, scale = 2)
    private BigDecimal montoCierrePos;

    @Column(name = "ventas_digitales", precision = 10, scale = 2)
    private BigDecimal ventasDigitales;

    @Column(name = "total_esperado", precision = 10, scale = 2)
    private BigDecimal totalEsperado;

    @Column(name = "diferencia", precision = 10, scale = 2)
    private BigDecimal diferencia;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private EstadoCaja estado = EstadoCaja.ABIERTA;

    @Column(length = 1000)
    private String observaciones;
}
