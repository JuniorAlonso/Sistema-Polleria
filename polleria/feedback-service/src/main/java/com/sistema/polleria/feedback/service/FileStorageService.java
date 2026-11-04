package com.sistema.polleria.feedback.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.FileNotFoundException;
import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
public class FileStorageService {

    private static final Set<String> EXTENSIONES_VALIDAS = Set.of(".jpg", ".jpeg", ".png", ".webp");
    private static final Set<String> CONTENT_TYPES_VALIDOS = Set.of(
            "image/jpeg", "image/png", "image/webp"
    );

    private final Path storageLocation;

    public FileStorageService(@Value("${storage.upload-dir:./uploads/evidencias}") String uploadDir) {
        this.storageLocation = Paths.get(uploadDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.storageLocation);
        } catch (IOException e) {
            log.error("No se pudo inicializar directorio de almacenamiento: {}", e.getMessage());
            throw new IllegalStateException("No se pudo inicializar el almacenamiento de archivos", e);
        }
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

        // 2. Extraer y validar extensión
        String originalFilename = file.getOriginalFilename();
        String extension = "";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf(".")).toLowerCase();
        }

        if (!EXTENSIONES_VALIDAS.contains(extension)) {
            throw new IllegalArgumentException("Extensión de archivo no permitida. Solo se aceptan: " + EXTENSIONES_VALIDAS);
        }

        try {
            // 3. Generar UUID seguro para evitar inyección en nombres
            String fileName = UUID.randomUUID().toString() + extension;
            Path targetLocation = this.storageLocation.resolve(fileName).normalize();

            if (!targetLocation.startsWith(this.storageLocation)) {
                throw new SecurityException("Intento de path traversal detectado al guardar");
            }

            Files.copy(file.getInputStream(), targetLocation, StandardCopyOption.REPLACE_EXISTING);
            log.info("Evidencia guardada exitosamente: {}", fileName);
            return "/feedback/evidencias/" + fileName;
        } catch (IOException e) {
            log.error("Error al guardar archivo de evidencia: {}", e.getMessage());
            throw new RuntimeException("Error al procesar la evidencia fotográfica", e);
        }
    }

    public Resource cargarComoRecurso(String fileName) throws IOException {
        if (fileName == null || fileName.contains("..") || fileName.contains("/") || fileName.contains("\\")) {
            throw new SecurityException("Nombre de archivo inválido: " + fileName);
        }

        Path filePath = this.storageLocation.resolve(fileName).normalize();
        if (!filePath.startsWith(this.storageLocation)) {
            throw new SecurityException("Acceso a ruta no permitido: " + fileName);
        }

        if (!Files.exists(filePath) || !Files.isReadable(filePath)) {
            throw new FileNotFoundException("Archivo de evidencia no encontrado: " + fileName);
        }

        return new UrlResource(filePath.toUri());
    }

    public byte[] leerArchivo(String fileName) throws IOException {
        Resource resource = cargarComoRecurso(fileName);
        return resource.getContentAsByteArray();
    }
}
