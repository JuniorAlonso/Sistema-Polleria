package com.sistema.polleria.inventory.controller;

import com.sistema.polleria.inventory.dto.ResolucionProductoFantasmaRequest;
import com.sistema.polleria.inventory.dto.ResolucionProductoFantasmaResponse;
import com.sistema.polleria.inventory.service.ResolucionProductoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/inventario/pedidos-fantasma")
@RequiredArgsConstructor
public class ResolucionProductoController {

    private final ResolucionProductoService resolucionProductoService;

    @PostMapping("/resolver")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN', 'CAJERO', 'ROLE_CAJERO', 'COCINA', 'ROLE_COCINA')")
    public ResponseEntity<ResolucionProductoFantasmaResponse> resolver(
            @Valid @RequestBody ResolucionProductoFantasmaRequest request,
            Authentication authentication) {
        Long usuarioId = authentication != null ? 1L : 0L;
        return ResponseEntity.ok(resolucionProductoService.resolver(request, usuarioId));
    }
}
