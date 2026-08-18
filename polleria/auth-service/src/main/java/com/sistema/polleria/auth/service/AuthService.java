package com.sistema.polleria.auth.service;

import com.sistema.polleria.auth.dto.AuthResponse;
import com.sistema.polleria.auth.dto.LoginRequest;
import com.sistema.polleria.auth.dto.RegisterRequest;
import com.sistema.polleria.auth.dto.TwoFactorRequest;
import com.sistema.polleria.auth.entity.Role;
import com.sistema.polleria.auth.entity.User;
import com.sistema.polleria.auth.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final IpBlacklistService ipBlacklistService;
    private final TwoFactorService twoFactorService;

    // Roles que requieren 2FA
    private static final Set<Role> ROLES_WITH_2FA = Set.of(Role.ADMIN, Role.MOZO, Role.COCINA, Role.REPARTIDOR);

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("El correo ya está registrado");
        }
        if (request.getPhone() != null && !request.getPhone().isBlank()
                && userRepository.existsByPhone(request.getPhone())) {
            throw new IllegalArgumentException("El celular ya está registrado");
        }

        User user = User.builder()
                .name(request.getName())
                .email(request.getEmail().toLowerCase())
                .phone(request.getPhone())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(request.getRole())
                .build();

        userRepository.save(user);
        log.info("Usuario registrado: {} con rol {}", user.getEmail(), user.getRole());

        String token = jwtService.generateToken(user);
        return AuthResponse.builder()
                .token(token)
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole())
                .requiresTwoFactor(false)
                .message("Registro exitoso")
                .build();
    }

    @Transactional
    public AuthResponse login(LoginRequest request, HttpServletRequest httpRequest) {
        String ip = getClientIp(httpRequest);

        // Verificar bloqueo de IP
        if (ipBlacklistService.isBlocked(ip)) {
            throw new IllegalStateException("Tu IP ha sido bloqueada temporalmente por múltiples intentos fallidos. Intenta más tarde.");
        }

        // Buscar usuario por email o teléfono
        User user = userRepository.findByEmail(request.getIdentifier().toLowerCase())
                .or(() -> userRepository.findByPhone(request.getIdentifier()))
                .orElseThrow(() -> {
                    ipBlacklistService.registerFailedAttempt(ip);
                    return new BadCredentialsException("Credenciales inválidas");
                });

        // Autenticar
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(user.getEmail(), request.getPassword())
            );
        } catch (BadCredentialsException e) {
            ipBlacklistService.registerFailedAttempt(ip);
            throw new BadCredentialsException("Credenciales inválidas");
        }

        // Login exitoso → resetear intentos fallidos
        ipBlacklistService.resetFailedAttempts(ip);

        // ¿Requiere 2FA?
        if (ROLES_WITH_2FA.contains(user.getRole())) {
            twoFactorService.sendVerificationCode(user);
            log.info("Login parcial (pendiente 2FA) para: {}", user.getEmail());
            return AuthResponse.builder()
                    .email(user.getEmail())
                    .role(user.getRole())
                    .requiresTwoFactor(true)
                    .message("Se envió un código de verificación a tu correo")
                    .build();
        }

        // Cliente/REPARTIDOR: login directo
        String token = jwtService.generateToken(user);
        log.info("Login exitoso para: {}", user.getEmail());
        return AuthResponse.builder()
                .token(token)
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole())
                .requiresTwoFactor(false)
                .message("Login exitoso")
                .build();
    }

    @Transactional
    public AuthResponse verifyTwoFactor(TwoFactorRequest request, HttpServletRequest httpRequest) {
        String ip = getClientIp(httpRequest);

        User user = userRepository.findByEmail(request.getEmail().toLowerCase())
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        boolean valid = twoFactorService.verifyCode(user, request.getCode());
        if (!valid) {
            ipBlacklistService.registerFailedAttempt(ip);
            throw new IllegalArgumentException("Código de verificación inválido o expirado");
        }

        ipBlacklistService.resetFailedAttempts(ip);
        String token = jwtService.generateToken(user);
        log.info("Verificación 2FA exitosa para: {}", user.getEmail());

        return AuthResponse.builder()
                .token(token)
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole())
                .requiresTwoFactor(false)
                .message("Autenticación completada")
                .build();
    }

    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
