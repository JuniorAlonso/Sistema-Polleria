package com.sistema.polleria.inventory.controller;

import com.sistema.polleria.inventory.dto.AlertaStockResponse;
import com.sistema.polleria.inventory.dto.RentabilidadInventarioResponse;
import com.sistema.polleria.inventory.service.InventarioAnalisisService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/inventario")
@RequiredArgsConstructor
public class InventarioAnalisisController {

    private final InventarioAnalisisService analisisService;

    @GetMapping("/alertas")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN', 'CHEF', 'ROLE_CHEF')")
    public ResponseEntity<List<AlertaStockResponse>> obtenerAlertas() {
        return ResponseEntity.ok(analisisService.obtenerAlertasStock());
    }

    @GetMapping("/rentabilidad")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<RentabilidadInventarioResponse> obtenerRentabilidad() {
        return ResponseEntity.ok(analisisService.obtenerBalanceRentabilidad());
    }
}
