package com.sistema.polleria.facturacion.sunat;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * PASO 5 — Lee el CDR (Constancia de Recepción) que devuelve SUNAT.
 *
 * <p>El CDR es otro XML (ApplicationResponse), firmado por SUNAT, con la respuesta oficial:
 * <ul>
 *   <li>{@code ResponseCode = 0}: ACEPTADO. El comprobante ya es válido.</li>
 *   <li>{@code ResponseCode >= 4000}: ACEPTADO con observaciones (válido, pero hay algo que mejorar).</li>
 *   <li>{@code ResponseCode 2000 a 3999}: RECHAZADO. El comprobante no existe para SUNAT; hay que
 *       corregir el error y volver a enviarlo.</li>
 * </ul>
 * El CDR es la prueba legal de que SUNAT recibió el comprobante: hay que guardarlo.
 */
public final class LectorCdr {

    public enum Estado {ACEPTADO, OBSERVADO, RECHAZADO}

    /**
     * @param codigo         ResponseCode del CDR
     * @param descripcion    mensaje de SUNAT ("La Factura numero F001-1, ha sido aceptada")
     * @param observaciones  notas adicionales (códigos 4000+), si las hay
     */
    public record Resultado(Estado estado, String codigo, String descripcion, List<String> observaciones) {
    }

    private LectorCdr() {
    }

    public static Resultado leer(byte[] cdrZip) {
        byte[] xml = Zip.extraerXml(cdrZip);
        Document doc;
        try {
            doc = FirmadorXml.leer(new String(xml, StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException("El CDR de SUNAT no es un XML válido", e);
        }
        String codigo = valor(doc, "ResponseCode");
        String descripcion = valor(doc, "Description");
        if (codigo == null) {
            throw new IllegalStateException("El CDR no trae ResponseCode");
        }
        List<String> observaciones = new ArrayList<>();
        // Las cbc:Note hijas directas de ApplicationResponse son las observaciones.
        NodeList hijos = doc.getDocumentElement().getChildNodes();
        for (int i = 0; i < hijos.getLength(); i++) {
            Node n = hijos.item(i);
            if (n instanceof Element e && "Note".equals(e.getLocalName())) {
                observaciones.add(e.getTextContent().trim());
            }
        }
        return new Resultado(estadoDe(codigo.trim(), observaciones), codigo.trim(),
                descripcion == null ? "" : descripcion.trim(), observaciones);
    }

    static Estado estadoDe(String codigo, List<String> observaciones) {
        int numero;
        try {
            numero = Integer.parseInt(codigo);
        } catch (NumberFormatException e) {
            return Estado.RECHAZADO;
        }
        if (numero == 0) {
            return observaciones.isEmpty() ? Estado.ACEPTADO : Estado.OBSERVADO;
        }
        if (numero >= 4000) {
            return Estado.OBSERVADO;
        }
        return Estado.RECHAZADO;
    }

    private static String valor(Document doc, String nombreLocal) {
        NodeList nodos = doc.getElementsByTagNameNS("*", nombreLocal);
        return nodos.getLength() == 0 ? null : nodos.item(0).getTextContent();
    }
}
