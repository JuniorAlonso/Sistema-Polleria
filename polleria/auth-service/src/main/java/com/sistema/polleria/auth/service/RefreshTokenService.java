package com.sistema.polleria.auth.service;

import com.sistema.polleria.auth.dto.AuthResponse;
import com.sistema.polleria.auth.entity.RefreshToken;
import com.sistema.polleria.auth.entity.User;
import com.sistema.polleria.auth.exception.TokenRefreshException;
import com.sistema.polleria.auth.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private static final long GRACE_PERIOD_SECONDS = 10L;

    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtService jwtService;

    @Value("${jwt.refresh-expiration-ms:604800000}")
    private long refreshExpirationMs;

    @Transactional
    public RefreshToken createRefreshToken(User user) {
        RefreshToken refreshToken = RefreshToken.builder()
                .user(user)
                .token(UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", ""))
                .expiryDate(Instant.now().plusMillis(refreshExpirationMs))
                .revoked(false)
                .build();

        return refreshTokenRepository.save(refreshToken);
    }

    @Transactional
    public AuthResponse rotateRefreshToken(String requestRefreshToken) {
        RefreshToken existingToken = refreshTokenRepository.findByTokenForUpdate(requestRefreshToken)
                .orElseThrow(() -> new TokenRefreshException("Refresh token no encontrado o inválido"));

        User user = existingToken.getUser();

        // 1. Detección de reuso con período de gracia corto para llamadas concurrentes entre pestañas
        if (existingToken.isRevoked()) {
            if (dentroDePeriodoDeGracia(existingToken)) {
                RefreshToken reemplazo = refreshTokenRepository.findByToken(existingToken.getReplacedByToken())
                        .filter(t -> !t.isRevoked() && !t.isExpired())
                        .orElseThrow(() -> new TokenRefreshException("El refresh token ya fue utilizado"));
                String newAccessToken = jwtService.generateToken(user);
                log.debug("Refresh concurrente dentro del período de gracia para usuario: {}", user.getEmail());
                return buildAuthResponse(user, newAccessToken, reemplazo.getToken());
            }

            log.error("ALERTA DE SEGURIDAD: Intento de reuso de Refresh Token para el usuario {}. Revocando toda la cadena de sesiones.", user.getEmail());
            refreshTokenRepository.revokeAllUserTokens(user);
            throw new TokenRefreshException("Alerta de seguridad: Este refresh token ya fue utilizado. Por precaución, todas tus sesiones han sido finalizadas.");
        }

        // 2. Verificación de Expiración
        if (existingToken.isExpired()) {
            existingToken.setRevoked(true);
            refreshTokenRepository.save(existingToken);
            throw new TokenRefreshException("El refresh token ha expirado. Por favor inicia sesión nuevamente.");
        }

        // 3. Rotación: Invalida el anterior y genera el nuevo token
        existingToken.setRevoked(true);
        existingToken.setRotatedAt(Instant.now());
        RefreshToken newToken = createRefreshToken(user);
        existingToken.setReplacedByToken(newToken.getToken());
        refreshTokenRepository.save(existingToken);

        // 4. Generar nuevo Access Token (JWT)
        String newAccessToken = jwtService.generateToken(user);
        log.info("Refresh Token rotado exitosamente para el usuario: {}", user.getEmail());

        return buildAuthResponse(user, newAccessToken, newToken.getToken());
    }

    private boolean dentroDePeriodoDeGracia(RefreshToken existingToken) {
        return existingToken.getReplacedByToken() != null
                && existingToken.getRotatedAt() != null
                && Instant.now().isBefore(existingToken.getRotatedAt().plusSeconds(GRACE_PERIOD_SECONDS));
    }

    private AuthResponse buildAuthResponse(User user, String accessToken, String refreshToken) {
        return AuthResponse.builder()
                .token(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(jwtService.getExpirationMs())
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole())
                .requiresTwoFactor(false)
                .message("Token renovado exitosamente")
                .build();
    }

    @Transactional
    public void revokeToken(String tokenStr) {
        refreshTokenRepository.findByToken(tokenStr).ifPresent(token -> {
            token.setRevoked(true);
            refreshTokenRepository.save(token);
            log.info("Refresh Token revocado para usuario: {}", token.getUser().getEmail());
        });
    }

    @Transactional
    public void revokeAllForUser(User user) {
        refreshTokenRepository.revokeAllUserTokens(user);
        log.info("Todas las sesiones revocadas para usuario: {}", user.getEmail());
    }
}
