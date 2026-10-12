package com.sistema.polleria.orders.controller;

import com.sistema.polleria.orders.dto.ActualizarEstadoRequest;
import com.sistema.polleria.orders.dto.CrearOrdenRequest;
import com.sistema.polleria.orders.dto.OrdenResponse;
import com.sistema.polleria.orders.entity.OrdenEstado;
import com.sistema.polleria.orders.service.OrdenService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.Principal;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Set;

@RestController
@RequestMapping("/ordenes")
@RequiredArgsConstructor
public class OrdenController {

    private static final Set<String> ROLES_PERSONAL = Set.of("ADMIN", "MOZO", "COCINA", "REPARTIDOR", "CAJERO");
    private static final Set<String> ROLES_CAMBIO_ESTADO = Set.of("ADMIN", "MOZO", "COCINA", "REPARTIDOR", "CLIENTE");

    private final OrdenService ordenService;

    // Clave compartida con otros microservicios (p. ej. payments-service) para leer órdenes sin JWT
    @Value("${internal.api-key:}")
    private String internalApiKey;

    @PostMapping
    public ResponseEntity<OrdenResponse> crear(
            @Valid @RequestBody CrearOrdenRequest request,
            Principal principal
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ordenService.crear(request, extraerUserId(principal)));
    }

    /**
     * Un pedido solo lo ve su dueño, el personal o un microservicio con la clave interna.
     * A cualquier otro se le responde 404 para no revelar qué pedidos existen.
     */
    @GetMapping("/{id}")
    public ResponseEntity<OrdenResponse> obtener(
            @PathVariable Long id,
            Authentication authentication,
            @RequestHeader(value = "X-Internal-Key", required = false) String claveInterna
    ) {
        OrdenResponse orden = ordenService.obtener(id);
        if (esLlamadaInterna(claveInterna) || esPersonal(authentication) || esDueno(authentication, orden)) {
            return ResponseEntity.ok(orden);
        }
        throw new NoSuchElementException("Orden no encontrada: " + id);
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
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<OrdenResponse>> misOrdenes(Principal principal) {
        Long userId = extraerUserId(principal);
        if (userId <= 0) {
            return ResponseEntity.ok(List.of());
        }
        return ResponseEntity.ok(ordenService.listarPorCliente(userId));
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ADMIN','MOZO','COCINA','REPARTIDOR','CAJERO')")
    public ResponseEntity<List<OrdenResponse>> listar(
            @RequestParam(required = false) OrdenEstado estado,
            @RequestParam(required = false, defaultValue = "false") boolean soloActivos
    ) {
        if (estado != null) {
            return ResponseEntity.ok(ordenService.listarPorEstado(estado));
        }
        if (soloActivos) {
            return ResponseEntity.ok(ordenService.listarActivos());
        }
        return ResponseEntity.ok(ordenService.listarActivosYCompletadosHoy());
    }

    /**
     * Cambio de estado por el personal/cliente (JWT) o por payments-service con la clave interna
     * (p. ej. el webhook de Mercado Pago, que no trae JWT de usuario).
     */
    @PatchMapping("/{id}/estado")
    public ResponseEntity<OrdenResponse> actualizarEstado(
            @PathVariable Long id,
            @Valid @RequestBody ActualizarEstadoRequest request,
            Authentication authentication,
            @RequestHeader(value = "X-Internal-Key", required = false) String claveInterna
    ) {
        if (!esLlamadaInterna(claveInterna) && !tieneAlgunRol(authentication, ROLES_CAMBIO_ESTADO)) {
            throw new AccessDeniedException("No autorizado para cambiar el estado de la orden");
        }
        return ResponseEntity.ok(ordenService.actualizarEstado(id, request, extraerUserId(authentication)));
    }

    private boolean esLlamadaInterna(String claveInterna) {
        return internalApiKey != null && !internalApiKey.isBlank() && claveInterna != null
                && MessageDigest.isEqual(internalApiKey.getBytes(StandardCharsets.UTF_8),
                                         claveInterna.getBytes(StandardCharsets.UTF_8));
    }

    private boolean esPersonal(Authentication authentication) {
        return tieneAlgunRol(authentication, ROLES_PERSONAL);
    }

    private boolean tieneAlgunRol(Authentication authentication, Set<String> roles) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(a -> roles.contains(a.getAuthority()));
    }

    private boolean esDueno(Authentication authentication, OrdenResponse orden) {
        Long userId = extraerUserId(authentication);
        return userId > 0 && userId.equals(orden.getClienteId());
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
