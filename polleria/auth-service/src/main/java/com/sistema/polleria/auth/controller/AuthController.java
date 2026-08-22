package com.sistema.polleria.auth.controller;

import com.sistema.polleria.auth.dto.AuthResponse;
import com.sistema.polleria.auth.dto.LoginRequest;
import com.sistema.polleria.auth.dto.RegisterRequest;
import com.sistema.polleria.auth.dto.TwoFactorRequest;
import com.sistema.polleria.auth.service.AuthService;
import com.sistema.polleria.auth.service.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    // POST /auth/register
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    // POST /auth/login
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest
    ) {
        return ResponseEntity.ok(authService.login(request, httpRequest));
    }

    // POST /auth/verify-2fa
    @PostMapping("/verify-2fa")
    public ResponseEntity<AuthResponse> verifyTwoFactor(
            @Valid @RequestBody TwoFactorRequest request,
            HttpServletRequest httpRequest
    ) {
        return ResponseEntity.ok(authService.verifyTwoFactor(request, httpRequest));
    }

    // GET /auth/validate  — usado por otros microservicios para validar el token
    @GetMapping("/validate")
    public ResponseEntity<Map<String, Object>> validateToken(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("valid", false, "message", "Token ausente"));
        }

        String token = authHeader.substring(7);
        try {
            String email = jwtService.extractUsername(token);
            var userDetails = userDetailsService.loadUserByUsername(email);

            if (jwtService.isTokenValid(token, userDetails)) {
                String role = userDetails.getAuthorities().iterator().next().getAuthority();
                return ResponseEntity.ok(Map.of(
                        "valid", true,
                        "email", email,
                        "role", role
                ));
            }
        } catch (Exception ignored) { }

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("valid", false, "message", "Token inválido o expirado"));
    }
}
