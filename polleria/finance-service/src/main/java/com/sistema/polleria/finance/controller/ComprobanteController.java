package com.sistema.polleria.finance.controller;

import com.sistema.polleria.finance.dto.ComprobanteResponse;
import com.sistema.polleria.finance.dto.EmitirComprobanteRequest;
import com.sistema.polleria.finance.service.ComprobanteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/finanzas/comprobantes")
@RequiredArgsConstructor
public class ComprobanteController {

    private final ComprobanteService comprobanteService;

    /**
     * Issues the receipt of an order (D3.18). The emitter is the user of the JWT (D3.6); an
     * internal call has no user, so {@code emitidoPor} stays null.
     */
    @PostMapping
    @PreAuthorize("hasAnyAuthority('ADMIN','CAJERO','INTERNAL')")
    public ResponseEntity<ComprobanteResponse> emitir(
            @Valid @RequestBody EmitirComprobanteRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(comprobanteService.emitir(request, usuarioId(authentication), authorization));
    }

    /**
     * Staff only (D3.5): the receipt does not store its owner ({@code emitidoPor} is the cashier),
     * so a customer could read any order's tax data. Customers keep the printed ticket.
     */
    @GetMapping("/orden/{ordenId}")
    @PreAuthorize("hasAnyAuthority('ADMIN','CAJERO')")
    public ResponseEntity<ComprobanteResponse> obtenerPorOrden(@PathVariable Long ordenId) {
        return ResponseEntity.ok(comprobanteService.obtenerPorOrdenId(ordenId));
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ADMIN', 'CAJERO')")
    public ResponseEntity<List<ComprobanteResponse>> listarTodos() {
        return ResponseEntity.ok(comprobanteService.listarTodos());
    }

    private static Long usuarioId(Authentication authentication) {
        return authentication != null && authentication.getCredentials() instanceof Long id ? id : null;
    }
}
