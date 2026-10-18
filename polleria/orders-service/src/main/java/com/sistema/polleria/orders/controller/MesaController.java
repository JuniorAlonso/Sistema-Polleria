package com.sistema.polleria.orders.controller;

import com.sistema.polleria.orders.dto.*;
import com.sistema.polleria.orders.service.MesaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/mesas")
@RequiredArgsConstructor
public class MesaController {

    private final MesaService mesaService;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ADMIN', 'MOZO')")
    public ResponseEntity<List<MesaResponse>> listar(
            @RequestParam(required = false, defaultValue = "false") boolean incluirInactivas
    ) {
        return ResponseEntity.ok(mesaService.listarTodas(incluirInactivas));
    }

    @GetMapping("/libres")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'MOZO')")
    public ResponseEntity<List<MesaResponse>> listarLibres() {
        return ResponseEntity.ok(mesaService.listarLibres());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'MOZO')")
    public ResponseEntity<MesaResponse> obtener(@PathVariable Long id) {
        return ResponseEntity.ok(mesaService.obtener(id));
    }

    @GetMapping("/{id}/orden-activa")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'MOZO')")
    public ResponseEntity<OrdenActivaResponse> obtenerOrdenActiva(@PathVariable Long id) {
        OrdenActivaResponse ordenActiva = mesaService.obtenerOrdenActiva(id);
        if (ordenActiva == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(ordenActiva);
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<MesaResponse> crear(@Valid @RequestBody CrearMesaRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(mesaService.crear(
                        request.getNumero(),
                        request.getCapacidad(),
                        request.getPosicionX(),
                        request.getPosicionY(),
                        request.getZona()
                ));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<MesaResponse> actualizar(
            @PathVariable Long id,
            @Valid @RequestBody ActualizarMesaRequest request
    ) {
        return ResponseEntity.ok(mesaService.actualizarMesa(id, request));
    }

    @RequestMapping(value = "/{id}/estado", method = {RequestMethod.PATCH, RequestMethod.PUT})
    @PreAuthorize("hasAnyAuthority('ADMIN', 'MOZO')")
    public ResponseEntity<MesaResponse> actualizarEstado(
            @PathVariable Long id,
            @Valid @RequestBody ActualizarEstadoMesaRequest request,
            Authentication authentication
    ) {
        // `forzar` saltea las guardas de estado y de comanda activa: es una contingencia de
        // administración, no una operación de mozo. Sin esta restricción, un mozo podía dejar
        // una mesa LIBRE con una comanda activa (la orden quedaba huérfana e inutilizable).
        if (Boolean.TRUE.equals(request.getForzar()) && !esAdmin(authentication)) {
            throw new AccessDeniedException(
                    "Solo un administrador puede forzar un cambio de estado de mesa.");
        }
        return ResponseEntity.ok(mesaService.actualizarEstado(id, request.getEstado(), request.getForzar()));
    }

    private boolean esAdmin(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(a -> "ADMIN".equals(a.getAuthority()));
    }

    @RequestMapping(value = "/{id}/posicion", method = {RequestMethod.PATCH, RequestMethod.PUT})
    @PreAuthorize("hasAnyAuthority('ADMIN', 'MOZO')")
    public ResponseEntity<MesaResponse> actualizarPosicion(
            @PathVariable Long id,
            @Valid @RequestBody ActualizarPosicionMesaRequest request
    ) {
        return ResponseEntity.ok(mesaService.actualizarPosicion(id, request.getPosicionX(), request.getPosicionY()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        mesaService.eliminar(id);
        return ResponseEntity.noContent().build();
    }
}
