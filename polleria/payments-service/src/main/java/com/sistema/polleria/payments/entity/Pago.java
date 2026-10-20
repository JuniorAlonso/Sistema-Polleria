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
    @Column(nullable = false, length = 30)
    private EstadoPago estado = EstadoPago.PENDIENTE;

    /** Referencia externa de la pasarela (código de transacción, código Yape, etc.) */
    @Column(name = "referencia_externa", length = 100)
    private String referenciaExterna;

    /** Detalle del resultado de la pasarela o motivo de rechazo */
    @Column(length = 500)
    private String detalle;

    /** URL de redirección a checkout (p.ej. Checkout Pro de Mercado Pago) */
    @Column(name = "checkout_url", length = 500)
    private String checkoutUrl;

    /**
     * Referencia opaca al comprobante de Yape en el bucket (la clave del objeto), no el archivo.
     * payments-service no guarda la imagen: la sube el notification-service (T6b) y el admin la
     * verifica (T6c). Nullable: los pagos que ya existen no se rompen.
     */
    @Column(name = "comprobante_clave", length = 300)
    private String comprobanteClave;

    /** Administrador que aprobó o rechazó el comprobante (T6c). Nullable. */
    @Column(name = "verificado_por", length = 100)
    private String verificadoPor;

    /** Momento de la verificación del comprobante (T6c). Nullable. */
    @Column(name = "verificado_en")
    private LocalDateTime verificadoEn;

    /** Motivo por el que el administrador rechazó el comprobante (T6c). Nullable. */
    @Column(name = "motivo_rechazo", length = 300)
    private String motivoRechazo;

    @Column(name = "creado_en", nullable = false, updatable = false)
    private LocalDateTime creadoEn = LocalDateTime.now();

    @Column(name = "actualizado_en")
    private LocalDateTime actualizadoEn;

    /**
     * Bloqueo optimista: dos transiciones simultáneas sobre el mismo pago (por ejemplo un
     * webhook de Mercado Pago y una confirmación manual del cajero) provocaban
     * actualizaciones perdidas. Con @Version la segunda recibe un conflicto.
     */
    @Version
    private Long version;

    @PreUpdate
    void preUpdate() {
        this.actualizadoEn = LocalDateTime.now();
    }
}
