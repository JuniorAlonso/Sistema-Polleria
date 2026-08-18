package com.sistema.polleria.payments.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "pagos", indexes = {
    @Index(name = "idx_pagos_orden_id", columnList = "orden_id"),
    @Index(name = "idx_pagos_estado", columnList = "estado"),
    @Index(name = "idx_pagos_cliente_id", columnList = "cliente_id")
})
@Data
@NoArgsConstructor
public class Pago {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** ID de la orden en orders-service — sin FK (microservicio independiente) */
    @Column(name = "orden_id", nullable = false)
    private Long ordenId;

    @Column(name = "cliente_id", nullable = false)
    private Long clienteId;

    @Column(nullable = false)
    private BigDecimal monto;

    @Enumerated(EnumType.STRING)
    @Column(name = "metodo_pago", nullable = false, length = 20)
    private MetodoPago metodoPago;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EstadoPago estado = EstadoPago.PENDIENTE;

    /** Referencia externa de la pasarela (código de transacción, código Yape, etc.) */
    @Column(name = "referencia_externa", length = 100)
    private String referenciaExterna;

    /** Detalle del resultado de la pasarela o motivo de rechazo */
    @Column(length = 500)
    private String detalle;

    @Column(name = "creado_en", nullable = false, updatable = false)
    private LocalDateTime creadoEn = LocalDateTime.now();

    @Column(name = "actualizado_en")
    private LocalDateTime actualizadoEn;

    @PreUpdate
    void preUpdate() {
        this.actualizadoEn = LocalDateTime.now();
    }
}
