package com.sistema.polleria.facturacion.sunat;

import org.w3c.dom.Document;
import org.w3c.dom.NodeList;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * PASO 4 — Envía el ZIP a SUNAT por su servicio web SOAP ({@code sendBill}).
 */
public class ClienteSunat {

    /** Servidor de PRUEBAS de SUNAT. Los comprobantes enviados aquí no tienen valor tributario. */
    public static final String URL_BETA = "https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService";
    /** Servidor REAL. Solo con RUC, usuario secundario y certificado verdaderos. */
    public static final String URL_PRODUCCION = "https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService";

    private static final Pattern CODIGO_ERROR = Pattern.compile("\\b(\\d{3,4})\\b");

    /**
     * @param cdrZip            el CDR comprimido, si SUNAT lo devolvió
     * @param codigoError       código del soap:Fault, si SUNAT rechazó el envío antes de procesarlo
     * @param mensajeError      descripción del error
     * @param errorTransitorio  true cuando el fault corresponde a servidor/autenticación (0100-0199 o Server)
     */
    public record Respuesta(byte[] cdrZip, String codigoError, String mensajeError, boolean errorTransitorio) {
        public Respuesta(byte[] cdrZip, String codigoError, String mensajeError) {
            this(cdrZip, codigoError, mensajeError, false);
        }

        public boolean tieneCdr() {
            return cdrZip != null && cdrZip.length > 0;
        }
    }

    private final HttpClient http;
    private final URI uri;
    private final String usuario;
    private final String clave;

    public ClienteSunat(String url, String usuario, String clave) {
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();
        this.uri = URI.create(url);
        this.usuario = usuario;
        this.clave = clave;
    }

    public Respuesta enviarFactura(String nombreZip, byte[] zip) {
        try {
            String sobre = sobreSoap(nombreZip, Base64.getEncoder().encodeToString(zip));
            HttpRequest peticion = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(60))
                    .header("Content-Type", "text/xml; charset=UTF-8")
                    .header("SOAPAction", "urn:sendBill")
                    .POST(HttpRequest.BodyPublishers.ofString(sobre, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> respuesta = http.send(peticion, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            int status = respuesta.statusCode();
            if (status == 502 || status == 503 || status == 504) {
                throw new SunatNoDisponibleException("SUNAT respondió HTTP " + status, null);
            }
            if (status >= 400 && status != 500) {
                throw new SunatNoDisponibleException("SUNAT respondió HTTP inesperado " + status, null);
            }
            return interpretar(respuesta.body());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new SunatNoDisponibleException("Se interrumpió el envío a SUNAT", e);
        } catch (SunatNoDisponibleException e) {
            throw e;
        } catch (Exception e) {
            throw new SunatNoDisponibleException("No se pudo conectar con SUNAT: " + e.getMessage(), e);
        }
    }

    /** Arma el sobre SOAP. El usuario y la clave van en el header WS-Security. */
    String sobreSoap(String nombreZip, String zipBase64) {
        return "<soapenv:Envelope xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\""
                + " xmlns:ser=\"http://service.sunat.gob.pe\""
                + " xmlns:wsse=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd\">"
                + "<soapenv:Header><wsse:Security><wsse:UsernameToken>"
                + "<wsse:Username>" + GeneradorXmlUbl.esc(usuario) + "</wsse:Username>"
                + "<wsse:Password>" + GeneradorXmlUbl.esc(clave) + "</wsse:Password>"
                + "</wsse:UsernameToken></wsse:Security></soapenv:Header>"
                + "<soapenv:Body><ser:sendBill>"
                + "<fileName>" + GeneradorXmlUbl.esc(nombreZip) + "</fileName>"
                + "<contentFile>" + zipBase64 + "</contentFile>"
                + "</ser:sendBill></soapenv:Body></soapenv:Envelope>";
    }

    static Respuesta interpretar(String cuerpo) {
        if (cuerpo == null || cuerpo.isBlank()) {
            throw new SunatNoDisponibleException("SUNAT respondió vacío", null);
        }
        Document doc;
        try {
            doc = FirmadorXml.leer(cuerpo);
        } catch (Exception e) {
            throw new SunatNoDisponibleException("SUNAT respondió algo que no es XML (¿servidor caído?)", e);
        }
        String cdr = texto(doc, "applicationResponse");
        if (cdr != null) {
            byte[] bytes = Base64.getMimeDecoder().decode(cdr.trim());
            if (bytes.length == 0) {
                throw new SunatNoDisponibleException("SUNAT devolvió un CDR vacío", null);
            }
            return new Respuesta(bytes, null, null, false);
        }
        String codigo = texto(doc, "faultcode");
        String mensaje = texto(doc, "faultstring");
        if (codigo == null && mensaje == null) {
            throw new SunatNoDisponibleException("Respuesta de SUNAT no reconocida", null);
        }

        String numero = extraerCodigo(codigo);
        if ((numero == null || !numero.matches("\\d{3,4}")) && mensaje != null) {
            String desdeMensaje = extraerCodigo(mensaje);
            if (desdeMensaje != null) {
                numero = desdeMensaje;
            }
        }
        if (numero == null) {
            numero = codigo;
        }
        boolean transitorio = esFalloTransitorio(codigo, numero);
        return new Respuesta(null, numero, mensaje, transitorio);
    }

    private static String extraerCodigo(String texto) {
        if (texto == null) {
            return null;
        }
        Matcher m = CODIGO_ERROR.matcher(texto);
        return m.find() ? m.group(1) : null;
    }

    private static boolean esFalloTransitorio(String faultCode, String numero) {
        if (faultCode != null && faultCode.toLowerCase(Locale.ROOT).contains("server")) {
            return true;
        }
        if (numero != null && numero.matches("\\d{4}")) {
            int cod = Integer.parseInt(numero);
            return cod >= 100 && cod <= 199;
        }
        return false;
    }

    static String texto(Document doc, String nombreLocal) {
        NodeList nodos = doc.getElementsByTagNameNS("*", nombreLocal);
        return nodos.getLength() == 0 ? null : nodos.item(0).getTextContent();
    }

    public static class SunatNoDisponibleException extends RuntimeException {
        public SunatNoDisponibleException(String mensaje, Throwable causa) {
            super(mensaje, causa);
        }
    }
}
