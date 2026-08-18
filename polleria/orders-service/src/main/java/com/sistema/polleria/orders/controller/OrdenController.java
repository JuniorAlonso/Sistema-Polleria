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
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/ordenes")
@RequiredArgsConstructor
public class OrdenController {

    private final OrdenService ordenService;

    // Cliente, mozo o chatbot crean una orden
    @PostMapping
    public ResponseEntity<OrdenResponse> crear(
            @Valid @RequestBody CrearOrdenRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        Long usuarioId = extraerUserId(userDetails);
        return ResponseEntity.status(HttpStatus.CREATED).body(ordenService.crear(request, usuarioId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrdenResponse> obtener(@PathVariable Long id) {
        return ResponseEntity.ok(ordenService.obtener(id));
    }

    // Vista cocina — solo pedidos pendientes y en preparación
    @GetMapping("/cocina")
    @PreAuthorize("hasAnyRole('ADMIN', 'COCINA')")
    public ResponseEntity<List<OrdenResponse>> listarParaCocina() {
        return ResponseEntity.ok(ordenService.listarParaCocina());
    }

    // Vista admin — todos los activos
    @GetMapping("/activos")
    @PreAuthorize("hasAnyRole('ADMIN', 'MOZO')")
    public ResponseEntity<List<OrdenResponse>> listarActivos() {
        return ResponseEntity.ok(ordenService.listarActivos());
    }

    // Historial del cliente autenticado
    @GetMapping("/mis-ordenes")
    public ResponseEntity<List<OrdenResponse>> misOrdenes(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        Long clienteId = extraerUserId(userDetails);
        return ResponseEntity.ok(ordenService.listarPorCliente(clienteId));
    }

    // Filtrar por estado
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MOZO', 'COCINA', 'REPARTIDOR')")
    public ResponseEntity<List<OrdenResponse>> listarPorEstado(
            @RequestParam(required = false) OrdenEstado estado
    ) {
        if (estado != null) {
            return ResponseEntity.ok(ordenService.listarPorEstado(estado));
        }
        return ResponseEntity.ok(ordenService.listarActivos());
    }

    // Cocina, mozo o repartidor actualizan el estado
    @PatchMapping("/{id}/estado")
    @PreAuthorize("hasAnyRole('ADMIN', 'MOZO', 'COCINA', 'REPARTIDOR')")
    public ResponseEntity<OrdenResponse> actualizarEstado(
            @PathVariable Long id,
            @Valid @RequestBody ActualizarEstadoRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        Long usuarioId = extraerUserId(userDetails);
        return ResponseEntity.ok(ordenService.actualizarEstado(id, request, usuarioId));
    }

    private Long extraerUserId(UserDetails userDetails) {
        // El username es el email; el ID real viene en el token como claim
        // Por simplicidad usamos 0L como fallback — en producción extraer del JWT directamente
        return 0L;
    }
}
