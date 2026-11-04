package com.sistema.polleria.payments.service;

import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@DisplayName("S3 - Validación de la captura subida por web")
class AlmacenComprobantesTest {

    private static final byte[] JPEG = {
            (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 16, 'J', 'F', 'I', 'F', 0, 1, 1, 0};

    private final MinioClient minio = mock(MinioClient.class);
    private final AlmacenComprobantes almacen = nuevoAlmacen();

    private AlmacenComprobantes nuevoAlmacen() {
        AlmacenComprobantes a = new AlmacenComprobantes(minio);
        ReflectionTestUtils.setField(a, "bucket", "polleria-comprobantes");
        ReflectionTestUtils.setField(a, "maxBytes", 1024L);
        return a;
    }

    @Test
    @DisplayName("una imagen JPEG válida se guarda con la clave comprobantes/yape/{orden}/{orden}-*.jpg")
    void guardaImagenValida() throws Exception {
        when(minio.bucketExists(any())).thenReturn(true);

        String clave = almacen.guardar(55L, new MockMultipartFile("file", "a.jpg", "image/jpeg", JPEG));

        assertThat(clave).matches("comprobantes/yape/55/55-[0-9a-f]{12}\\.jpg");
        verify(minio).putObject(any(PutObjectArgs.class));
    }

    @Test
    @DisplayName("rechaza tipos que no son imagen, firmas falsas, archivos vacíos y archivos grandes sin tocar MinIO")
    void rechazaArchivosInvalidos() throws Exception {
        assertThatThrownBy(() -> almacen.guardar(55L, new MockMultipartFile("file", "a.pdf", "application/pdf", JPEG)))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("imagen");
        assertThatThrownBy(() -> almacen.guardar(55L, new MockMultipartFile(
                "file", "a.jpg", "image/jpeg", "<script>alert(1)</script>".getBytes())))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("imagen válida");
        assertThatThrownBy(() -> almacen.guardar(55L, new MockMultipartFile("file", "a.jpg", "image/jpeg", new byte[0])))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> almacen.guardar(55L, new MockMultipartFile(
                "file", "a.jpg", "image/jpeg", new byte[2048])))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("tamaño");
        assertThatThrownBy(() -> almacen.guardar(55L, null)).isInstanceOf(IllegalArgumentException.class);
        verify(minio, never()).putObject(any(PutObjectArgs.class));
    }

    @Test
    @DisplayName("si MinIO falla se informa IllegalStateException")
    void minioCaido() throws Exception {
        when(minio.bucketExists(any())).thenThrow(new RuntimeException("sin conexion"));

        assertThatThrownBy(() -> almacen.guardar(55L, new MockMultipartFile("file", "a.jpg", "image/jpeg", JPEG)))
                .isInstanceOf(IllegalStateException.class);
    }
}
