package com.sistema.polleria.orders.service;

import io.minio.GetObjectArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.InputStream;
import java.util.NoSuchElementException;
import java.util.Set;

@Slf4j
@Service
public class MinioProductoService {

    private static final Set<String> CONTENT_TYPES_VALIDOS = Set.of(
            "image/jpeg", "image/png", "image/webp"
    );
    private static final byte[] JPEG_MAGIC = new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    private static final byte[] PNG_MAGIC  = new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47};

    private final MinioClient minioClient;
    private final String bucket;

    public MinioProductoService(
            MinioClient minioClient,
            @Value("${minio.bucket.catalogo:polleria-catalogo}") String bucket) {
        this.minioClient = minioClient;
        this.bucket = bucket;
    }

    /**
     * Sube la imagen de un producto a MinIO. El objectName es fijo: `producto-{id}.<ext>`
     * así la URL interna /productos/{id}/imagen siempre apunta al objeto correcto.
     */
    public String subirImagenProducto(Long productoId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("El archivo de imagen no puede estar vacío");
        }

        String contentType = file.getContentType();
        if (contentType == null || !CONTENT_TYPES_VALIDOS.contains(contentType.toLowerCase())) {
            throw new IllegalArgumentException("Solo se aceptan imágenes JPEG, PNG o WEBP.");
        }

        try {
            byte[] bytes = file.getBytes();
            if (!coincideConFirma(bytes, contentType)) {
                throw new IllegalArgumentException("El contenido del archivo no coincide con la extensión declarada.");
            }

            String extension = extensionDe(contentType);
            String objectName = "producto-" + productoId + extension;

            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectName)
                    .stream(new java.io.ByteArrayInputStream(bytes), bytes.length, -1)
                    .contentType(contentType)
                    .build());

            log.info("Imagen del producto #{} subida a MinIO: {}", productoId, objectName);
            return "/productos/" + productoId + "/imagen";

        } catch (ResponseStatusException | IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("MinIO no disponible al subir imagen de producto #{}: {}", productoId, e.getMessage());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "El almacenamiento de imágenes no está disponible. Intenta de nuevo.");
        }
    }

    public byte[] leerImagenProducto(Long productoId) {
        // Intentar las tres extensiones posibles
        for (String ext : new String[]{".jpg", ".png", ".webp"}) {
            String objectName = "producto-" + productoId + ext;
            try (InputStream is = minioClient.getObject(GetObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectName)
                    .build())) {
                return is.readAllBytes();
            } catch (Exception ignored) {
                // probar siguiente extensión
            }
        }
        throw new NoSuchElementException("No hay imagen para el producto #" + productoId);
    }

    public String resolverContentType(Long productoId) {
        for (String[] pair : new String[][]{
                {".jpg", "image/jpeg"},
                {".png", "image/png"},
                {".webp", "image/webp"}}) {
            try {
                minioClient.statObject(
                        io.minio.StatObjectArgs.builder()
                                .bucket(bucket)
                                .object("producto-" + productoId + pair[0])
                                .build());
                return pair[1];
            } catch (Exception ignored) {}
        }
        return "application/octet-stream";
    }

    private static String extensionDe(String contentType) {
        if (contentType.contains("png")) return ".png";
        if (contentType.contains("webp")) return ".webp";
        return ".jpg";
    }

    private static boolean coincideConFirma(byte[] bytes, String contentType) {
        if (bytes.length < 4) return false;
        if (contentType.contains("jpeg") || contentType.contains("jpg")) return startsWith(bytes, JPEG_MAGIC);
        if (contentType.contains("png")) return startsWith(bytes, PNG_MAGIC);
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
