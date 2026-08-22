package com.sistema.polleria.orders.controller;

import com.sistema.polleria.orders.dto.ActualizarEstadoRequest;
import com.sistema.polleria.orders.dto.CrearOrdenRequest;
import com.sistema.polleria.orders.dto.OrdenResponse;
import com.sistema.polleria.orders.entity.OrdenEstado;
import com.sistema.polleria.orders.service.OrdenService;
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
@RequestMapping("/ordenes")
@RequiredArgsConstructor
public class OrdenController {

    private final OrdenService ordenService;

    @PostMapping
    public ResponseEntity<OrdenResponse> crear(
            @Valid @RequestBody CrearOrdenRequest request,
            Principal principal
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ordenService.crear(request, extraerUserId(principal)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrdenResponse> obtener(@PathVariable Long id) {
        return ResponseEntity.ok(ordenService.obtener(id));
    }

    @GetMapping("/cocina")
    @PreAuthorize("hasAnyAuthority('ADMIN','COCINA')")
    public ResponseEntity<List<OrdenResponse>> listarParaCocina() {
        return ResponseEntity.ok(ordenService.listarParaCocina());
    }

    @GetMapping("/activos")
    @PreAuthorize("hasAnyAuthority('ADMIN','MOZO')")
    public ResponseEntity<List<OrdenResponse>> listarActivos() {
        return ResponseEntity.ok(ordenService.listarActivos());
    }

    @GetMapping("/mis-ordenes")
    public ResponseEntity<List<OrdenResponse>> misOrdenes(Principal principal) {
        return ResponseEntity.ok(ordenService.listarPorCliente(extraerUserId(principal)));
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ADMIN','MOZO','COCINA','REPARTIDOR')")
    public ResponseEntity<List<OrdenResponse>> listarPorEstado(
            @RequestParam(required = false) OrdenEstado estado
    ) {
        if (estado != null) {
            return ResponseEntity.ok(ordenService.listarPorEstado(estado));
        }
        return ResponseEntity.ok(ordenService.listarActivos());
    }

    @PatchMapping("/{id}/estado")
    @PreAuthorize("hasAnyAuthority('ADMIN','MOZO','COCINA','REPARTIDOR')")
    public ResponseEntity<OrdenResponse> actualizarEstado(
            @PathVariable Long id,
            @Valid @RequestBody ActualizarEstadoRequest request,
            Principal principal
    ) {
        return ResponseEntity.ok(ordenService.actualizarEstado(id, request, extraerUserId(principal)));
    }

    private Long extraerUserId(Principal principal) {
        if (principal instanceof UsernamePasswordAuthenticationToken token) {
            Object creds = token.getCredentials();
            if (creds instanceof Long id) return id;
            if (creds instanceof Integer id) return id.longValue();
        }
        return 0L;
    }
}
