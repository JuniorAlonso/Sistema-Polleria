package com.sistema.polleria.inventory.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Entity
@Table(name = "insumos")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Insumo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String nombre;

    @Column(name = "unidad_medida", nullable = false, length = 20)
    private String unidadMedida; // KG, UNIDAD, LITRO, PORCION

    @Column(name = "stock_actual", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal stockActual = BigDecimal.ZERO;

    @Column(name = "stock_minimo_alerta", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal stockMinimoAlerta = BigDecimal.TEN;

    @Column(name = "costo_unitario", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal costoUnitario = BigDecimal.ZERO;
}
