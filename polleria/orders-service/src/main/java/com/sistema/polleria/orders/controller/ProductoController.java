package com.sistema.polleria.orders.controller;

import com.sistema.polleria.orders.dto.ActualizarStockProductoRequest;
import com.sistema.polleria.orders.dto.ProductoRequest;
import com.sistema.polleria.orders.dto.ProductoResponse;
import com.sistema.polleria.orders.entity.Categoria;
import com.sistema.polleria.orders.service.MinioProductoService;
import com.sistema.polleria.orders.service.ProductoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.NoSuchElementException;

@RestController
@RequestMapping("/productos")
@RequiredArgsConstructor

public class ProductoController {

    private final ProductoService productoService;
    private final MinioProductoService minioProductoService;

    @GetMapping({"", "/"})
    public ResponseEntity<List<ProductoResponse>> listar(
            @RequestParam(required = false) Categoria categoria,
            @RequestParam(defaultValue = "true") boolean soloDisponibles
    ) {
        if (categoria != null) {
            return ResponseEntity.ok(productoService.listarPorCategoria(categoria, soloDisponibles));
        }
        return ResponseEntity.ok(soloDisponibles
                ? productoService.listarDisponibles()
                : productoService.listarTodos());
    }

    @GetMapping("/{id:[0-9]+}")
    public ResponseEntity<ProductoResponse> obtener(@PathVariable Long id) {
        return ResponseEntity.ok(productoService.obtener(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<ProductoResponse> crear(@Valid @RequestBody ProductoRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(productoService.crear(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<ProductoResponse> actualizar(
            @PathVariable Long id,
            @Valid @RequestBody ProductoRequest request
    ) {
        return ResponseEntity.ok(productoService.actualizar(id, request));
    }

    @PatchMapping("/{id}/disponibilidad")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN', 'COCINA', 'ROLE_COCINA')")
    public ResponseEntity<ProductoResponse> toggleDisponibilidad(@PathVariable Long id) {
        return ResponseEntity.ok(productoService.toggleDisponibilidad(id));
    }

    /** Subir/reemplazar imagen de un producto (solo ADMIN) */
    @PostMapping(value = "/{id}/imagen", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<ProductoResponse> subirImagen(
            @PathVariable Long id,
            @RequestParam("imagen") MultipartFile imagen) {
        String imagenUrl = minioProductoService.subirImagenProducto(id, imagen);
        // Actualizar imagenUrl en la entidad
        ProductoResponse response = productoService.actualizarImagenUrl(id, imagenUrl);
        return ResponseEntity.ok(response);
    }

    /** Servir imagen de producto directamente desde MinIO */
    @GetMapping("/{id}/imagen")
    public ResponseEntity<byte[]> verImagen(@PathVariable Long id) {
        try {
            byte[] bytes = minioProductoService.leerImagenProducto(id);
            String contentType = minioProductoService.resolverContentType(id);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"producto-" + id + "\"")
                    .contentType(MediaType.parseMediaType(contentType))
                    .body(bytes);
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PatchMapping("/{id}/stock")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<ProductoResponse> actualizarStock(
            @PathVariable Long id,
            @Valid @RequestBody ActualizarStockProductoRequest request
    ) {
        return ResponseEntity.ok(productoService.actualizarStock(id, request.getStock()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        productoService.eliminar(id);
        return ResponseEntity.noContent().build();
    }
}
