package com.sistema.polleria.facturacion;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * facturacion-sunat-service: facturación electrónica de El San Pollo.
 *
 * <p>Toma un comprobante que ya emitió finance-service, lo convierte en XML UBL 2.1, lo firma con
 * el certificado digital, lo envía a SUNAT y guarda la respuesta (CDR). Ver
 * {@code facturacion-sunat-service/GUIA-FACTURACION.md}.
 */
@SpringBootApplication
public class FacturacionSunatServiceApplication {

    public static final String ZONA_HORARIA = "America/Lima";

    public static void main(String[] args) {
        // La fecha y hora del comprobante deben ser hora de Perú, aunque el servidor esté en UTC.
        java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone(ZONA_HORARIA));
        SpringApplication.run(FacturacionSunatServiceApplication.class, args);
    }
}
