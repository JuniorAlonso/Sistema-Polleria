package com.sistema.polleria.inventory.controller;

import com.sistema.polleria.inventory.dto.MermaResponse;
import com.sistema.polleria.inventory.dto.RegistrarMermaRequest;
import com.sistema.polleria.inventory.service.MermaService;
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
@RequestMapping("/inventario/mermas")
@RequiredArgsConstructor
public class MermaController {

    private final MermaService mermaService;

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN', 'CHEF', 'ROLE_CHEF')")
    public ResponseEntity<MermaResponse> registrar(
            @Valid @RequestBody RegistrarMermaRequest req,
            Principal principal) {
        Long usuarioId = extractUserId(principal);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(mermaService.registrar(req, usuarioId));
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN', 'CHEF', 'ROLE_CHEF')")
    public ResponseEntity<List<MermaResponse>> listarTodas() {
        return ResponseEntity.ok(mermaService.listarTodas());
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
