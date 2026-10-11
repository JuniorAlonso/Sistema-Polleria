package com.sistema.polleria.orders.controller;

import com.sistema.polleria.orders.dto.ActualizarEstadoMesaRequest;
import com.sistema.polleria.orders.dto.ActualizarPosicionMesaRequest;
import com.sistema.polleria.orders.dto.CrearMesaRequest;
import com.sistema.polleria.orders.dto.MesaResponse;
import com.sistema.polleria.orders.service.MesaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/mesas")
@RequiredArgsConstructor
public class MesaController {

    private final MesaService mesaService;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ADMIN', 'MOZO', 'ROLE_ADMIN', 'ROLE_MOZO')")
    public ResponseEntity<List<MesaResponse>> listar() {
        return ResponseEntity.ok(mesaService.listarTodas());
    }

    @GetMapping("/libres")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'MOZO', 'ROLE_ADMIN', 'ROLE_MOZO')")
    public ResponseEntity<List<MesaResponse>> listarLibres() {
        return ResponseEntity.ok(mesaService.listarLibres());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'MOZO', 'ROLE_ADMIN', 'ROLE_MOZO')")
    public ResponseEntity<MesaResponse> obtener(@PathVariable Long id) {
        return ResponseEntity.ok(mesaService.obtener(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<MesaResponse> crear(@Valid @RequestBody CrearMesaRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(mesaService.crear(
                        request.getNumero(),
                        request.getCapacidad(),
                        request.getPosicionX(),
                        request.getPosicionY()
                ));
    }

    @PatchMapping("/{id}/estado")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'MOZO', 'ROLE_ADMIN', 'ROLE_MOZO')")
    public ResponseEntity<MesaResponse> actualizarEstado(
            @PathVariable Long id,
            @Valid @RequestBody ActualizarEstadoMesaRequest request
    ) {
        return ResponseEntity.ok(mesaService.actualizarEstado(id, request.getEstado()));
    }

    @PatchMapping("/{id}/posicion")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN', 'MOZO', 'ROLE_MOZO')")
    public ResponseEntity<MesaResponse> actualizarPosicion(
            @PathVariable Long id,
            @Valid @RequestBody ActualizarPosicionMesaRequest request
    ) {
        return ResponseEntity.ok(mesaService.actualizarPosicion(id, request.getPosicionX(), request.getPosicionY()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        mesaService.eliminar(id);
        return ResponseEntity.noContent().build();
    }
}
