package com.sistema.polleria.feedback.service;

import io.minio.*;
import io.minio.errors.MinioException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.io.InputStream;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
public class FileStorageService {

    private static final Set<String> EXTENSIONES_VALIDAS = Set.of(".jpg", ".jpeg", ".png", ".webp");
    private static final Set<String> CONTENT_TYPES_VALIDOS = Set.of(
            "image/jpeg", "image/png", "image/webp"
    );

    // Magic bytes para validar firmas de archivo (D4.5)
    private static final byte[] JPEG_MAGIC = new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    private static final byte[] PNG_MAGIC  = new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47};

    private final MinioClient minioClient;
    private final String bucket;

    public FileStorageService(
            MinioClient minioClient,
            @Value("${minio.bucket.feedback:polleria-feedback}") String bucket) {
        this.minioClient = minioClient;
        this.bucket = bucket;
    }

    public String guardarArchivo(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return null;
        }

        // 1. Validar Content-Type
        String contentType = file.getContentType();
        if (contentType == null || !CONTENT_TYPES_VALIDOS.contains(contentType.toLowerCase())) {
            throw new IllegalArgumentException("Tipo de archivo no permitido. Solo se aceptan JPEG, PNG y WEBP.");
        }

        // 2. Validar extensión
        String originalFilename = file.getOriginalFilename();
        String extension = "";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf(".")).toLowerCase();
        }
        if (!EXTENSIONES_VALIDAS.contains(extension)) {
            throw new IllegalArgumentException("Extensión no permitida. Solo: " + EXTENSIONES_VALIDAS);
        }

        try {
            byte[] bytes = file.getBytes();

            // 3. Validar firma (magic bytes) — D4.5
            if (!coincideConFirma(bytes, contentType)) {
                throw new IllegalArgumentException("El contenido del archivo no coincide con su extensión declarada.");
            }

            String objectName = UUID.randomUUID() + extension;

            // 4. Subir a MinIO — 503 si falla (D4.4)
            try {
                minioClient.putObject(PutObjectArgs.builder()
                        .bucket(bucket)
                        .object(objectName)
                        .stream(new java.io.ByteArrayInputStream(bytes), bytes.length, -1)
                        .contentType(contentType)
                        .build());
                log.info("Evidencia subida a MinIO: bucket={}, object={}", bucket, objectName);
            } catch (Exception e) {
                log.error("MinIO no disponible al subir evidencia: {}", e.getMessage());
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                        "El almacenamiento de evidencias no está disponible en este momento. Intenta de nuevo en unos minutos.");
            }

            return "/feedback/evidencias/" + objectName;

        } catch (ResponseStatusException | IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error al procesar la evidencia: {}", e.getMessage());
            throw new RuntimeException("Error al procesar la evidencia fotográfica", e);
        }
    }

    public byte[] leerArchivo(String objectName) {
        validarNombreObjeto(objectName);
        try (InputStream is = minioClient.getObject(GetObjectArgs.builder()
                .bucket(bucket)
                .object(objectName)
                .build())) {
            return is.readAllBytes();
        } catch (Exception e) {
            log.warn("No se pudo leer la evidencia '{}' de MinIO: {}", objectName, e.getMessage());
            throw new java.util.NoSuchElementException("Evidencia no encontrada: " + objectName);
        }
    }

    public String resolverContentType(String objectName) {
        if (objectName == null) return MediaType.APPLICATION_OCTET_STREAM_VALUE;
        String lower = objectName.toLowerCase();
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".webp")) return "image/webp";
        return MediaType.APPLICATION_OCTET_STREAM_VALUE;
    }

    private static void validarNombreObjeto(String nombre) {
        if (nombre == null || nombre.isBlank() || nombre.contains("..") || nombre.contains("/") || nombre.contains("\\")) {
            throw new SecurityException("Nombre de objeto inválido: " + nombre);
        }
        // Solo UUIDs con extensión de imagen (D4.5)
        if (!nombre.matches("^[0-9a-f\\-]{36}\\.(jpg|jpeg|png|webp)$")) {
            throw new SecurityException("Nombre de objeto no válido para evidencias: " + nombre);
        }
    }

    private static boolean coincideConFirma(byte[] bytes, String contentType) {
        if (bytes.length < 4) return false;
        if (contentType.contains("jpeg") || contentType.contains("jpg")) {
            return startsWith(bytes, JPEG_MAGIC);
        }
        if (contentType.contains("png")) {
            return startsWith(bytes, PNG_MAGIC);
        }
        // webp: starts with RIFF....WEBP
        if (contentType.contains("webp")) {
            return bytes.length >= 12
                    && bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F'
                    && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P';
        }
        return true;
    }

    private static boolean startsWith(byte[] data, byte[] prefix) {
        if (data.length < prefix.length) return false;
        for (int i = 0; i < prefix.length; i++) {
            if (data[i] != prefix[i]) return false;
        }
        return true;
    }
}
