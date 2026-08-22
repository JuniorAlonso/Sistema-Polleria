package com.sistema.polleria.orders.controller;

import com.sistema.polleria.orders.dto.ProductoRequest;
import com.sistema.polleria.orders.dto.ProductoResponse;
import com.sistema.polleria.orders.entity.Categoria;
import com.sistema.polleria.orders.service.ProductoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/productos")
@RequiredArgsConstructor
public class ProductoController {

    private final ProductoService productoService;

    @GetMapping
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

    @GetMapping("/{id}")
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
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<ProductoResponse> toggleDisponibilidad(@PathVariable Long id) {
        return ResponseEntity.ok(productoService.toggleDisponibilidad(id));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        productoService.eliminar(id);
        return ResponseEntity.noContent().build();
    }
}
