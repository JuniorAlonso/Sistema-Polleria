package com.sistema.polleria.inventory.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Entity
@Table(name = "despacho_items")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DespachoItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "despacho_id")
    @JsonIgnore
    private DespachoCocina despacho;

    @Column(name = "insumo_id", nullable = false)
    private Long insumoId;

    @Column(name = "insumo_nombre", nullable = false)
    private String insumoNombre;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal cantidad;

    @Column(length = 255)
    private String observaciones;
}
