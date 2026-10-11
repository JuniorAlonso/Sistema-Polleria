package com.sistema.polleria.inventory.controller;

import com.sistema.polleria.inventory.dto.ActualizarStockRequest;
import com.sistema.polleria.inventory.dto.CrearInsumoRequest;
import com.sistema.polleria.inventory.dto.InsumoResponse;
import com.sistema.polleria.inventory.service.InsumoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/inventario/insumos")
@RequiredArgsConstructor
public class InsumoController {

    private final InsumoService insumoService;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN', 'CHEF', 'ROLE_CHEF')")
    public ResponseEntity<List<InsumoResponse>> listarTodos() {
        return ResponseEntity.ok(insumoService.listarTodos());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN', 'CHEF', 'ROLE_CHEF')")
    public ResponseEntity<InsumoResponse> obtenerPorId(@PathVariable Long id) {
        return ResponseEntity.ok(insumoService.obtenerPorId(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<InsumoResponse> crear(@Valid @RequestBody CrearInsumoRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(insumoService.crear(req));
    }

    @PatchMapping("/{id}/stock")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN', 'CHEF', 'ROLE_CHEF')")
    public ResponseEntity<InsumoResponse> actualizarStock(
            @PathVariable Long id,
            @Valid @RequestBody ActualizarStockRequest req) {
        return ResponseEntity.ok(insumoService.actualizarStock(id, req));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        insumoService.eliminar(id);
        return ResponseEntity.noContent().build();
    }
}
