package com.sistema.polleria.auth.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "sanciones_cliente", indexes = {
        @Index(name = "idx_sanciones_telefono_norm", columnList = "telefono_normalizado"),
        @Index(name = "idx_sanciones_email", columnList = "email"),
        @Index(name = "idx_sanciones_ip", columnList = "ip_address")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SancionCliente {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 30)
    private String telefono;

    @Column(name = "telefono_normalizado", length = 20)
    private String telefonoNormalizado;

    @Column(length = 150)
    private String email;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(nullable = false, length = 255)
    private String motivo;

    @Column(name = "orden_id")
    private Long ordenId;

    @Column(name = "bloqueado_efectivo", nullable = false)
    @Builder.Default
    private boolean bloqueadoEfectivo = true;

    @Column(name = "bloqueado_total", nullable = false)
    @Builder.Default
    private boolean bloqueadoTotal = false;

    @Column(name = "creado_en", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime creadoEn = LocalDateTime.now();

    @Column(name = "creado_por", length = 100)
    @Builder.Default
    private String creadoPor = "SISTEMA_PEDIDO_FANTASMA";
}
