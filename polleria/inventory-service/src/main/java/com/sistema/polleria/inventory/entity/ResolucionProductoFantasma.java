package com.sistema.polleria.inventory.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** One resolution per ghost order (S9): the unique orden_id makes a second resolution impossible. */
@Entity
@Table(name = "resoluciones_pedido_fantasma",
        uniqueConstraints = @UniqueConstraint(name = "uk_resolucion_pedido_fantasma_orden", columnNames = "orden_id"))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ResolucionProductoFantasma {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "orden_id", nullable = false)
    private Long ordenId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private DestinoProductoFantasma destino;

    /** Set when the product was written off as a justified merma. */
    @Column(name = "merma_id")
    private Long mermaId;

    @Column(name = "registrado_por", nullable = false)
    private Long registradoPor;

    @Builder.Default
    @Column(nullable = false)
    private LocalDateTime fecha = LocalDateTime.now();
}
