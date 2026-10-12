package com.sistema.polleria.inventory.controller;

import com.sistema.polleria.inventory.dto.CrearDespachoRequest;
import com.sistema.polleria.inventory.dto.DespachoResponse;
import com.sistema.polleria.inventory.service.DespachoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/inventario/despachos")
@RequiredArgsConstructor
public class DespachoController {

    private final DespachoService despachoService;

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN', 'COCINA', 'ROLE_COCINA')")
    public ResponseEntity<DespachoResponse> registrarDespacho(
            @Valid @RequestBody CrearDespachoRequest req,
            Principal principal) {
        Long solicitanteId = extractUserId(principal);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(despachoService.registrarDespacho(req, solicitanteId));
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN', 'COCINA', 'ROLE_COCINA')")
    public ResponseEntity<List<DespachoResponse>> listarTodos() {
        return ResponseEntity.ok(despachoService.listarTodos());
    }

    private Long extractUserId(Principal principal) {
        if (principal instanceof UsernamePasswordAuthenticationToken token) {
            Object creds = token.getCredentials();
            if (creds instanceof Long id) return id;
            if (creds instanceof Integer id) return id.longValue();
        }
        return 1L;
    }
}
