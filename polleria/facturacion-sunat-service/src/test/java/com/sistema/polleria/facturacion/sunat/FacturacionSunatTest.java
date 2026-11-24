package com.sistema.polleria.facturacion.sunat;

import org.junit.jupiter.api.Test;
import org.w3c.dom.Document;
import org.w3c.dom.NodeList;

import javax.xml.crypto.dsig.XMLSignature;
import javax.xml.crypto.dsig.XMLSignatureFactory;
import javax.xml.crypto.dsig.dom.DOMValidateContext;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.junit.jupiter.api.Assertions.*;

class FacturacionSunatTest {

    private static final Emisor EMISOR = new Emisor(
            "20608945123", "POLLERIA SAN POLLO DE ICA S.A.C.", "POLLERIA SAN POLLO DE ICA",
            "AV. SAN MARTIN 456", "110101", "ICA", "ICA", "ICA");

    @Test
    void separaElIgvDeLosPreciosYAgregaDeliveryParaCuadrarConElTotal() {
        var items = List.of(
                new CalculadoraMontos.ItemConIgv("P1", "1/4 de pollo a la brasa", BigDecimal.valueOf(2), new BigDecimal("23.60")),
                new CalculadoraMontos.ItemConIgv("P2", "Inca Kola 1.5L", BigDecimal.ONE, new BigDecimal("11.80"))
        );
        CalculadoraMontos.Resultado r = CalculadoraMontos.calcular(items, new BigDecimal("65.00"));

        assertEquals(3, r.lineas().size());
        assertEquals("SERVICIO DE DELIVERY", r.lineas().get(2).descripcion());
        assertEquals(new BigDecimal("65.00"), r.totalPagar());
        assertEquals(r.totalPagar(), r.totalValorVenta().add(r.totalIgv()));
    }

    @Test
    void rechazaDescuentosPrecioCeroODescripcionVacia() {
        var items = List.of(new CalculadoraMontos.ItemConIgv("P1", "Pollo", BigDecimal.ONE, new BigDecimal("50.00")));
        assertThrows(IllegalStateException.class, () -> CalculadoraMontos.calcular(items, new BigDecimal("40.00")));

        assertThrows(IllegalArgumentException.class, () -> CalculadoraMontos.calcular(
                List.of(new CalculadoraMontos.ItemConIgv("P1", "Pollo", BigDecimal.ONE, BigDecimal.ZERO)), null));
        assertThrows(IllegalArgumentException.class, () -> CalculadoraMontos.calcular(
                List.of(new CalculadoraMontos.ItemConIgv("P1", "   ", BigDecimal.ONE, new BigDecimal("10.00"))), null));
    }

    @Test
    void numeroALetrasValidaNegativosYNulosYFormateaCasosBorde() {
        assertEquals("CERO CON 00/100 SOLES", NumeroALetras.soles(BigDecimal.ZERO));
        assertEquals("CIEN CON 05/100 SOLES", NumeroALetras.soles(new BigDecimal("100.05")));
        assertEquals("VEINTIUN MIL UNO CON 50/100 SOLES", NumeroALetras.soles(new BigDecimal("21001.50")));
        assertEquals("UN MILLON CON 00/100 SOLES", NumeroALetras.soles(new BigDecimal("1000000.00")));
        assertThrows(IllegalArgumentException.class, () -> NumeroALetras.soles(null));
        assertThrows(IllegalArgumentException.class, () -> NumeroALetras.soles(new BigDecimal("-0.50")));
    }

    @Test
    void generaXmlUblYFirmaValidaQueDetectaCualquierAlteracion() throws Exception {
        var items = List.of(
                new CalculadoraMontos.ItemConIgv("P1", "Pollo entero + papas + gaseosa", BigDecimal.ONE, new BigDecimal("69.90")),
                new CalculadoraMontos.ItemConIgv("P2", "Delivery", BigDecimal.ONE, new BigDecimal("6.00"))
        );
        CalculadoraMontos.Resultado r = CalculadoraMontos.calcular(items, new BigDecimal("75.90"));
        DocumentoVenta doc = new DocumentoVenta(
                DocumentoVenta.TipoDocumento.FACTURA, "F001", 1,
                LocalDateTime.of(2026, 11, 22, 19, 40),
                new DocumentoVenta.Cliente("6", "20123456789", "CLIENTE <PRUEBA> SAC", "Ica"),
                r.lineas(), r.totalValorVenta(), r.totalIgv(), r.totalPagar());

        assertEquals("20608945123-01-F001-1", doc.nombreArchivo(EMISOR.ruc()));

        String xml = GeneradorXmlUbl.generar(EMISOR, doc);
        assertTrue(xml.contains("<cbc:ID>F001-1</cbc:ID>"));
        assertTrue(xml.contains("CLIENTE &lt;PRUEBA&gt; SAC"), "los caracteres especiales se escapan");
        assertTrue(xml.contains("<cbc:PayableAmount currencyID=\"PEN\">75.90</cbc:PayableAmount>"));

        Certificado cert;
        try (InputStream p12 = getClass().getResourceAsStream("/certificado-prueba.p12")) {
            cert = Certificado.desde(p12, "prueba123");
        }
        for (FirmadorXml.Algoritmo algoritmo : FirmadorXml.Algoritmo.values()) {
            FirmadorXml.Resultado firmado = new FirmadorXml(cert, algoritmo).firmar(xml);
            assertNotNull(firmado.hash());

            DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
            dbf.setNamespaceAware(true);
            Document d = dbf.newDocumentBuilder().parse(new ByteArrayInputStream(firmado.xmlFirmado()));
            NodeList firmas = d.getElementsByTagNameNS(XMLSignature.XMLNS, "Signature");
            assertEquals(1, firmas.getLength());
            assertEquals("ExtensionContent", firmas.item(0).getParentNode().getLocalName());

            DOMValidateContext ctx = new DOMValidateContext(cert.certificado().getPublicKey(), firmas.item(0));
            ctx.setProperty("org.jcp.xml.dsig.secureValidation", Boolean.FALSE);
            XMLSignature firma = XMLSignatureFactory.getInstance("DOM").unmarshalXMLSignature(ctx);
            assertTrue(firma.validate(ctx), "la firma " + algoritmo + " debe verificarse con el certificado");

            String alterado = new String(firmado.xmlFirmado(), StandardCharsets.UTF_8).replace(">75.90<", ">1.00<");
            Document d2 = dbf.newDocumentBuilder().parse(new ByteArrayInputStream(alterado.getBytes(StandardCharsets.UTF_8)));
            NodeList firmas2 = d2.getElementsByTagNameNS(XMLSignature.XMLNS, "Signature");
            DOMValidateContext ctx2 = new DOMValidateContext(cert.certificado().getPublicKey(), firmas2.item(0));
            ctx2.setProperty("org.jcp.xml.dsig.secureValidation", Boolean.FALSE);
            assertFalse(XMLSignatureFactory.getInstance("DOM").unmarshalXMLSignature(ctx2).validate(ctx2));
        }
    }

    @Test
    void cargaCertificadoDesdeBase64() throws Exception {
        byte[] p12Bytes;
        try (InputStream p12 = getClass().getResourceAsStream("/certificado-prueba.p12")) {
            assertNotNull(p12);
            p12Bytes = p12.readAllBytes();
        }
        String b64 = Base64.getEncoder().encodeToString(p12Bytes);
        Certificado cert = Certificado.desdeBase64(b64, "prueba123");
        assertNotNull(cert.clavePrivada());
        assertNotNull(cert.certificado());
    }

    @Test
    void zipProtegeContraNulosEntradasExcesivasYZipBomb() throws Exception {
        assertThrows(IllegalStateException.class, () -> Zip.extraerXml(null));
        assertThrows(IllegalStateException.class, () -> Zip.extraerXml(new byte[0]));

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(baos)) {
            for (int i = 0; i < Zip.MAX_ENTRADAS + 1; i++) {
                zos.putNextEntry(new ZipEntry("dummy-" + i + ".txt"));
                zos.write("x".getBytes(StandardCharsets.UTF_8));
                zos.closeEntry();
            }
        }
        assertThrows(IllegalStateException.class, () -> Zip.extraerXml(baos.toByteArray()));

        byte[] gigante = new byte[Zip.MAX_BYTES_DESCOMPRIMIDOS + 1024];
        byte[] zipGrande = Zip.comprimir("grande.xml", gigante);
        assertThrows(IllegalStateException.class, () -> Zip.extraerXml(zipGrande));
    }

    @Test
    void leeUnCdrAceptadoConObservaciones() {
        String cdr = "<?xml version=\"1.0\"?><ar:ApplicationResponse"
                + " xmlns:ar=\"urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2\""
                + " xmlns:cac=\"urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2\""
                + " xmlns:cbc=\"urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2\">"
                + "<cbc:ID>1</cbc:ID><cbc:Note>4252 - observacion</cbc:Note>"
                + "<cac:DocumentResponse><cac:Response><cbc:ReferenceID>F001-1</cbc:ReferenceID>"
                + "<cbc:ResponseCode>0</cbc:ResponseCode>"
                + "<cbc:Description>La Factura numero F001-1, ha sido aceptada</cbc:Description>"
                + "</cac:Response></cac:DocumentResponse></ar:ApplicationResponse>";
        LectorCdr.Resultado r = LectorCdr.leer(Zip.comprimir("R-20608945123-01-F001-1.xml", cdr.getBytes(StandardCharsets.UTF_8)));

        assertEquals(LectorCdr.Estado.OBSERVADO, r.estado());
        assertEquals("0", r.codigo());
        assertEquals(List.of("4252 - observacion"), r.observaciones());
    }

    @Test
    void interpretaRespuestasSoapYClasificaErroresTransitorios() {
        String fault = "<soap-env:Envelope xmlns:soap-env=\"http://schemas.xmlsoap.org/soap/envelope/\"><soap-env:Body>"
                + "<soap-env:Fault><faultcode>soap-env:Client.1033</faultcode>"
                + "<faultstring>El comprobante fue registrado previamente con otros datos</faultstring>"
                + "</soap-env:Fault></soap-env:Body></soap-env:Envelope>";
        ClienteSunat.Respuesta error1033 = ClienteSunat.interpretar(fault);
        assertFalse(error1033.tieneCdr());
        assertEquals("1033", error1033.codigoError());
        assertFalse(error1033.errorTransitorio());

        String faultAuth = "<soap-env:Envelope xmlns:soap-env=\"http://schemas.xmlsoap.org/soap/envelope/\"><soap-env:Body>"
                + "<soap-env:Fault><faultcode>soap-env:Client.0102</faultcode>"
                + "<faultstring>Usuario o clave SOL incorrectos</faultstring>"
                + "</soap-env:Fault></soap-env:Body></soap-env:Envelope>";
        ClienteSunat.Respuesta errorAuth = ClienteSunat.interpretar(faultAuth);
        assertEquals("0102", errorAuth.codigoError());
        assertTrue(errorAuth.errorTransitorio());

        String faultServer = "<soap-env:Envelope xmlns:soap-env=\"http://schemas.xmlsoap.org/soap/envelope/\"><soap-env:Body>"
                + "<soap-env:Fault><faultcode>soap-env:Server</faultcode>"
                + "<faultstring>Error temporal 0130 en servicio SUNAT</faultstring>"
                + "</soap-env:Fault></soap-env:Body></soap-env:Envelope>";
        ClienteSunat.Respuesta errorSrv = ClienteSunat.interpretar(faultServer);
        assertEquals("0130", errorSrv.codigoError());
        assertTrue(errorSrv.errorTransitorio());

        String cdrVacio = "<soap-env:Envelope xmlns:soap-env=\"http://schemas.xmlsoap.org/soap/envelope/\"><soap-env:Body>"
                + "<br:sendBillResponse xmlns:br=\"http://service.sunat.gob.pe\"><applicationResponse/></br:sendBillResponse>"
                + "</soap-env:Body></soap-env:Envelope>";
        assertThrows(ClienteSunat.SunatNoDisponibleException.class, () -> ClienteSunat.interpretar(cdrVacio));

        String zip = Base64.getEncoder().encodeToString(Zip.comprimir("R.xml", "<x/>".getBytes(StandardCharsets.UTF_8)));
        String ok = "<soap-env:Envelope xmlns:soap-env=\"http://schemas.xmlsoap.org/soap/envelope/\"><soap-env:Body>"
                + "<br:sendBillResponse xmlns:br=\"http://service.sunat.gob.pe\"><applicationResponse>" + zip
                + "</applicationResponse></br:sendBillResponse></soap-env:Body></soap-env:Envelope>";
        assertTrue(ClienteSunat.interpretar(ok).tieneCdr());
    }
}
