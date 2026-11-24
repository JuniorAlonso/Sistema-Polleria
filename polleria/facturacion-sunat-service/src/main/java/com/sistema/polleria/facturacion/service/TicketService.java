package com.sistema.polleria.facturacion.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.sistema.polleria.facturacion.entity.EnvioSunat;
import com.sistema.polleria.facturacion.sunat.DocumentoVenta;
import com.sistema.polleria.facturacion.sunat.Emisor;
import com.sistema.polleria.facturacion.sunat.NumeroALetras;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * PASO 6 — Representación impresa (ticket 80 mm con código QR SUNAT y hash).
 */
@Service
@RequiredArgsConstructor
public class TicketService {

    private static final DateTimeFormatter FECHA_QR = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter FECHA_TICKET = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    private static final ZoneId ZONA_LIMA = ZoneId.of("America/Lima");

    private final Emisor emisor;

    public String contenidoQr(EnvioSunat e) {
        if (e.getSerieNumero() == null || !e.getSerieNumero().contains("-")) {
            throw new IllegalStateException("Serie-número inválido para generar el QR");
        }
        String[] serieNumero = e.getSerieNumero().split("-", 2);
        String tipo = "FACTURA".equals(e.getTipo()) ? "01" : "03";
        LocalDateTime fecha = fechaSegura(e);
        String tipoDoc = e.getClienteTipoDoc() == null ? "-" : e.getClienteTipoDoc();
        String numDoc = e.getClienteNumDoc() == null ? "-" : e.getClienteNumDoc();
        String hash = e.getHash() == null ? "" : e.getHash();
        return String.join("|",
                emisor.ruc(), tipo, serieNumero[0], serieNumero[1],
                dos(e.getTotalIgv()), dos(e.getTotal()),
                fecha.format(FECHA_QR),
                tipoDoc, numDoc, hash) + "|";
    }

    public String qrSvg(String contenido) {
        try {
            BitMatrix m = new QRCodeWriter().encode(contenido, BarcodeFormat.QR_CODE, 0, 0,
                    Map.of(EncodeHintType.MARGIN, 1, EncodeHintType.CHARACTER_SET, "UTF-8"));
            StringBuilder svg = new StringBuilder();
            svg.append("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 ").append(m.getWidth()).append(' ')
                    .append(m.getHeight()).append("\" width=\"150\" height=\"150\" shape-rendering=\"crispEdges\">")
                    .append("<rect width=\"100%\" height=\"100%\" fill=\"#fff\"/><path fill=\"#000\" d=\"");
            for (int y = 0; y < m.getHeight(); y++) {
                for (int x = 0; x < m.getWidth(); x++) {
                    if (m.get(x, y)) {
                        svg.append('M').append(x).append(' ').append(y).append("h1v1h-1z");
                    }
                }
            }
            return svg.append("\"/></svg>").toString();
        } catch (Exception ex) {
            throw new IllegalStateException("No se pudo generar el código QR", ex);
        }
    }

    public String html(EnvioSunat e, List<DocumentoVenta.Linea> lineas) {
        boolean factura = "FACTURA".equals(e.getTipo());
        String titulo = factura ? "FACTURA ELECTRÓNICA" : "BOLETA DE VENTA ELECTRÓNICA";
        String tipoDoc = e.getClienteTipoDoc() == null ? "-" : e.getClienteTipoDoc();
        String tipoDocCliente = switch (tipoDoc) {
            case "6" -> "RUC";
            case "1" -> "DNI";
            default -> "DOC";
        };
        BigDecimal total = e.getTotal() == null ? BigDecimal.ZERO : e.getTotal();

        StringBuilder filas = new StringBuilder();
        for (DocumentoVenta.Linea l : lineas) {
            filas.append("<tr><td>").append(l.cantidad().stripTrailingZeros().toPlainString()).append("</td><td>")
                    .append(h(l.descripcion())).append("</td><td class=\"r\">")
                    .append(dos(l.precioUnitario())).append("</td><td class=\"r\">")
                    .append(dos(l.total())).append("</td></tr>");
        }

        return """
                <!DOCTYPE html>
                <html lang="es"><head><meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
                <title>%s</title>
                <style>
                  body{font-family:monospace;width:72mm;margin:0 auto;font-size:12px}
                  .c{text-align:center}.r{text-align:right}hr{border:0;border-top:1px dashed #000}
                  table{width:100%%;border-collapse:collapse}td{vertical-align:top;padding:1px 0}
                  @media print{@page{size:80mm auto;margin:2mm}}
                </style></head><body>
                <div class="c"><b>%s</b><br>%s<br>RUC %s<br>%s</div><hr>
                <div class="c"><b>%s</b><br><b>%s</b></div><hr>
                Fecha: %s<br>%s: %s<br>Cliente: %s<br>%s
                <hr><table><tr><td>Cant</td><td>Descripción</td><td class="r">P.U.</td><td class="r">Total</td></tr>%s</table><hr>
                <table>
                  <tr><td>Op. gravada</td><td class="r">S/ %s</td></tr>
                  <tr><td>IGV 18%%</td><td class="r">S/ %s</td></tr>
                  <tr><td><b>TOTAL</b></td><td class="r"><b>S/ %s</b></td></tr>
                </table>
                <p>SON: %s</p>
                <div class="c">%s<br><small>Hash: %s</small><br>
                <small>Representación impresa de la %s.<br>Consulte su validez en sunat.gob.pe</small><br>
                <small>Estado SUNAT: %s</small></div>
                </body></html>
                """.formatted(
                h(e.getSerieNumero()),
                h(emisor.nombreComercial()), h(emisor.razonSocial()), h(emisor.ruc()), h(emisor.direccion()),
                titulo, h(e.getSerieNumero()),
                fechaSegura(e).format(FECHA_TICKET), tipoDocCliente, h(e.getClienteNumDoc()), h(e.getClienteNombre()),
                e.getClienteDireccion() == null || e.getClienteDireccion().isBlank() ? "" : "Dirección: " + h(e.getClienteDireccion()),
                filas,
                dos(e.getTotalValorVenta()), dos(e.getTotalIgv()), dos(total),
                h(NumeroALetras.soles(total)),
                qrSvg(contenidoQr(e)), h(e.getHash()),
                titulo.toLowerCase(), e.getEstado());
    }

    private static LocalDateTime fechaSegura(EnvioSunat e) {
        if (e.getFechaEmision() != null) {
            return e.getFechaEmision();
        }
        return e.getEnviadoEn() != null ? e.getEnviadoEn() : LocalDateTime.now(ZONA_LIMA);
    }

    private static String dos(BigDecimal v) {
        return v == null ? "0.00" : v.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    static String h(String s) {
        return s == null ? "" : s
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
