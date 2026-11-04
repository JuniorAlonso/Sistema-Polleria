package com.sistema.polleria.orders.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "mesas")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Mesa {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private Integer numero;

    @jakarta.validation.constraints.Min(value = 1, message = "La capacidad debe ser al menos 1")
    @Column(nullable = false)
    private Integer capacidad;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    @Builder.Default
    private MesaEstado estado = MesaEstado.LIBRE;

    @Column(nullable = false, length = 50)
    @Builder.Default
    private String zona = "SALON_PRINCIPAL";

    @Column(nullable = false)
    @Builder.Default
    private Boolean activo = true;

    // URL del QR generado para esta mesa
    @Column(length = 500)
    private String qrUrl;

    @jakarta.validation.constraints.Min(value = 0, message = "La posición X debe ser positiva o cero")
    @Column(name = "posicion_x")
    @Builder.Default
    private Integer posicionX = 0;

    @jakarta.validation.constraints.Min(value = 0, message = "La posición Y debe ser positiva o cero")
    @Column(name = "posicion_y")
    @Builder.Default
    private Integer posicionY = 0;

    @Version
    private Long version;
}
