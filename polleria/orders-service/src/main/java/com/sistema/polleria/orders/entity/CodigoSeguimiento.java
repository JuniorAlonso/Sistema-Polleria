package com.sistema.polleria.orders.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Código de 4 dígitos enviado por WhatsApp para que un cliente
 * vea sus pedidos sin iniciar sesión.
 */
@Entity
@Table(name = "codigos_seguimiento", indexes = @Index(name = "idx_codigo_seguimiento_tel", columnList = "telefono"))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CodigoSeguimiento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Celular normalizado a 9 dígitos
    @Column(nullable = false, length = 9)
    private String telefono;

    @Column(nullable = false, length = 4)
    private String codigo;

    @Column(nullable = false)
    private LocalDateTime expiraEn;

    @Builder.Default
    private int intentos = 0;

    @Builder.Default
    private boolean usado = false;

    @Column(nullable = false)
    private LocalDateTime creadoEn;

    @PrePersist
    protected void onCreate() {
        if (creadoEn == null) creadoEn = LocalDateTime.now();
    }

    public boolean isExpirado() {
        return LocalDateTime.now().isAfter(expiraEn);
    }
}
