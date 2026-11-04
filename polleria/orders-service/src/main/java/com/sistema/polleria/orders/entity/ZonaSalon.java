package com.sistema.polleria.orders.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Entity
@Table(name = "zonas_salon")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ZonaSalon {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Column(nullable = false, unique = true, length = 50)
    private String slug;

    @NotBlank
    @Column(nullable = false, length = 100)
    private String nombre;

    @Min(1)
    @Column(nullable = false)
    @Builder.Default
    private Integer filas = 4;

    @Min(1)
    @Column(nullable = false)
    @Builder.Default
    private Integer columnas = 5;

    @Column(length = 50)
    @Builder.Default
    private String color = "border-polleria-gold/40";

    @Column(nullable = false)
    @Builder.Default
    private Integer orden = 1;

    @Column(nullable = false)
    @Builder.Default
    private Boolean activo = true;
}
