package com.sistema.polleria.facturacion.sunat;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Un comprobante listo para convertirse en XML: quién compra, qué compra y cuánto se paga.
 *
 * <p>Se arma a partir del comprobante que ya emitió finance-service y de los productos de la
 * orden (orders-service). Los montos de cada línea ya vienen calculados por
 * {@link CalculadoraMontos}.
 */
public record DocumentoVenta(
        TipoDocumento tipo,
        String serie,          // "F001" o "B001"
        long correlativo,      // 1, 2, 3... (SUNAT no quiere ceros a la izquierda)
        LocalDateTime fechaEmision,
        Cliente cliente,
        List<Linea> lineas,
        BigDecimal totalValorVenta,  // suma de las líneas SIN IGV (base imponible)
        BigDecimal totalIgv,         // suma del IGV de las líneas
        BigDecimal totalPagar        // lo que paga el cliente (valor venta + IGV)
) {

    /** Catálogo 01 de SUNAT: tipo de comprobante. */
    public enum TipoDocumento {
        FACTURA("01"),
        BOLETA("03");

        private final String codigo;

        TipoDocumento(String codigo) {
            this.codigo = codigo;
        }

        public String codigo() {
            return codigo;
        }
    }

    /**
     * El cliente (adquirente).
     *
     * @param tipoDocumento catálogo 06 de SUNAT: "6" = RUC, "1" = DNI, "0" = sin documento
     */
    public record Cliente(String tipoDocumento, String numeroDocumento, String nombre, String direccion) {
    }

    /**
     * Una línea del comprobante (por ejemplo "1/4 de pollo a la brasa x 2").
     *
     * @param valorUnitario  precio de UNA unidad SIN IGV (puede tener muchos decimales)
     * @param precioUnitario precio de UNA unidad CON IGV (el que ve el cliente en la carta)
     * @param valorVenta     cantidad x valor unitario, SIN IGV, redondeado a 2 decimales
     * @param igv            IGV de la línea (18 % del valor de venta)
     */
    public record Linea(
            String codigo,
            String descripcion,
            BigDecimal cantidad,
            BigDecimal valorUnitario,
            BigDecimal precioUnitario,
            BigDecimal valorVenta,
            BigDecimal igv
    ) {
        public BigDecimal total() {
            return valorVenta.add(igv);
        }
    }

    /** Ejemplo: "F001-1". Es el número que SUNAT usa para identificar el comprobante. */
    public String numeroCompleto() {
        return serie + "-" + correlativo;
    }

    /**
     * Nombre que SUNAT exige para el archivo: RUC-TIPO-SERIE-NUMERO (sin extensión).
     * Ejemplo: 20000000001-01-F001-1
     */
    public String nombreArchivo(String rucEmisor) {
        return rucEmisor + "-" + tipo.codigo() + "-" + numeroCompleto();
    }
}
