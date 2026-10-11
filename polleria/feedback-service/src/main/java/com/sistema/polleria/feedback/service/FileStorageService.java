package com.sistema.polleria.feedback.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Slf4j
@Service
public class FileStorageService {

    private final Path storageLocation;

    public FileStorageService(@Value("${storage.upload-dir:./uploads/evidencias}") String uploadDir) {
        this.storageLocation = Paths.get(uploadDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.storageLocation);
        } catch (IOException e) {
            log.error("No se pudo inicializar directorio de almacenamiento: {}", e.getMessage());
        }
    }

    public String guardarArchivo(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return null;
        }

        try {
            String originalFilename = file.getOriginalFilename();
            String extension = "";
            if (originalFilename != null && originalFilename.contains(".")) {
                extension = originalFilename.substring(originalFilename.lastIndexOf("."));
            }
            String fileName = UUID.randomUUID().toString() + extension;
            Path targetLocation = this.storageLocation.resolve(fileName);
            Files.copy(file.getInputStream(), targetLocation, StandardCopyOption.REPLACE_EXISTING);
            log.info("Evidencia guardada: {}", fileName);
            return "/feedback/evidencias/" + fileName;
        } catch (IOException e) {
            log.error("Error al guardar archivo de evidencia: {}", e.getMessage());
            throw new RuntimeException("Error al procesar la evidencia fotográfica", e);
        }
    }

    public byte[] leerArchivo(String fileName) throws IOException {
        Path filePath = this.storageLocation.resolve(fileName).normalize();
        if (!Files.exists(filePath)) {
            throw new IOException("Archivo no encontrado: " + fileName);
        }
        return Files.readAllBytes(filePath);
    }
}
