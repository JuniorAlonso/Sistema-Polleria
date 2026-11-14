package com.sistema.polleria.orders.config;

import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Slf4j
@Configuration
public class MinioConfig {

    @Value("${minio.endpoint:localhost}")
    private String endpoint;

    @Value("${minio.port:9000}")
    private int port;

    @Value("${minio.use-ssl:false}")
    private boolean useSsl;

    @Value("${minio.access-key:minioadmin}")
    private String accessKey;

    @Value("${minio.secret-key:minioadmin}")
    private String secretKey;

    @Value("${minio.bucket.catalogo:polleria-catalogo}")
    private String bucketCatalogo;

    @Bean
    public MinioClient minioClient() {
        return MinioClient.builder()
                .endpoint(endpoint, port, useSsl)
                .credentials(accessKey, secretKey)
                .region("us-east-1")
                .build();
    }

    @Bean
    public String minioBucketCatalogo(MinioClient minioClient) {
        try {
            boolean existe = minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucketCatalogo).build());
            if (!existe) {
                minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucketCatalogo).build());
                log.info("Bucket '{}' creado en MinIO", bucketCatalogo);
            }
        } catch (Exception e) {
            log.warn("No se pudo verificar/crear el bucket '{}': {}. Continuando sin MinIO.", bucketCatalogo, e.getMessage());
        }
        return bucketCatalogo;
    }
}
