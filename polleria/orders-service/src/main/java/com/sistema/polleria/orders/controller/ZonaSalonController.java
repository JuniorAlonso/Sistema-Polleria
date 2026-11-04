package com.sistema.polleria.orders.controller;

import com.sistema.polleria.orders.dto.ZonaSalonDTO;
import com.sistema.polleria.orders.service.ZonaSalonService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/zonas")
@RequiredArgsConstructor
public class ZonaSalonController {

    private final ZonaSalonService zonaSalonService;

    @GetMapping
    public ResponseEntity<List<ZonaSalonDTO>> listarZonas() {
        return ResponseEntity.ok(zonaSalonService.listarTodas());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ZonaSalonDTO> obtenerPorId(@PathVariable Long id) {
        return ResponseEntity.ok(zonaSalonService.obtenerPorId(id));
    }

    @PutMapping("/{id}/dimensiones")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERADMIN', 'MOZO')")
    public ResponseEntity<ZonaSalonDTO> actualizarDimensiones(
            @PathVariable Long id,
            @RequestBody Map<String, Integer> dimensiones) {
        Integer filas = dimensiones.get("filas");
        Integer columnas = dimensiones.get("columnas");
        return ResponseEntity.ok(zonaSalonService.actualizarDimensiones(id, filas, columnas));
    }
}
