package com.sistema.polleria.payments.config;

import io.minio.MinioClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Cliente MinIO de {@code payments-service} (T6c, S7).
 *
 * <p>Este servicio no sube ni descarga el comprobante: eso es T6b, en el notification-service. El
 * cliente existe aquí solo para firmar URLs de vida corta del objeto que el ADMIN necesita ver, así
 * que el bucket se mantiene privado y la clave del objeto no se expone a otros roles.
 *
 * <p>La configuración son las **mismas variables de entorno y defaults** que usa el
 * notification-service ({@code src/config.js}): {@code MINIO_ENDPOINT} (default {@code localhost}),
 * {@code MINIO_PORT} (9000), {@code MINIO_USE_SSL} (false), {@code MINIO_ACCESS_KEY} y
 * {@code MINIO_SECRET_KEY} ({@code minioadmin} en desarrollo) y {@code MINIO_BUCKET}
 * ({@code polleria-comprobantes}). Se leen directo del entorno para no tocar
 * {@code application.properties}.
 *
 * <p>La región se fija en {@code us-east-1} (la de MinIO por defecto) a propósito: sin ella el SDK
 * resolvería la región del bucket con una llamada {@code GetBucketLocation} y la firma dejaría de
 * ser una operación local. Con la región fija, la URL se firma sin hablar con MinIO.
 */
@Configuration
public class MinioConfig {

    /** Región por defecto de MinIO; fija la firma SigV4 como operación local. */
    static final String REGION_MINIO_POR_DEFECTO = "us-east-1";

    @Bean
    public MinioClient minioClient(
            @Value("${MINIO_ENDPOINT:localhost}") String endpoint,
            @Value("${MINIO_PORT:9000}") int port,
            @Value("${MINIO_USE_SSL:false}") boolean useSsl,
            @Value("${MINIO_ACCESS_KEY:minioadmin}") String accessKey,
            @Value("${MINIO_SECRET_KEY:minioadmin}") String secretKey) {
        return MinioClient.builder()
                .endpoint(endpoint, port, useSsl)
                .credentials(accessKey, secretKey)
                .region(REGION_MINIO_POR_DEFECTO)
                .build();
    }
}
