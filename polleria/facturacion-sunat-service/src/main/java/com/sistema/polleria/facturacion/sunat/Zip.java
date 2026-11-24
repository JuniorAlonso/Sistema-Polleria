package com.sistema.polleria.facturacion.sunat;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

/**
 * PASO 3 — Comprime el XML firmado en un .zip y extrae de forma acotada el XML del CDR.
 */
public final class Zip {

    static final int MAX_ENTRADAS = 10;
    static final int MAX_BYTES_DESCOMPRIMIDOS = 5 * 1024 * 1024; // 5 MB

    private Zip() {
    }

    public static byte[] comprimir(String nombreArchivoXml, byte[] contenido) {
        if (nombreArchivoXml == null || nombreArchivoXml.isBlank() || contenido == null) {
            throw new IllegalArgumentException("Nombre y contenido XML son obligatorios para comprimir");
        }
        try {
            ByteArrayOutputStream salida = new ByteArrayOutputStream();
            try (ZipOutputStream zip = new ZipOutputStream(salida)) {
                zip.putNextEntry(new ZipEntry(nombreArchivoXml));
                zip.write(contenido);
                zip.closeEntry();
            }
            return salida.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** Devuelve el primer archivo .xml del ZIP aplicando límites anti-Zip-Bomb. */
    public static byte[] extraerXml(byte[] zipBytes) {
        if (zipBytes == null || zipBytes.length == 0) {
            throw new IllegalStateException("El ZIP de respuesta de SUNAT está vacío");
        }
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(zipBytes))) {
            ZipEntry entrada;
            int entradas = 0;
            byte[] buffer = new byte[8192];
            while ((entrada = zip.getNextEntry()) != null) {
                entradas++;
                if (entradas > MAX_ENTRADAS) {
                    throw new IllegalStateException("El archivo ZIP supera el máximo de entradas permitido");
                }
                if (!entrada.isDirectory() && entrada.getName().toLowerCase(Locale.ROOT).endsWith(".xml")) {
                    ByteArrayOutputStream salida = new ByteArrayOutputStream();
                    int total = 0;
                    int leido;
                    while ((leido = zip.read(buffer)) != -1) {
                        total += leido;
                        if (total > MAX_BYTES_DESCOMPRIMIDOS) {
                            throw new IllegalStateException("El archivo ZIP excede el tamaño máximo permitido");
                        }
                        salida.write(buffer, 0, leido);
                    }
                    return salida.toByteArray();
                }
            }
            throw new IllegalStateException("El ZIP de respuesta de SUNAT no contiene un XML");
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
