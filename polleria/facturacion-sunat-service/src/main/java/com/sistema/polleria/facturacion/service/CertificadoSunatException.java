package com.sistema.polleria.facturacion.service;

/** Error interno de configuración, carga o vigencia del certificado digital SUNAT. */
public class CertificadoSunatException extends RuntimeException {
    public CertificadoSunatException(String mensaje) {
        super(mensaje);
    }

    public CertificadoSunatException(String mensaje, Throwable causa) {
        super(mensaje, causa);
    }
}
