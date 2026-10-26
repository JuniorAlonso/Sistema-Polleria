package com.sistema.polleria.auth.controller;

import com.sistema.polleria.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

/** Service-to-service lookups. Every endpoint requires the internal API key; never used by browsers. */
@RestController
@RequestMapping("/auth/internal")
@RequiredArgsConstructor
public class InternalUsuarioController {

    private final UserRepository userRepository;

    @Value("${internal.api-key:}")
    private String internalApiKey;

    /** E-mail of a registered user, used by orders-service to block it on PEDIDO_FANTASMA. */
    @GetMapping("/usuarios/{id}/email")
    public ResponseEntity<Map<String, String>> emailDeUsuario(
            @PathVariable Long id,
            @RequestHeader(value = "X-Internal-Key", required = false) String claveInterna) {
        if (!esLlamadaInterna(claveInterna)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return userRepository.findById(id)
                .filter(u -> u.getEmail() != null && !u.getEmail().isBlank())
                .map(u -> ResponseEntity.ok(Map.of("email", u.getEmail())))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    private boolean esLlamadaInterna(String claveInterna) {
        return internalApiKey != null && !internalApiKey.isBlank() && claveInterna != null
                && MessageDigest.isEqual(internalApiKey.getBytes(StandardCharsets.UTF_8),
                                         claveInterna.getBytes(StandardCharsets.UTF_8));
    }
}
