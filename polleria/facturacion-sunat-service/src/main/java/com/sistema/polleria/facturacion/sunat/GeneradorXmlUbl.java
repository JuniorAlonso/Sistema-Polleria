package com.sistema.polleria.facturacion.sunat;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.format.DateTimeFormatter;

/**
 * PASO 1 — Genera el XML del comprobante en el formato UBL 2.1 que exige SUNAT.
 *
 * <p>UBL (Universal Business Language) es un estándar internacional para documentos comerciales.
 * SUNAT lo adoptó con sus propias reglas (versión "2.0" de su personalización). El XML es la
 * factura "de verdad": el PDF o el ticket impreso solo son una representación de este archivo.
 *
 * <p>El ORDEN de las etiquetas importa: SUNAT valida el XML contra el esquema UBL y, si una
 * etiqueta aparece fuera de lugar, rechaza el comprobante.
 *
 * <p>El XML sale SIN firmar: deja un espacio vacío ({@code <ext:ExtensionContent/>}) donde
 * {@link FirmadorXml} insertará la firma digital.
 */
public final class GeneradorXmlUbl {

    private static final String MONEDA = "PEN";
    private static final DateTimeFormatter FECHA = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter HORA = DateTimeFormatter.ofPattern("HH:mm:ss");

    /** Id de la firma; el bloque cac:Signature apunta a él. */
    public static final String ID_FIRMA = "SignatureSP";

    private GeneradorXmlUbl() {
    }

    public static String generar(Emisor emisor, DocumentoVenta doc) {
        StringBuilder x = new StringBuilder(4096);
        x.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        x.append("<Invoice xmlns=\"urn:oasis:names:specification:ubl:schema:xsd:Invoice-2\"")
                .append(" xmlns:cac=\"urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2\"")
                .append(" xmlns:cbc=\"urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2\"")
                .append(" xmlns:ds=\"http://www.w3.org/2000/09/xmldsig#\"")
                .append(" xmlns:ext=\"urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2\">\n");

        // Espacio reservado para la firma digital (lo llena FirmadorXml).
        x.append("<ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension></ext:UBLExtensions>\n");

        // --- Cabecera: versión, número, fecha y tipo -------------------------------------------
        x.append("<cbc:UBLVersionID>2.1</cbc:UBLVersionID>\n");
        x.append("<cbc:CustomizationID schemeAgencyName=\"PE:SUNAT\">2.0</cbc:CustomizationID>\n");
        x.append("<cbc:ID>").append(esc(doc.numeroCompleto())).append("</cbc:ID>\n");
        x.append("<cbc:IssueDate>").append(doc.fechaEmision().format(FECHA)).append("</cbc:IssueDate>\n");
        x.append("<cbc:IssueTime>").append(doc.fechaEmision().format(HORA)).append("</cbc:IssueTime>\n");
        // listID 0101 = "venta interna" (catálogo 51). El valor 01/03 dice si es factura o boleta.
        x.append("<cbc:InvoiceTypeCode listID=\"0101\" listAgencyName=\"PE:SUNAT\" listName=\"Tipo de Documento\"")
                .append(" listURI=\"urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01\">")
                .append(doc.tipo().codigo()).append("</cbc:InvoiceTypeCode>\n");
        // Leyenda 1000: el monto en letras.
        x.append("<cbc:Note languageLocaleID=\"1000\">").append(esc(NumeroALetras.soles(doc.totalPagar())))
                .append("</cbc:Note>\n");
        x.append("<cbc:DocumentCurrencyCode listID=\"ISO 4217 Alpha\" listName=\"Currency\"")
                .append(" listAgencyName=\"United Nations Economic Commission for Europe\">")
                .append(MONEDA).append("</cbc:DocumentCurrencyCode>\n");
        x.append("<cbc:LineCountNumeric>").append(doc.lineas().size()).append("</cbc:LineCountNumeric>\n");

        // --- Referencia a la firma -----------------------------------------------------------------
        x.append("<cac:Signature>")
                .append("<cbc:ID>").append(esc(emisor.ruc())).append("</cbc:ID>")
                .append("<cac:SignatoryParty>")
                .append("<cac:PartyIdentification><cbc:ID>").append(esc(emisor.ruc())).append("</cbc:ID></cac:PartyIdentification>")
                .append("<cac:PartyName><cbc:Name>").append(esc(emisor.razonSocial())).append("</cbc:Name></cac:PartyName>")
                .append("</cac:SignatoryParty>")
                .append("<cac:DigitalSignatureAttachment><cac:ExternalReference><cbc:URI>#").append(ID_FIRMA)
                .append("</cbc:URI></cac:ExternalReference></cac:DigitalSignatureAttachment>")
                .append("</cac:Signature>\n");

        // --- Emisor (la pollería) ------------------------------------------------------------------
        x.append("<cac:AccountingSupplierParty><cac:Party>")
                .append("<cac:PartyIdentification><cbc:ID schemeID=\"6\" schemeName=\"Documento de Identidad\"")
                .append(" schemeAgencyName=\"PE:SUNAT\" schemeURI=\"urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06\">")
                .append(esc(emisor.ruc())).append("</cbc:ID></cac:PartyIdentification>")
                .append("<cac:PartyName><cbc:Name>").append(esc(emisor.nombreComercial())).append("</cbc:Name></cac:PartyName>")
                .append("<cac:PartyLegalEntity>")
                .append("<cbc:RegistrationName>").append(esc(emisor.razonSocial())).append("</cbc:RegistrationName>")
                .append("<cac:RegistrationAddress>")
                .append("<cbc:ID schemeName=\"Ubigeos\" schemeAgencyName=\"PE:INEI\">").append(esc(emisor.ubigeo())).append("</cbc:ID>")
                // 0000 = establecimiento principal (domicilio fiscal)
                .append("<cbc:AddressTypeCode listAgencyName=\"PE:SUNAT\" listName=\"Establecimientos anexos\">0000</cbc:AddressTypeCode>")
                .append("<cbc:CityName>").append(esc(emisor.provincia())).append("</cbc:CityName>")
                .append("<cbc:CountrySubentity>").append(esc(emisor.departamento())).append("</cbc:CountrySubentity>")
                .append("<cbc:District>").append(esc(emisor.distrito())).append("</cbc:District>")
                .append("<cac:AddressLine><cbc:Line>").append(esc(emisor.direccion())).append("</cbc:Line></cac:AddressLine>")
                .append("<cac:Country><cbc:IdentificationCode listID=\"ISO 3166-1\" listAgencyName=\"United Nations Economic Commission for Europe\"")
                .append(" listName=\"Country\">PE</cbc:IdentificationCode></cac:Country>")
                .append("</cac:RegistrationAddress>")
                .append("</cac:PartyLegalEntity>")
                .append("</cac:Party></cac:AccountingSupplierParty>\n");

        // --- Cliente ---------------------------------------------------------------------------------
        DocumentoVenta.Cliente c = doc.cliente();
        x.append("<cac:AccountingCustomerParty><cac:Party>")
                .append("<cac:PartyIdentification><cbc:ID schemeID=\"").append(esc(c.tipoDocumento()))
                .append("\" schemeName=\"Documento de Identidad\" schemeAgencyName=\"PE:SUNAT\"")
                .append(" schemeURI=\"urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06\">")
                .append(esc(c.numeroDocumento())).append("</cbc:ID></cac:PartyIdentification>")
                .append("<cac:PartyLegalEntity>")
                .append("<cbc:RegistrationName>").append(esc(c.nombre())).append("</cbc:RegistrationName>");
        if (c.direccion() != null && !c.direccion().isBlank()) {
            x.append("<cac:RegistrationAddress><cac:AddressLine><cbc:Line>").append(esc(c.direccion()))
                    .append("</cbc:Line></cac:AddressLine></cac:RegistrationAddress>");
        }
        x.append("</cac:PartyLegalEntity>")
                .append("</cac:Party></cac:AccountingCustomerParty>\n");

        // --- Forma de pago (obligatoria en facturas desde 2021) ---------------------------------
        if (doc.tipo() == DocumentoVenta.TipoDocumento.FACTURA) {
            x.append("<cac:PaymentTerms><cbc:ID>FormaPago</cbc:ID><cbc:PaymentMeansID>Contado</cbc:PaymentMeansID></cac:PaymentTerms>\n");
        }

        // --- Total de impuestos (IGV de todo el comprobante) -------------------------------------
        x.append("<cac:TaxTotal>")
                .append(monto("cbc:TaxAmount", doc.totalIgv()))
                .append("<cac:TaxSubtotal>")
                .append(monto("cbc:TaxableAmount", doc.totalValorVenta()))
                .append(monto("cbc:TaxAmount", doc.totalIgv()))
                .append("<cac:TaxCategory>").append(esquemaIgv()).append("</cac:TaxCategory>")
                .append("</cac:TaxSubtotal>")
                .append("</cac:TaxTotal>\n");

        // --- Totales a pagar -------------------------------------------------------------------------
        x.append("<cac:LegalMonetaryTotal>")
                .append(monto("cbc:LineExtensionAmount", doc.totalValorVenta())) // sin IGV
                .append(monto("cbc:TaxInclusiveAmount", doc.totalPagar()))       // con IGV
                .append(monto("cbc:PayableAmount", doc.totalPagar()))            // lo que se paga
                .append("</cac:LegalMonetaryTotal>\n");

        // --- Líneas (los productos) -----------------------------------------------------------------
        int numero = 1;
        for (DocumentoVenta.Linea l : doc.lineas()) {
            x.append("<cac:InvoiceLine>")
                    .append("<cbc:ID>").append(numero++).append("</cbc:ID>")
                    // NIU = unidad (catálogo 03)
                    .append("<cbc:InvoicedQuantity unitCode=\"NIU\" unitCodeListID=\"UN/ECE rec 20\"")
                    .append(" unitCodeListAgencyName=\"United Nations Economic Commission for Europe\">")
                    .append(numero(l.cantidad())).append("</cbc:InvoicedQuantity>")
                    .append(monto("cbc:LineExtensionAmount", l.valorVenta()))
                    // Precio que ve el cliente (con IGV). Tipo 01 = precio unitario con IGV.
                    .append("<cac:PricingReference><cac:AlternativeConditionPrice>")
                    .append(monto("cbc:PriceAmount", l.precioUnitario()))
                    .append("<cbc:PriceTypeCode listName=\"Tipo de Precio\" listAgencyName=\"PE:SUNAT\"")
                    .append(" listURI=\"urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo16\">01</cbc:PriceTypeCode>")
                    .append("</cac:AlternativeConditionPrice></cac:PricingReference>")
                    .append("<cac:TaxTotal>")
                    .append(monto("cbc:TaxAmount", l.igv()))
                    .append("<cac:TaxSubtotal>")
                    .append(monto("cbc:TaxableAmount", l.valorVenta()))
                    .append(monto("cbc:TaxAmount", l.igv()))
                    .append("<cac:TaxCategory>")
                    .append("<cbc:Percent>18</cbc:Percent>")
                    // 10 = "Gravado - Operación onerosa" (catálogo 07): venta normal con IGV.
                    .append("<cbc:TaxExemptionReasonCode listAgencyName=\"PE:SUNAT\" listName=\"Afectacion del IGV\"")
                    .append(" listURI=\"urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo07\">10</cbc:TaxExemptionReasonCode>")
                    .append(esquemaIgv())
                    .append("</cac:TaxCategory>")
                    .append("</cac:TaxSubtotal>")
                    .append("</cac:TaxTotal>")
                    .append("<cac:Item>")
                    .append("<cbc:Description>").append(esc(l.descripcion())).append("</cbc:Description>")
                    .append("<cac:SellersItemIdentification><cbc:ID>").append(esc(l.codigo()))
                    .append("</cbc:ID></cac:SellersItemIdentification>")
                    .append("</cac:Item>")
                    // Valor unitario SIN IGV.
                    .append("<cac:Price>").append(monto("cbc:PriceAmount", l.valorUnitario())).append("</cac:Price>")
                    .append("</cac:InvoiceLine>\n");
        }

        x.append("</Invoice>\n");
        return x.toString();
    }

    /** Tributo 1000 = IGV (catálogo 05). */
    private static String esquemaIgv() {
        return "<cac:TaxScheme><cbc:ID schemeName=\"Codigo de tributos\" schemeAgencyName=\"PE:SUNAT\""
                + " schemeURI=\"urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo05\">1000</cbc:ID>"
                + "<cbc:Name>IGV</cbc:Name><cbc:TaxTypeCode>VAT</cbc:TaxTypeCode></cac:TaxScheme>";
    }

    private static String monto(String etiqueta, BigDecimal valor) {
        return "<" + etiqueta + " currencyID=\"" + MONEDA + "\">" + importe(valor) + "</" + etiqueta + ">";
    }

    /** Montos con 2 decimales como mínimo; el valor unitario puede llevar más (hasta 10). */
    static String importe(BigDecimal valor) {
        BigDecimal limpio = valor.stripTrailingZeros();
        if (limpio.scale() < 2) {
            limpio = limpio.setScale(2, RoundingMode.UNNECESSARY);
        }
        return limpio.toPlainString();
    }

    private static String numero(BigDecimal valor) {
        return valor.stripTrailingZeros().toPlainString();
    }

    /** Escapa los caracteres especiales de XML (&, <, >, comillas). */
    static String esc(String texto) {
        if (texto == null) {
            return "";
        }
        return texto.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&apos;");
    }
}
