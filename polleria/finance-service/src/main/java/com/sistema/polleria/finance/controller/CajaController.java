package com.sistema.polleria.finance.controller;

import com.sistema.polleria.finance.dto.AperturaCajaRequest;
import com.sistema.polleria.finance.dto.ArqueoCajaResponse;
import com.sistema.polleria.finance.dto.CierreCajaRequest;
import com.sistema.polleria.finance.dto.MovimientoCajaRequest;
import com.sistema.polleria.finance.entity.MovimientoCaja;
import com.sistema.polleria.finance.service.CajaService;
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
@RequestMapping("/finanzas/caja")
@RequiredArgsConstructor
public class CajaController {

    private final CajaService cajaService;

    @PostMapping("/apertura")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN', 'CAJERO', 'ROLE_CAJERO')")
    public ResponseEntity<ArqueoCajaResponse> abrirCaja(
            @Valid @RequestBody AperturaCajaRequest req,
            Principal principal) {
        Long usuarioId = extractUserId(principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(cajaService.abrirCaja(req, usuarioId));
    }

    @GetMapping("/actual")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN', 'CAJERO', 'ROLE_CAJERO')")
    public ResponseEntity<ArqueoCajaResponse> obtenerCajaActual() {
        return ResponseEntity.ok(cajaService.obtenerCajaActual());
    }

    @PostMapping("/movimientos")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN', 'CAJERO', 'ROLE_CAJERO')")
    public ResponseEntity<MovimientoCaja> registrarMovimiento(
            @Valid @RequestBody MovimientoCajaRequest req,
            Principal principal) {
        Long usuarioId = extractUserId(principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(cajaService.registrarMovimiento(req, usuarioId));
    }

    @PostMapping("/cierre")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN', 'CAJERO', 'ROLE_CAJERO')")
    public ResponseEntity<ArqueoCajaResponse> cerrarCaja(
            @RequestParam(value = "arqueoId", required = false) Long arqueoId,
            @Valid @RequestBody CierreCajaRequest req,
            Principal principal) {
        Long usuarioId = extractUserId(principal);
        return ResponseEntity.ok(cajaService.cerrarCaja(arqueoId, req, usuarioId));
    }

    @GetMapping("/historial")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<List<ArqueoCajaResponse>> listarHistorial() {
        return ResponseEntity.ok(cajaService.listarHistorial());
    }

    private Long extractUserId(Principal principal) {
        if (principal instanceof UsernamePasswordAuthenticationToken token) {
            Object creds = token.getCredentials();
            if (creds instanceof Long id) return id;
            if (creds instanceof Integer id) return id.longValue();
        }
        return 1L;
    }
}
