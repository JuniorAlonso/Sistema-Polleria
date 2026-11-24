package com.sistema.polleria.facturacion.config;

import com.sistema.polleria.facturacion.service.CertificadoSunatException;
import com.sistema.polleria.facturacion.sunat.Certificado;
import com.sistema.polleria.facturacion.sunat.ClienteSunat;
import com.sistema.polleria.facturacion.sunat.Emisor;
import com.sistema.polleria.facturacion.sunat.FirmadorXml;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.function.Supplier;

/**
 * Crea los objetos de SUNAT a partir de application.properties / variables de entorno.
 */
@Slf4j
@Configuration
public class SunatConfig {

    @Bean
    public Emisor emisor(
            @Value("${sunat.emisor.ruc}") String ruc,
            @Value("${sunat.emisor.razon-social}") String razonSocial,
            @Value("${sunat.emisor.nombre-comercial}") String nombreComercial,
            @Value("${sunat.emisor.direccion}") String direccion,
            @Value("${sunat.emisor.ubigeo}") String ubigeo,
            @Value("${sunat.emisor.departamento}") String departamento,
            @Value("${sunat.emisor.provincia}") String provincia,
            @Value("${sunat.emisor.distrito}") String distrito) {
        if (ruc == null || !ruc.matches("\\d{11}")) {
            throw new IllegalStateException("sunat.emisor.ruc debe tener 11 dígitos");
        }
        return new Emisor(ruc, razonSocial, nombreComercial, direccion, ubigeo, departamento, provincia, distrito);
    }

    @Bean
    public ClienteSunat clienteSunat(
            Emisor emisor,
            @Value("${sunat.url}") String url,
            @Value("${sunat.usuario-sol}") String usuarioSol,
            @Value("${sunat.clave-sol}") String claveSol) {
        String usuario = usuarioSol.startsWith(emisor.ruc()) ? usuarioSol : emisor.ruc() + usuarioSol;
        return new ClienteSunat(url, usuario, claveSol);
    }

    @Bean
    public Supplier<FirmadorXml> firmador(
            @Value("${sunat.certificado.base64:}") String base64,
            @Value("${sunat.certificado.ruta}") String ruta,
            @Value("${sunat.certificado.password}") String password,
            @Value("${sunat.firma.algoritmo:SHA1}") String algoritmo) {
        FirmadorXml.Algoritmo alg = FirmadorXml.Algoritmo.valueOf(algoritmo.trim().toUpperCase());
        return new Supplier<>() {
            private volatile FirmadorXml cache;

            @Override
            public FirmadorXml get() {
                FirmadorXml actual = cache;
                if (actual == null) {
                    synchronized (this) {
                        actual = cache;
                        if (actual == null) {
                            Certificado cert;
                            if (base64 != null && !base64.isBlank()) {
                                cert = Certificado.desdeBase64(base64, password);
                            } else {
                                Path archivo = Path.of(ruta);
                                if (!Files.exists(archivo)) {
                                    log.error("Certificado SUNAT no encontrado en {}", archivo.toAbsolutePath());
                                    throw new CertificadoSunatException("Certificado digital SUNAT no configurado en el servidor");
                                }
                                cert = Certificado.desdeArchivo(archivo, password);
                            }
                            actual = new FirmadorXml(cert, alg);
                            cache = actual;
                        }
                    }
                }
                return actual;
            }
        };
    }
}
