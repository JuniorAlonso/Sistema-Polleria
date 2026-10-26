package com.sistema.polleria.finance.controller;

import com.sistema.polleria.finance.dto.ComprobanteResponse;
import com.sistema.polleria.finance.dto.EmitirComprobanteRequest;
import com.sistema.polleria.finance.service.ComprobanteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

@RestController
@RequestMapping("/finanzas/comprobantes")
@RequiredArgsConstructor
public class ComprobanteController {

    private final ComprobanteService comprobanteService;

    @Value("${internal.api-key:}")
    private String internalApiKey;

    @PostMapping
    public ResponseEntity<ComprobanteResponse> emitir(
            @Valid @RequestBody EmitirComprobanteRequest request,
            @RequestHeader(value = "X-Internal-Key", required = false) String claveInterna,
            Authentication authentication) {

        boolean esInterno = esLlamadaInterna(claveInterna);
        boolean esPersonal = authentication != null && authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ADMIN") || a.getAuthority().equals("CAJERO") || a.getAuthority().equals("COCINA"));

        if (!esInterno && !esPersonal) {
            throw new AccessDeniedException("No autorizado para emitir comprobantes de pago");
        }

        Long usuarioId = authentication != null ? 1L : 0L;
        return ResponseEntity.status(HttpStatus.CREATED).body(comprobanteService.emitir(request, usuarioId));
    }

    @GetMapping("/orden/{ordenId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ComprobanteResponse> obtenerPorOrden(@PathVariable Long ordenId) {
        return ResponseEntity.ok(comprobanteService.obtenerPorOrdenId(ordenId));
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ADMIN', 'CAJERO')")
    public ResponseEntity<List<ComprobanteResponse>> listarTodos() {
        return ResponseEntity.ok(comprobanteService.listarTodos());
    }

    private boolean esLlamadaInterna(String claveInterna) {
        return internalApiKey != null && !internalApiKey.isBlank() && claveInterna != null
                && MessageDigest.isEqual(internalApiKey.getBytes(StandardCharsets.UTF_8),
                                         claveInterna.getBytes(StandardCharsets.UTF_8));
    }
}
