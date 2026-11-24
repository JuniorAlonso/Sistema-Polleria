package com.sistema.polleria.facturacion.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Registro del envío de UN comprobante a SUNAT.
 *
 * <p>Se guarda todo lo necesario para demostrar lo que se envió y lo que respondió SUNAT:
 * el XML firmado (la factura legal), el CDR (la constancia de SUNAT) y el hash (va en el ticket).
 * Si un envío falla y se reintenta, se actualiza esta misma fila.
 */
@Entity
@Table(name = "envios_sunat", indexes = {
        @Index(name = "idx_envios_sunat_estado", columnList = "estado")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EnvioSunat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Una orden tiene un solo comprobante, así que también un solo envío. */
    @Column(name = "orden_id", nullable = false, unique = true)
    private Long ordenId;

    @Column(name = "comprobante_id", nullable = false)
    private Long comprobanteId;

    /** FACTURA o BOLETA. */
    @Column(nullable = false, length = 10)
    private String tipo;

    /** Número para SUNAT, sin ceros a la izquierda: F001-1. */
    @Column(name = "serie_numero", nullable = false, unique = true, length = 20)
    private String serieNumero;

    /** RUC-TIPO-SERIE-NUMERO, ej.: 20000000001-01-F001-1. */
    @Column(name = "nombre_archivo", nullable = false, length = 60)
    private String nombreArchivo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private EstadoSunat estado;

    /** ResponseCode del CDR (0 = aceptado) o código del error SOAP. */
    @Column(name = "codigo_respuesta", length = 50)
    private String codigoRespuesta;

    @Column(name = "descripcion", length = 1000)
    private String descripcion;

    @Column(name = "observaciones", columnDefinition = "text")
    private String observaciones;

    /** DigestValue de la firma: se imprime en el ticket y va en el QR. */
    @Column(name = "hash", length = 100)
    private String hash;

    @Column(name = "xml_firmado", columnDefinition = "text")
    private String xmlFirmado;

    @Column(name = "cdr_zip", columnDefinition = "bytea")
    private byte[] cdrZip;

    // --- Copia de lo que se facturó, para imprimir el ticket sin volver a consultar otros servicios.
    @Column(name = "cliente_tipo_doc", length = 2)
    private String clienteTipoDoc;

    @Column(name = "cliente_num_doc", length = 20)
    private String clienteNumDoc;

    @Column(name = "cliente_nombre", length = 200)
    private String clienteNombre;

    @Column(name = "cliente_direccion", length = 300)
    private String clienteDireccion;

    @Column(name = "lineas_json", columnDefinition = "text")
    private String lineasJson;

    @Column(name = "total_valor_venta", precision = 12, scale = 2)
    private BigDecimal totalValorVenta;

    @Column(name = "total_igv", precision = 12, scale = 2)
    private BigDecimal totalIgv;

    @Column(name = "total", precision = 12, scale = 2)
    private BigDecimal total;

    @Column(name = "fecha_emision")
    private LocalDateTime fechaEmision;

    @Builder.Default
    @Column(nullable = false)
    private Integer intentos = 0;

    @Column(name = "enviado_en")
    private LocalDateTime enviadoEn;

    @Version
    private Long version;
}
