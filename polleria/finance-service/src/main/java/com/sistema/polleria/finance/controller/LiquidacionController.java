package com.sistema.polleria.finance.controller;

import com.sistema.polleria.finance.dto.AperturaLiquidacionRequest;
import com.sistema.polleria.finance.dto.CierreLiquidacionRequest;
import com.sistema.polleria.finance.dto.LiquidacionResponse;
import com.sistema.polleria.finance.service.LiquidacionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/finanzas/liquidaciones")
@RequiredArgsConstructor
public class LiquidacionController {

    private final LiquidacionService liquidacionService;

    @PostMapping("/apertura")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'CAJERO')")
    public ResponseEntity<LiquidacionResponse> abrir(
            @Valid @RequestBody AperturaLiquidacionRequest req,
            Authentication authentication) {
        Long usuarioId = extraerUserId(authentication);
        return ResponseEntity.status(HttpStatus.CREATED).body(liquidacionService.abrir(req, usuarioId));
    }

    @PostMapping("/{id}/cierre")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'CAJERO')")
    public ResponseEntity<LiquidacionResponse> cerrar(
            @PathVariable Long id,
            @Valid @RequestBody CierreLiquidacionRequest req,
            Authentication authentication) {
        Long usuarioId = extraerUserId(authentication);
        return ResponseEntity.ok(liquidacionService.cerrar(id, req, usuarioId));
    }

    @GetMapping("/repartidor/{repartidorId}")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'CAJERO', 'REPARTIDOR')")
    public ResponseEntity<List<LiquidacionResponse>> listarPorRepartidor(@PathVariable Long repartidorId) {
        return ResponseEntity.ok(liquidacionService.listarPorRepartidor(repartidorId));
    }

    @GetMapping("/abiertas")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'CAJERO')")
    public ResponseEntity<List<LiquidacionResponse>> listarAbiertas() {
        return ResponseEntity.ok(liquidacionService.listarAbiertas());
    }

    private Long extraerUserId(Authentication authentication) {
        if (authentication instanceof org.springframework.security.authentication.UsernamePasswordAuthenticationToken token) {
            Object creds = token.getCredentials();
            if (creds instanceof Long id) return id;
            if (creds instanceof Integer id) return id.longValue();
            if (creds instanceof String s) {
                try {
                    return Long.parseLong(s);
                } catch (NumberFormatException ignored) {}
            }
        }
        return 1L;
    }
}
