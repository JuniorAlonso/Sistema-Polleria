package com.sistema.polleria.inventory.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "despachos_cocina")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DespachoCocina {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "solicitante_id", nullable = false)
    private Long solicitanteId; // Chef ID o Mozo ID

    @Column(name = "solicitante_nombre")
    private String solicitanteNombre;

    @Builder.Default
    @Column(name = "fecha_despacho", nullable = false)
    private LocalDateTime fechaDespacho = LocalDateTime.now();

    @Builder.Default
    @OneToMany(mappedBy = "despacho", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DespachoItem> items = new ArrayList<>();
}
