package com.sistema.polleria.auth.controller;

import com.sistema.polleria.auth.dto.CrearSancionRequest;
import com.sistema.polleria.auth.dto.VerificarSancionResponse;
import com.sistema.polleria.auth.entity.SancionCliente;
import com.sistema.polleria.auth.service.SancionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@Slf4j
@RestController
@RequestMapping("/auth/sanciones")
@RequiredArgsConstructor
public class SancionController {

    private final SancionService sancionService;

    @Value("${internal.api-key:}")
    private String internalApiKey;

    /**
     * Consulta pública para el checkout web o personal: verifica si un cliente
     * (por celular, correo o dirección IP) tiene sanción activa para pago contraentrega en efectivo.
     */
    @GetMapping("/verificar")
    public ResponseEntity<VerificarSancionResponse> verificarSancion(
            @RequestParam(required = false) String telefono,
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String ip) {
        return ResponseEntity.ok(sancionService.verificarSancion(telefono, email, ip));
    }

    /**
     * Registro de sanción permanente.
     * Invocado por orders-service (vía X-Internal-Key ante PEDIDO_FANTASMA) o manualmente por ADMIN.
     */
    @PostMapping
    public ResponseEntity<SancionCliente> registrarSancion(
            @Valid @RequestBody CrearSancionRequest request,
            @RequestHeader(value = "X-Internal-Key", required = false) String claveInterna,
            Authentication authentication) {

        boolean esInterno = esLlamadaInterna(claveInterna);
        boolean esAdmin = authentication != null && authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ADMIN") || a.getAuthority().equals("ROLE_ADMIN"));

        if (!esInterno && !esAdmin) {
            throw new AccessDeniedException("Solo el sistema interno o un administrador pueden registrar sanciones");
        }

        String autor = esInterno ? "SISTEMA_PEDIDO_FANTASMA" : authentication.getName();
        SancionCliente sancion = sancionService.registrarSancion(request, autor);
        return ResponseEntity.status(HttpStatus.CREATED).body(sancion);
    }

    private boolean esLlamadaInterna(String claveInterna) {
        return internalApiKey != null && !internalApiKey.isBlank() && claveInterna != null
                && MessageDigest.isEqual(internalApiKey.getBytes(StandardCharsets.UTF_8),
                                         claveInterna.getBytes(StandardCharsets.UTF_8));
    }
}
