package com.sistema.polleria.payments.service;

import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MinioClient;
import io.minio.http.Method;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

/**
 * Firma el enlace de vida corta con el que el ADMIN o CAJERO ve el comprobante de Yape (T6c, S7).
 *
 * <p>El bucket queda privado: nadie obtiene acceso permanente al archivo ni la clave del objeto
 * fuera de los roles autorizados. Este servicio solo firma; la autorización vive en el controlador.
 *
 * <p>La URL se genera localmente (SigV4, sin llamada a MinIO) usando el endpoint público visible
 * desde el navegador (evitando firmar con el hostname interno {@code minio} de Docker).
 */
@Slf4j
@Service
public class FirmadorComprobantes {

    private static final String REGION_MINIO_POR_DEFECTO = "us-east-1";

    private final MinioClient minioClient;

    /** Bucket de los comprobantes; el mismo default que usa el notification-service. */
    @Value("${MINIO_BUCKET:polleria-comprobantes}")
    private String bucket = "polleria-comprobantes";

    /** Vida de la URL firmada, corta a propósito (default 5 minutos). */
    @Value("${MINIO_URL_EXPIRACION_SEGUNDOS:300}")
    private int expiracionSegundos = 300;

    public FirmadorComprobantes(MinioClient minioClient) {
        this.minioClient = minioClient;
    }

    @Autowired
    public FirmadorComprobantes(
            MinioClient minioClient,
            @Value("${MINIO_PUBLIC_ENDPOINT:}") String publicEndpoint,
            @Value("${MINIO_ENDPOINT:}") String internalEndpoint,
            @Value("${MINIO_PUBLIC_PORT:${MINIO_PORT:9000}}") int publicPort,
            @Value("${MINIO_PUBLIC_USE_SSL:${MINIO_USE_SSL:false}}") boolean publicUseSsl,
            @Value("${MINIO_ACCESS_KEY:${MINIO_ROOT_USER:}}") String accessKey,
            @Value("${MINIO_SECRET_KEY:${MINIO_ROOT_PASSWORD:}}") String secretKey) {
        this.minioClient = resolverClienteFirmador(
                minioClient, publicEndpoint, internalEndpoint, publicPort, publicUseSsl, accessKey, secretKey);
    }

    private static MinioClient resolverClienteFirmador(
            MinioClient fallbackClient,
            String publicEndpoint,
            String internalEndpoint,
            int publicPort,
            boolean publicUseSsl,
            String accessKey,
            String secretKey) {
        String resolvedEndpoint = resolverEndpointPublico(publicEndpoint, internalEndpoint);
        if (resolvedEndpoint == null
                || accessKey == null || accessKey.isBlank()
                || secretKey == null || secretKey.isBlank()) {
            return fallbackClient;
        }
        MinioClient.Builder builder = MinioClient.builder()
                .credentials(accessKey, secretKey)
                .region(REGION_MINIO_POR_DEFECTO);
        if (resolvedEndpoint.startsWith("http://") || resolvedEndpoint.startsWith("https://")) {
            builder.endpoint(resolvedEndpoint);
        } else {
            builder.endpoint(resolvedEndpoint, publicPort, publicUseSsl);
        }
        return builder.build();
    }

    private static String resolverEndpointPublico(String publicEndpoint, String internalEndpoint) {
        if (publicEndpoint != null && !publicEndpoint.isBlank()) {
            return publicEndpoint.trim();
        }
        if (internalEndpoint == null || internalEndpoint.isBlank()) {
            return null;
        }
        String trimmedInternal = internalEndpoint.trim();
        if ("minio".equalsIgnoreCase(trimmedInternal)) {
            return "localhost";
        }
        return trimmedInternal;
    }

    /**
     * URL firmada de lectura para la clave del comprobante.
     *
     * <p>Si la firma falla, el error no se silencia: devolver un enlace inválido o {@code null}
     * dejaría al admin creyendo que el comprobante no existe.
     */
    public String urlFirmada(String claveObjeto) {
        try {
            return minioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Method.GET)
                            .bucket(bucket)
                            .object(claveObjeto)
                            .expiry(expiracionSegundos, TimeUnit.SECONDS)
                            .build());
        } catch (Exception e) {
            log.error("No se pudo firmar la URL del comprobante {}", claveObjeto, e);
            throw new IllegalStateException(
                    "No se pudo generar el enlace del comprobante: " + e.getMessage(), e);
        }
    }
}
