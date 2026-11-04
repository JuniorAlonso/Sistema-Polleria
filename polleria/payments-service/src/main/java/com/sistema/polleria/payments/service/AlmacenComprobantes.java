package com.sistema.polleria.payments.service;

import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.Map;
import java.util.UUID;

/**
 * Stores a payment capture uploaded from the web in the same private bucket and key layout that
 * the notification-service uses for WhatsApp captures
 * ({@code comprobantes/yape/{ordenId}/{ordenId}-{uuid}.{ext}}), so {@link FirmadorComprobantes}
 * can sign it for the cashier or admin.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AlmacenComprobantes {

    /** Allowed content types mapped to the extension used in the object key. */
    static final Map<String, String> EXTENSIONES = Map.of(
            "image/jpeg", "jpg",
            "image/png", "png",
            "image/webp", "webp");

    private final MinioClient minioClient;

    @Value("${MINIO_BUCKET:polleria-comprobantes}")
    private String bucket;

    /** Upload size limit in bytes (default 5 MB). */
    @Value("${pagos.comprobante.max-bytes:5242880}")
    private long maxBytes = 5_242_880L;

    /**
     * Validates and stores the capture, returning the object key.
     *
     * @throws IllegalArgumentException when the file is empty, too large, not an allowed image
     *                                  type, or its bytes do not match the declared type (HTTP 400)
     * @throws IllegalStateException    when the storage backend fails
     */
    public String guardar(Long ordenId, MultipartFile archivo) {
        if (archivo == null || archivo.isEmpty()) {
            throw new IllegalArgumentException("Debes adjuntar la captura del pago");
        }
        if (archivo.getSize() > maxBytes) {
            throw new IllegalArgumentException(
                    "La captura supera el tamaño máximo de " + (maxBytes / 1024 / 1024) + " MB");
        }
        String contentType = archivo.getContentType() == null
                ? "" : archivo.getContentType().toLowerCase(java.util.Locale.ROOT);
        String extension = EXTENSIONES.get(contentType);
        if (extension == null) {
            throw new IllegalArgumentException("La captura debe ser una imagen JPG, PNG o WEBP");
        }

        byte[] contenido;
        try {
            contenido = archivo.getBytes();
        } catch (IOException e) {
            throw new IllegalStateException("No se pudo leer la captura enviada", e);
        }
        if (!coincideConFirma(contenido, contentType)) {
            throw new IllegalArgumentException("El archivo no es una imagen válida");
        }

        String clave = "comprobantes/yape/" + ordenId + "/" + ordenId + "-"
                + UUID.randomUUID().toString().replace("-", "").substring(0, 12) + "." + extension;
        try (InputStream in = new java.io.ByteArrayInputStream(contenido)) {
            asegurarBucket();
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(clave)
                    .stream(in, contenido.length, -1)
                    .contentType(contentType)
                    .build());
        } catch (Exception e) {
            log.error("No se pudo guardar el comprobante de la orden {}", ordenId, e);
            throw new IllegalStateException("No se pudo guardar la captura. Intenta nuevamente.", e);
        }
        return clave;
    }

    private void asegurarBucket() throws Exception {
        if (!minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucket).build())) {
            minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
        }
    }

    /** Magic-byte check so a renamed non-image cannot pass with an image content type. */
    static boolean coincideConFirma(byte[] b, String contentType) {
        if (b.length < 12) {
            return false;
        }
        return switch (contentType) {
            case "image/jpeg" -> (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF;
            case "image/png" -> (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G';
            case "image/webp" -> b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                    && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P';
            default -> false;
        };
    }
}
