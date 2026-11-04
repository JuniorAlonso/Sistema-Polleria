package com.sistema.polleria.incident.controller;

import com.sistema.polleria.incident.dto.CrearIncidenteRequest;
import com.sistema.polleria.incident.dto.IncidenteResponse;
import com.sistema.polleria.incident.dto.ResolverIncidenteRequest;
import com.sistema.polleria.incident.entity.EstadoIncidente;
import com.sistema.polleria.incident.entity.Severidad;
import com.sistema.polleria.incident.service.IncidenteService;
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
@RequestMapping("/incidentes")
@RequiredArgsConstructor
public class IncidenteController {

    private final IncidenteService incidenteService;

    @Value("${internal.api-key:}")
    private String internalApiKey;

    @PostMapping
    public ResponseEntity<IncidenteResponse> registrar(
            @Valid @RequestBody CrearIncidenteRequest req,
            @RequestHeader(value = "X-Internal-Key", required = false) String claveInterna,
            Authentication authentication) {

        boolean esInterno = esLlamadaInterna(claveInterna);
        boolean esPersonal = authentication != null && authentication.getAuthorities().stream()
                .anyMatch(a -> List.of("ADMIN", "ROLE_ADMIN", "COCINA", "ROLE_COCINA", "MOZO", "ROLE_MOZO")
                        .contains(a.getAuthority()));

        if (!esInterno && !esPersonal) {
            throw new AccessDeniedException("No autorizado para registrar incidentes");
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(incidenteService.registrar(req));
    }

    private boolean esLlamadaInterna(String claveInterna) {
        return internalApiKey != null && !internalApiKey.isBlank() && claveInterna != null
                && MessageDigest.isEqual(internalApiKey.getBytes(StandardCharsets.UTF_8),
                                         claveInterna.getBytes(StandardCharsets.UTF_8));
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN', 'COCINA', 'ROLE_COCINA')")
    public ResponseEntity<List<IncidenteResponse>> listar(
            @RequestParam(value = "severidad", required = false) Severidad severidad,
            @RequestParam(value = "estado", required = false) EstadoIncidente estado) {
        return ResponseEntity.ok(incidenteService.listar(severidad, estado));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN', 'COCINA', 'ROLE_COCINA')")
    public ResponseEntity<IncidenteResponse> obtenerPorId(@PathVariable Long id) {
        return ResponseEntity.ok(incidenteService.obtenerPorId(id));
    }

    @PatchMapping("/{id}/resolver")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<IncidenteResponse> resolver(
            @PathVariable Long id,
            @Valid @RequestBody ResolverIncidenteRequest req) {
        return ResponseEntity.ok(incidenteService.resolver(id, req));
    }
}
