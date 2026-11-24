package com.sistema.polleria.facturacion.sunat;

import com.sistema.polleria.facturacion.service.CertificadoSunatException;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.CertificateExpiredException;
import java.security.cert.CertificateNotYetValidException;
import java.security.cert.X509Certificate;
import java.util.Base64;
import java.util.Collections;

/**
 * Certificado digital de la empresa leído desde un archivo .p12 / .pfx o Base64.
 */
public record Certificado(PrivateKey clavePrivada, X509Certificate certificado) {

    public static Certificado desdeBase64(String base64, String password) {
        if (base64 == null || base64.isBlank()) {
            throw new CertificadoSunatException("El certificado Base64 está vacío");
        }
        try {
            byte[] bytes = Base64.getMimeDecoder().decode(base64.trim());
            return desde(new ByteArrayInputStream(bytes), password);
        } catch (CertificadoSunatException e) {
            throw e;
        } catch (Exception e) {
            throw new CertificadoSunatException("No se pudo decodificar el certificado Base64: " + e.getMessage(), e);
        }
    }

    public static Certificado desdeArchivo(Path ruta, String password) {
        try (InputStream entrada = Files.newInputStream(ruta)) {
            return desde(entrada, password);
        } catch (CertificadoSunatException e) {
            throw e;
        } catch (Exception e) {
            throw new CertificadoSunatException("No se pudo leer el certificado " + ruta + ": " + e.getMessage(), e);
        }
    }

    public static Certificado desde(InputStream entrada, String password) {
        try {
            KeyStore almacen = KeyStore.getInstance("PKCS12");
            char[] clave = password == null ? new char[0] : password.toCharArray();
            almacen.load(entrada, clave);
            for (String alias : Collections.list(almacen.aliases())) {
                if (almacen.isKeyEntry(alias)) {
                    PrivateKey privada = (PrivateKey) almacen.getKey(alias, clave);
                    X509Certificate publico = (X509Certificate) almacen.getCertificate(alias);
                    if (privada == null || publico == null) {
                        continue;
                    }
                    publico.checkValidity();
                    return new Certificado(privada, publico);
                }
            }
            throw new CertificadoSunatException("El archivo .p12 no contiene una clave privada");
        } catch (CertificateExpiredException e) {
            throw new CertificadoSunatException("El certificado digital está vencido: " + e.getMessage(), e);
        } catch (CertificateNotYetValidException e) {
            throw new CertificadoSunatException("El certificado digital aún no es válido: " + e.getMessage(), e);
        } catch (CertificadoSunatException e) {
            throw e;
        } catch (Exception e) {
            throw new CertificadoSunatException("Certificado o contraseña inválidos: " + e.getMessage(), e);
        }
    }
}
