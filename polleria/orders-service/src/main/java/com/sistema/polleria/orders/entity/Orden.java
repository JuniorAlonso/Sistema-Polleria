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

    // Número de pedido que ve el cliente: 1, 2, 3... por cada cliente (o por celular si es invitado)
    private Integer numeroCliente;

    // ID del mozo que tomó el pedido (salón)
    private Long mozoId;

    // ID del repartidor asignado (delivery)
    private Long repartidorId;

    // Marca de «el mozo ya entregó el pedido en mesa». No es un estado nuevo: el cobro
    // (LISTO → ENTREGADO) sigue siendo el único evento que libera la mesa.
    private LocalDateTime servidoEn;
    private Long servidoPor;

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

    /**
     * Celular en forma canónica, derivado de {@code telefonoCliente}. Existe para que el índice
     * único de numeración compare el mismo cliente aunque el número se haya escrito con
     * formatos distintos (938924552, +51 938 924 552, (01) 938924552).
     */
    @Column(name = "telefono_normalizado", length = 20)
    private String telefonoNormalizado;

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

    /**
     * Bloqueo optimista: dos PATCH /ordenes/{id}/estado simultáneos sobre la misma orden
     * hacían leer→validar→escribir sin control, permitiendo actualizaciones perdidas y que
     * dos transiciones mutuamente excluyentes pasaran ambas. Con @Version, la segunda
     * transacción recibe un conflicto (HTTP 409) en lugar de sobrescribir a la primera.
     */
    @Version
    private Long version;

    @PrePersist
    protected void onCreate() {
        creadoEn = LocalDateTime.now();
        telefonoNormalizado = com.sistema.polleria.orders.util.TelefonoUtil.canonico(telefonoCliente);
    }

    @PreUpdate
    protected void onUpdate() {
        actualizadoEn = LocalDateTime.now();
        telefonoNormalizado = com.sistema.polleria.orders.util.TelefonoUtil.canonico(telefonoCliente);
    }

    public static final BigDecimal COSTO_DELIVERY = new BigDecimal("6.00");

    public void recalcularTotal() {
        BigDecimal subtotal = items.stream()
                .map(OrdenItem::getSubtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (tipo == OrdenTipo.DELIVERY && subtotal.compareTo(BigDecimal.ZERO) > 0) {
            this.total = subtotal.add(COSTO_DELIVERY);
        } else {
            this.total = subtotal;
        }
    }
}
