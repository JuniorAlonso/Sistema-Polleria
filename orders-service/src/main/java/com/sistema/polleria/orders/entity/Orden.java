package com.sistema.polleria.orders.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "ordenes")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Orden {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private OrdenTipo tipo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private OrdenEstado estado = OrdenEstado.RECIBIDO;

    // ID del cliente (viene del JWT, no FK cruzado entre microservicios)
    private Long clienteId;

    // ID del mozo que tomó el pedido (salón)
    private Long mozoId;

    // ID del repartidor asignado (delivery)
    private Long repartidorId;

    // Referencia a la mesa (salón)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mesa_id")
    private Mesa mesa;

    // Datos delivery
    @Column(length = 300)
    private String direccionEntrega;

    @Column(length = 200)
    private String referencia;

    @Column(length = 100)
    private String nombreCliente;

    @Column(length = 20)
    private String telefonoCliente;

    @Column(nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal total = BigDecimal.ZERO;

    @Column(length = 500)
    private String observaciones;

    @Column(nullable = false, updatable = false)
    private LocalDateTime creadoEn;

    private LocalDateTime actualizadoEn;

    @OneToMany(mappedBy = "orden", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<OrdenItem> items = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        creadoEn = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        actualizadoEn = LocalDateTime.now();
    }

    public void recalcularTotal() {
        this.total = items.stream()
                .map(OrdenItem::getSubtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
