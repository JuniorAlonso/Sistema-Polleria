package com.sistema.polleria.payments.service;

import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MinioClient;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FirmadorComprobantesTest {

    private static MinioClient clienteInternoMinio() {
        return MinioClient.builder()
                .endpoint("minio", 9000, false)
                .credentials("minioadmin", "minioadmin")
                .region("us-east-1")
                .build();
    }

    @Test
    @DisplayName("usa localhost cuando MINIO_ENDPOINT es minio y MINIO_PUBLIC_ENDPOINT está vacío")
    void usaLocalhostCuandoEndpointEsMinioYPublicoVacio() {
        FirmadorComprobantes firmador = new FirmadorComprobantes(
                clienteInternoMinio(),
                "",
                "minio",
                9000,
                false,
                "minioadmin",
                "minioadmin");

        String url = firmador.urlFirmada("comprobantes/yape/142/captura.jpg");

        assertThat(url).startsWith("http://localhost:9000/polleria-comprobantes/comprobantes/yape/142/captura.jpg");
        assertThat(url).contains("X-Amz-Signature");
        assertThat(url).doesNotContain("http://minio:9000");
    }

    @Test
    @DisplayName("usa MINIO_PUBLIC_ENDPOINT cuando se configura URL completa o hostname público")
    void usaPublicEndpointConfigurado() {
        FirmadorComprobantes conUrlCompleta = new FirmadorComprobantes(
                clienteInternoMinio(),
                "https://cdn.polleria.local:9443",
                "minio",
                9000,
                false,
                "minioadmin",
                "minioadmin");

        String urlHttps = conUrlCompleta.urlFirmada("comprobantes/yape/142/captura.jpg");
        assertThat(urlHttps).startsWith("https://cdn.polleria.local:9443/polleria-comprobantes/comprobantes/yape/142/captura.jpg");
        assertThat(urlHttps).contains("X-Amz-Signature");

        FirmadorComprobantes conHost = new FirmadorComprobantes(
                clienteInternoMinio(),
                "127.0.0.1",
                "minio",
                9000,
                false,
                "minioadmin",
                "minioadmin");

        String urlIp = conHost.urlFirmada("comprobantes/yape/142/captura.jpg");
        assertThat(urlIp).startsWith("http://127.0.0.1:9000/polleria-comprobantes/comprobantes/yape/142/captura.jpg");
        assertThat(urlIp).contains("X-Amz-Signature");
    }

    @Test
    @DisplayName("PRESERVE: el constructor de un argumento delega en el MinioClient recibido")
    void constructorSimpleDelegaEnMinioClientRecibido() throws Exception {
        MinioClient mockClient = mock(MinioClient.class);
        when(mockClient.getPresignedObjectUrl(any(GetPresignedObjectUrlArgs.class)))
                .thenReturn("http://localhost:9000/polleria-comprobantes/comprobantes/yape/142/captura.jpg?X-Amz-Signature=ok");

        FirmadorComprobantes firmador = new FirmadorComprobantes(mockClient);
        String url = firmador.urlFirmada("comprobantes/yape/142/captura.jpg");

        assertThat(url).contains("X-Amz-Signature=ok");
        verify(mockClient).getPresignedObjectUrl(any(GetPresignedObjectUrlArgs.class));
    }
}
