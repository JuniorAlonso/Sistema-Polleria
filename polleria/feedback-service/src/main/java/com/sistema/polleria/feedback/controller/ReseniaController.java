package com.sistema.polleria.feedback.controller;

import com.sistema.polleria.feedback.dto.CrearReseniaRequest;
import com.sistema.polleria.feedback.dto.ProductoReseniasResponse;
import com.sistema.polleria.feedback.dto.ReseniaResponse;
import com.sistema.polleria.feedback.dto.ResponderReseniaRequest;
import com.sistema.polleria.feedback.security.SecurityUtils;
import com.sistema.polleria.feedback.service.ReseniaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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
        Long clienteId = SecurityUtils.obtenerUsuarioIdAutenticado(principal);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(reseniaService.crear(request, clienteId));
    }

    @GetMapping
    public ResponseEntity<List<ReseniaResponse>> listarTodas() {
        return ResponseEntity.ok(reseniaService.listarTodas());
    }

    @GetMapping("/admin/todas")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<List<ReseniaResponse>> listarTodasAdmin() {
        return ResponseEntity.ok(reseniaService.listarTodasAdmin());
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
        Long clienteId = SecurityUtils.obtenerUsuarioIdAutenticado(principal);
        return ResponseEntity.ok(reseniaService.listarPorCliente(clienteId));
    }

    @PatchMapping("/admin/{id}/responder")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<ReseniaResponse> responder(
            @PathVariable Long id,
            @Valid @RequestBody ResponderReseniaRequest request) {
        return ResponseEntity.ok(reseniaService.responder(id, request.getRespuestaAdmin()));
    }

    @PatchMapping("/admin/{id}/visibilidad")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<ReseniaResponse> cambiarVisibilidad(
            @PathVariable Long id,
            @RequestParam(defaultValue = "true") boolean visible) {
        return ResponseEntity.ok(reseniaService.cambiarVisibilidad(id, visible));
    }
}
