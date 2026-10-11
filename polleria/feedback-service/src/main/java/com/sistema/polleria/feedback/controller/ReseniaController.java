package com.sistema.polleria.feedback.controller;

import com.sistema.polleria.feedback.dto.CrearReseniaRequest;
import com.sistema.polleria.feedback.dto.ProductoReseniasResponse;
import com.sistema.polleria.feedback.dto.ReseniaResponse;
import com.sistema.polleria.feedback.service.ReseniaService;
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
@RequestMapping("/feedback/resenias")
@RequiredArgsConstructor
public class ReseniaController {

    private final ReseniaService reseniaService;

    @PostMapping
    @PreAuthorize("hasAnyAuthority('CLIENTE', 'ROLE_CLIENTE', 'ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<ReseniaResponse> crear(
            @Valid @RequestBody CrearReseniaRequest request,
            Principal principal) {
        Long clienteId = extractUserId(principal);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(reseniaService.crear(request, clienteId));
    }

    @GetMapping
    public ResponseEntity<List<ReseniaResponse>> listarTodas() {
        return ResponseEntity.ok(reseniaService.listarTodas());
    }

    @GetMapping("/producto/{productoId}")
    public ResponseEntity<ProductoReseniasResponse> porProducto(@PathVariable Long productoId) {
        return ResponseEntity.ok(reseniaService.obtenerResumenProducto(productoId));
    }

    @GetMapping("/orden/{ordenId}")
    public ResponseEntity<List<ReseniaResponse>> porOrden(@PathVariable Long ordenId) {
        return ResponseEntity.ok(reseniaService.listarPorOrden(ordenId));
    }

    @GetMapping("/mis-resenias")
    @PreAuthorize("hasAnyAuthority('CLIENTE', 'ROLE_CLIENTE', 'ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<List<ReseniaResponse>> misResenias(Principal principal) {
        Long clienteId = extractUserId(principal);
        return ResponseEntity.ok(reseniaService.listarPorCliente(clienteId));
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
