package com.sistema.polleria.incident.controller;

import com.sistema.polleria.incident.dto.CrearIncidenteRequest;
import com.sistema.polleria.incident.dto.IncidenteResponse;
import com.sistema.polleria.incident.dto.ResolverIncidenteRequest;
import com.sistema.polleria.incident.entity.EstadoIncidente;
import com.sistema.polleria.incident.entity.Severidad;
import com.sistema.polleria.incident.service.IncidenteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/incidentes")
@RequiredArgsConstructor
public class IncidenteController {

    private final IncidenteService incidenteService;

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN', 'COCINA', 'ROLE_COCINA', 'MOZO', 'ROLE_MOZO')")
    public ResponseEntity<IncidenteResponse> registrar(@Valid @RequestBody CrearIncidenteRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(incidenteService.registrar(req));
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
