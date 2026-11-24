package com.sistema.polleria.facturacion.sunat;

import com.sistema.polleria.facturacion.service.CertificadoSunatException;
import org.w3c.dom.Document;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.xml.XMLConstants;
import javax.xml.crypto.dsig.CanonicalizationMethod;
import javax.xml.crypto.dsig.DigestMethod;
import javax.xml.crypto.dsig.Reference;
import javax.xml.crypto.dsig.SignatureMethod;
import javax.xml.crypto.dsig.SignedInfo;
import javax.xml.crypto.dsig.Transform;
import javax.xml.crypto.dsig.XMLSignature;
import javax.xml.crypto.dsig.XMLSignatureFactory;
import javax.xml.crypto.dsig.dom.DOMSignContext;
import javax.xml.crypto.dsig.keyinfo.KeyInfo;
import javax.xml.crypto.dsig.keyinfo.KeyInfoFactory;
import javax.xml.crypto.dsig.keyinfo.X509Data;
import javax.xml.crypto.dsig.spec.C14NMethodParameterSpec;
import javax.xml.crypto.dsig.spec.TransformParameterSpec;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import java.io.ByteArrayOutputStream;
import java.io.StringReader;
import java.security.cert.CertificateExpiredException;
import java.security.cert.CertificateNotYetValidException;
import java.util.Base64;
import java.util.Collections;
import java.util.List;

/**
 * PASO 2 — Firma digitalmente el XML con el certificado de la empresa.
 *
 * <p>¿Para qué sirve la firma? Garantiza dos cosas:
 * <ul>
 *   <li><b>Autoría</b>: solo quien tiene la clave privada del certificado pudo firmar, así que SUNAT
 *       sabe que el comprobante lo emitió realmente esa empresa.</li>
 *   <li><b>Integridad</b>: si alguien cambia un solo carácter del XML después de firmarlo (por
 *       ejemplo, el total), la firma deja de ser válida y SUNAT lo rechaza.</li>
 * </ul>
 *
 * <p>Cómo funciona (estándar XMLDSig, incluido en Java, sin librerías externas):
 * <ol>
 *   <li>Se calcula un <i>hash</i> (resumen) de todo el XML. Ese hash es el {@code DigestValue}.</li>
 *   <li>Se cifra ese hash con la clave privada: eso es el {@code SignatureValue}.</li>
 *   <li>Se adjunta el certificado público para que SUNAT pueda comprobar la firma.</li>
 * </ol>
 * La firma se guarda dentro del mismo XML, en {@code ext:ExtensionContent} ("firma envolvente").
 */
public final class FirmadorXml {

    private static final String NS_EXT = "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2";

    static {
        // Sin esto Java parte el Base64 de la firma en líneas de 76 caracteres con "&#13;",
        // lo que ensucia el XML. Debe fijarse antes de la primera firma.
        System.setProperty("com.sun.org.apache.xml.internal.security.ignoreLineBreaks", "true");
    }

    /** Algoritmo de firma. SUNAT documenta SHA-1; SHA-256 también se puede configurar. */
    public enum Algoritmo {
        SHA1(SignatureMethod.RSA_SHA1, DigestMethod.SHA1),
        SHA256(SignatureMethod.RSA_SHA256, DigestMethod.SHA256);

        final String firma;
        final String resumen;

        Algoritmo(String firma, String resumen) {
            this.firma = firma;
            this.resumen = resumen;
        }
    }

    /**
     * @param xmlFirmado el XML con la firma dentro (bytes UTF-8, listos para comprimir)
     * @param hash       el DigestValue en Base64; se imprime en el ticket y va en el código QR
     */
    public record Resultado(byte[] xmlFirmado, String hash) {
    }

    private final Certificado certificado;
    private final Algoritmo algoritmo;

    public FirmadorXml(Certificado certificado, Algoritmo algoritmo) {
        this.certificado = certificado;
        this.algoritmo = algoritmo;
    }

    public Resultado firmar(String xmlSinFirma) {
        try {
            certificado.certificado().checkValidity();
            Document documento = leer(xmlSinFirma);

            // Lugar donde se insertará la firma.
            NodeList contenedores = documento.getElementsByTagNameNS(NS_EXT, "ExtensionContent");
            if (contenedores.getLength() == 0) {
                throw new IllegalStateException("El XML no tiene ext:ExtensionContent para la firma");
            }
            Node contenedor = contenedores.item(0);

            XMLSignatureFactory fabrica = XMLSignatureFactory.getInstance("DOM");

            // Referencia URI="" = se firma TODO el documento. La transformación "enveloped"
            // excluye la propia firma del cálculo (si no, sería un círculo imposible).
            Reference referencia = fabrica.newReference(
                    "",
                    fabrica.newDigestMethod(algoritmo.resumen, null),
                    Collections.singletonList(fabrica.newTransform(Transform.ENVELOPED, (TransformParameterSpec) null)),
                    null,
                    null);

            SignedInfo infoFirmada = fabrica.newSignedInfo(
                    fabrica.newCanonicalizationMethod(CanonicalizationMethod.INCLUSIVE, (C14NMethodParameterSpec) null),
                    fabrica.newSignatureMethod(algoritmo.firma, null),
                    Collections.singletonList(referencia));

            // Certificado público adjunto: SUNAT lo usa para verificar la firma.
            KeyInfoFactory kif = fabrica.getKeyInfoFactory();
            X509Data datosX509 = kif.newX509Data(List.of(
                    certificado.certificado().getSubjectX500Principal().getName(),
                    certificado.certificado()));
            KeyInfo infoClave = kif.newKeyInfo(Collections.singletonList(datosX509));

            XMLSignature firma = fabrica.newXMLSignature(infoFirmada, infoClave, null, GeneradorXmlUbl.ID_FIRMA, null);
            DOMSignContext contexto = new DOMSignContext(certificado.clavePrivada(), contenedor);
            contexto.setDefaultNamespacePrefix("ds");
            firma.sign(contexto);

            String hash = Base64.getEncoder().encodeToString(referencia.getDigestValue());
            return new Resultado(escribir(documento), hash);
        } catch (CertificateExpiredException | CertificateNotYetValidException e) {
            throw new CertificadoSunatException("El certificado digital no está vigente: " + e.getMessage(), e);
        } catch (IllegalStateException | CertificadoSunatException e) {
            throw e;
        } catch (Exception e) {
            throw new CertificadoSunatException("No se pudo firmar el XML: " + e.getMessage(), e);
        }
    }

    static Document leer(String xml) throws Exception {
        DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
        dbf.setNamespaceAware(true);
        // Protección XXE: no se procesan entidades ni DTD externos.
        dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        dbf.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        return dbf.newDocumentBuilder().parse(new InputSource(new StringReader(xml)));
    }

    /**
     * Serializa SIN sangrías ni cambios: tocar un espacio después de firmar invalidaría la firma.
     */
    private static byte[] escribir(Document documento) throws Exception {
        TransformerFactory tf = TransformerFactory.newInstance();
        tf.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
        tf.setAttribute(XMLConstants.ACCESS_EXTERNAL_STYLESHEET, "");
        Transformer t = tf.newTransformer();
        t.setOutputProperty(OutputKeys.ENCODING, "UTF-8");
        t.setOutputProperty(OutputKeys.INDENT, "no");
        ByteArrayOutputStream salida = new ByteArrayOutputStream();
        t.transform(new DOMSource(documento), new StreamResult(salida));
        return salida.toByteArray();
    }
}
