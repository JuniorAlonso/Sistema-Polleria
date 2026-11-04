package com.sistema.polleria.payments.service;

import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MinioClient;
import io.minio.http.Method;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

/**
 * Firma el enlace de vida corta con el que el ADMIN ve el comprobante de Yape (T6c, S7).
 *
 * <p>El bucket queda privado: nadie obtiene acceso permanente al archivo ni la clave del objeto
 * fuera del rol {@code ADMIN}. Este servicio solo firma; la autorización vive en el controlador.
 *
 * <p>La URL se genera localmente (SigV4, sin llamada a MinIO) porque el cliente tiene la región
 * fija; {@code MINIO_BUCKET} es el mismo bucket del notification-service.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FirmadorComprobantes {

    private final MinioClient minioClient;

    /** Bucket de los comprobantes; el mismo default que usa el notification-service. */
    @Value("${MINIO_BUCKET:polleria-comprobantes}")
    private String bucket;

    /** Vida de la URL firmada, corta a propósito (default 5 minutos). */
    @Value("${MINIO_URL_EXPIRACION_SEGUNDOS:300}")
    private int expiracionSegundos;

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
