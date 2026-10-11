package com.sistema.polleria.inventory.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "mermas")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Merma {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "insumo_id", nullable = false)
    private Long insumoId;

    @Column(name = "insumo_nombre", nullable = false)
    private String insumoNombre;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal cantidad;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private MotivoMerma motivo;

    @Column(length = 500)
    private String justificacion;

    @Column(name = "registrado_por", nullable = false)
    private Long registradoPor;

    @Builder.Default
    @Column(nullable = false)
    private LocalDateTime fecha = LocalDateTime.now();
}
