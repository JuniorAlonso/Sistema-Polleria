package com.sistema.polleria.orders.controller;

import com.sistema.polleria.orders.dto.OrdenResponse;
import com.sistema.polleria.orders.service.SeguimientoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Seguimiento de pedidos sin cuenta, verificando el celular con un código por WhatsApp.
 * Público: no requiere JWT.
 */
@RestController
@RequestMapping("/ordenes/seguimiento")
@RequiredArgsConstructor
public class SeguimientoController {

    private final SeguimientoService seguimientoService;

    // POST /ordenes/seguimiento/codigo  { "telefono": "987654321" }
    @PostMapping("/codigo")
    public ResponseEntity<Map<String, String>> solicitarCodigo(@RequestBody Map<String, String> body) {
        seguimientoService.solicitarCodigo(body.get("telefono"));
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of(
                "mensaje", "Si este celular tiene pedidos, recibirás un código por WhatsApp en unos segundos."
        ));
    }

    // POST /ordenes/seguimiento/verificar  { "telefono": "987654321", "codigo": "1234" }
    @PostMapping("/verificar")
    public ResponseEntity<Map<String, String>> verificar(@RequestBody Map<String, String> body) {
        String token = seguimientoService.verificarCodigo(body.get("telefono"), body.get("codigo"));
        return ResponseEntity.ok(Map.of("token", token));
    }

    // GET /ordenes/seguimiento   Header: X-Seguimiento-Token
    @GetMapping
    public ResponseEntity<List<OrdenResponse>> pedidos(@RequestHeader("X-Seguimiento-Token") String token) {
        return ResponseEntity.ok(seguimientoService.listarPedidos(token));
    }
}
