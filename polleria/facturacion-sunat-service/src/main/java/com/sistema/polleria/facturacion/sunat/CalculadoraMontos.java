package com.sistema.polleria.facturacion.sunat;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/**
 * Separa el IGV de los precios de la carta.
 *
 * <p>En la pollería los precios ya incluyen IGV (un 1/4 de pollo cuesta S/ 23.60 "todo incluido").
 * SUNAT, en cambio, pide cada línea con dos datos por separado: el valor SIN IGV y el IGV.
 * Ejemplo con S/ 23.60:
 * <pre>
 *   valor venta = 23.60 / 1.18 = 20.00
 *   IGV         = 23.60 - 20.00 = 3.60
 * </pre>
 * El IGV se saca como resta (y no como 20.00 x 0.18) para que valor + IGV sea EXACTAMENTE el
 * precio de la carta y no aparezca un céntimo de diferencia por redondeo.
 */
public final class CalculadoraMontos {

    /** IGV vigente en Perú: 18 %. */
    public static final BigDecimal TASA_IGV = new BigDecimal("0.18");
    private static final BigDecimal FACTOR_IGV = BigDecimal.ONE.add(TASA_IGV); // 1.18

    private CalculadoraMontos() {
    }

    /** Un producto de la orden tal como viene de orders-service (precio con IGV). */
    public record ItemConIgv(String codigo, String descripcion, BigDecimal cantidad, BigDecimal precioUnitarioConIgv) {
    }

    /** Resultado: las líneas para el XML y los totales del comprobante. */
    public record Resultado(List<DocumentoVenta.Linea> lineas, BigDecimal totalValorVenta,
                            BigDecimal totalIgv, BigDecimal totalPagar) {
    }

    /**
     * Calcula las líneas del comprobante.
     *
     * @param items       productos de la orden
     * @param totalCobrado total que registró finance-service. Si es mayor que la suma de los productos
     *                     (por ejemplo, por el costo de delivery), la diferencia se agrega como una línea
     *                     "SERVICIO DE DELIVERY" para que el XML cuadre con lo que se cobró.
     */
    public static Resultado calcular(List<ItemConIgv> items, BigDecimal totalCobrado) {
        List<DocumentoVenta.Linea> lineas = new ArrayList<>();
        BigDecimal sumaItems = BigDecimal.ZERO;

        for (ItemConIgv item : items) {
            if (item == null || item.descripcion() == null || item.descripcion().isBlank()) {
                throw new IllegalArgumentException("Todos los ítems del comprobante deben tener descripción");
            }
            if (item.cantidad() == null || item.cantidad().signum() <= 0) {
                throw new IllegalArgumentException("Cantidad inválida en " + item.descripcion());
            }
            if (item.precioUnitarioConIgv() == null || item.precioUnitarioConIgv().signum() <= 0) {
                throw new IllegalArgumentException("Precio unitario inválido en " + item.descripcion());
            }
            BigDecimal totalLinea = item.cantidad().multiply(item.precioUnitarioConIgv())
                    .setScale(2, RoundingMode.HALF_UP);
            lineas.add(linea(item.codigo(), item.descripcion(), item.cantidad(), totalLinea, item.precioUnitarioConIgv()));
            sumaItems = sumaItems.add(totalLinea);
        }

        if (totalCobrado != null) {
            BigDecimal total = totalCobrado.setScale(2, RoundingMode.HALF_UP);
            int comparacion = total.compareTo(sumaItems);
            if (comparacion > 0) {
                BigDecimal diferencia = total.subtract(sumaItems);
                String descripcion = lineas.isEmpty() ? "CONSUMO EN EL SAN POLLO" : "SERVICIO DE DELIVERY";
                lineas.add(linea("SERV", descripcion, BigDecimal.ONE, diferencia, diferencia));
            } else if (comparacion < 0) {
                throw new IllegalStateException("El total cobrado (S/ " + total + ") es menor que la suma de los productos (S/ "
                        + sumaItems + "). Los descuentos todavía no están soportados en la facturación electrónica.");
            }
        }

        if (lineas.isEmpty()) {
            throw new IllegalStateException("El comprobante no tiene productos ni monto");
        }

        BigDecimal totalValor = BigDecimal.ZERO;
        BigDecimal totalIgv = BigDecimal.ZERO;
        for (DocumentoVenta.Linea l : lineas) {
            totalValor = totalValor.add(l.valorVenta());
            totalIgv = totalIgv.add(l.igv());
        }
        return new Resultado(lineas, totalValor, totalIgv, totalValor.add(totalIgv));
    }

    private static DocumentoVenta.Linea linea(String codigo, String descripcion, BigDecimal cantidad,
                                              BigDecimal totalConIgv, BigDecimal precioUnitarioConIgv) {
        BigDecimal valorVenta = totalConIgv.divide(FACTOR_IGV, 2, RoundingMode.HALF_UP);
        BigDecimal igv = totalConIgv.subtract(valorVenta);
        // El valor unitario puede tener hasta 10 decimales en el XML (SUNAT lo permite).
        BigDecimal valorUnitario = valorVenta.divide(cantidad, 10, RoundingMode.HALF_UP);
        return new DocumentoVenta.Linea(codigo, descripcion, cantidad, valorUnitario,
                precioUnitarioConIgv.setScale(2, RoundingMode.HALF_UP), valorVenta, igv);
    }
}
