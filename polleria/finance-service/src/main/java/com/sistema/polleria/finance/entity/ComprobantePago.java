package com.sistema.polleria.finance.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "comprobantes_pago", indexes = {
        @Index(name = "idx_comprobantes_orden_id", columnList = "orden_id"),
        @Index(name = "idx_comprobantes_serie", columnList = "serie_correlativo")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ComprobantePago {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "orden_id", nullable = false)
    private Long ordenId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TipoComprobante tipo;

    @Column(name = "serie_correlativo", nullable = false, unique = true, length = 30)
    private String serieCorrelativo;

    @Column(name = "cliente_tipo_doc", length = 10)
    private String clienteTipoDoc;

    @Column(name = "cliente_num_doc", length = 20)
    private String clienteNumDoc;

    @Column(name = "cliente_nombre", nullable = false, length = 150)
    private String clienteNombre;

    @Column(name = "cliente_direccion", length = 300)
    private String clienteDireccion;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal subtotal;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal igv;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal total;

    @Column(name = "estado_pago_texto", nullable = false, length = 50)
    private String estadoPagoTexto; // "PAGADO" o "COBRAR EN EFECTIVO: S/ XX.XX"

    @Column(name = "vuelto_entregado", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal vueltoEntregado = BigDecimal.ZERO;

    @Builder.Default
    @Column(name = "emitido_en", nullable = false)
    private LocalDateTime emitidoEn = LocalDateTime.now();

    @Column(name = "emitido_por")
    private Long emitidoPor;
}
