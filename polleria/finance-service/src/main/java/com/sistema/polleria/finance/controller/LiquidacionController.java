package com.sistema.polleria.finance.controller;

import com.sistema.polleria.finance.dto.*;
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

    @PostMapping("/{id}/recargar-fondo")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'CAJERO')")
    public ResponseEntity<LiquidacionResponse> recargarFondo(
            @PathVariable Long id,
            @Valid @RequestBody RecargaFondoRequest req,
            Authentication authentication) {
        Long usuarioId = extraerUserId(authentication);
        return ResponseEntity.ok(liquidacionService.recargarFondo(id, req, usuarioId));
    }

    @PostMapping("/{id}/cierre")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'CAJERO')")
    public ResponseEntity<LiquidacionResponse> cerrar(
            @PathVariable Long id,
            @Valid @RequestBody CierreLiquidacionRequest req,
            Authentication authentication,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long usuarioId = extraerUserId(authentication);
        return ResponseEntity.ok(liquidacionService.cerrar(id, req, usuarioId, authorization));
    }

    /**
     * Cobro de efectivo a un repartidor por parte de ADMIN o CAJERO.
     * Registra el ingreso en caja activa y disminuye el saldo pendiente del repartidor.
     */
    @PostMapping("/cobro-efectivo")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'CAJERO')")
    public ResponseEntity<CobroRepartidorResponse> registrarCobro(
            @Valid @RequestBody RegistrarCobroRepartidorRequest req,
            Authentication authentication,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long usuarioId = extraerUserId(authentication);
        return ResponseEntity.ok(liquidacionService.registrarCobro(req, usuarioId, authorization));
    }

    @GetMapping("/repartidor/{repartidorId}")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'CAJERO', 'REPARTIDOR')")
    public ResponseEntity<List<LiquidacionResponse>> listarPorRepartidor(@PathVariable Long repartidorId) {
        return ResponseEntity.ok(liquidacionService.listarPorRepartidor(repartidorId));
    }

    /** Historial de cobros de efectivo registrados para un repartidor. */
    @GetMapping("/repartidor/{repartidorId}/cobros")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'CAJERO', 'REPARTIDOR')")
    public ResponseEntity<List<CobroRepartidorResponse>> listarCobrosPorRepartidor(
            @PathVariable Long repartidorId,
            Authentication authentication) {
        boolean staff = authentication.getAuthorities().stream()
                .anyMatch(a -> "ADMIN".equals(a.getAuthority()) || "CAJERO".equals(a.getAuthority()));
        if (!staff && !repartidorId.equals(extraerUserId(authentication))) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Un repartidor solo puede consultar sus propios cobros");
        }
        return ResponseEntity.ok(liquidacionService.listarCobrosPorRepartidor(repartidorId));
    }

    /** Cash the courier must hand in (S6). A REPARTIDOR can only ask for his own id. */
    @GetMapping("/repartidor/{repartidorId}/pendiente")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'CAJERO', 'REPARTIDOR')")
    public ResponseEntity<EfectivoPendienteLiquidacionResponse> pendiente(
            @PathVariable Long repartidorId,
            Authentication authentication,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        boolean staff = authentication.getAuthorities().stream()
                .anyMatch(a -> "ADMIN".equals(a.getAuthority()) || "CAJERO".equals(a.getAuthority()));
        if (!staff && !repartidorId.equals(extraerUserId(authentication))) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Un repartidor solo puede consultar su propio efectivo");
        }
        return ResponseEntity.ok(liquidacionService.efectivoPendiente(repartidorId, authorization));
    }

    @GetMapping("/abiertas")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'CAJERO')")
    public ResponseEntity<List<LiquidacionResponse>> listarAbiertas() {
        return ResponseEntity.ok(liquidacionService.listarAbiertas());
    }

    @GetMapping("/repartidores/pendientes")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'CAJERO')")
    public ResponseEntity<List<RepartidorPendienteCobroResponse>> listarRepartidoresConPendiente(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        return ResponseEntity.ok(liquidacionService.listarRepartidoresConPendiente(authorization));
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
