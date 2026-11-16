package com.sistema.polleria.auth.service;

import com.sistema.polleria.auth.dto.AuthResponse;
import com.sistema.polleria.auth.entity.RefreshToken;
import com.sistema.polleria.auth.entity.Role;
import com.sistema.polleria.auth.entity.User;
import com.sistema.polleria.auth.exception.TokenRefreshException;
import com.sistema.polleria.auth.repository.RefreshTokenRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RefreshTokenServiceTest {

    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private JwtService jwtService;

    @InjectMocks
    private RefreshTokenService refreshTokenService;

    @Test
    void rotacionConcurrenteDentroDePeriodoDeGraciaNoRevocaTodasLasSesiones() {
        User user = User.builder().id(1L).email("u@polleria.com").name("User").role(Role.CLIENTE).build();
        RefreshToken yaRotado = RefreshToken.builder()
                .id(1L).user(user).token("old-token").revoked(true)
                .replacedByToken("new-token")
                .rotatedAt(Instant.now().minusSeconds(2))
                .expiryDate(Instant.now().plusSeconds(3600))
                .build();
        RefreshToken reemplazo = RefreshToken.builder()
                .id(2L).user(user).token("new-token").revoked(false)
                .expiryDate(Instant.now().plusSeconds(3600))
                .build();

        when(refreshTokenRepository.findByTokenForUpdate("old-token")).thenReturn(Optional.of(yaRotado));
        when(refreshTokenRepository.findByToken("new-token")).thenReturn(Optional.of(reemplazo));
        when(jwtService.generateToken(user)).thenReturn("fresh-jwt");
        when(jwtService.getExpirationMs()).thenReturn(900_000L);

        AuthResponse response = refreshTokenService.rotateRefreshToken("old-token");

        assertEquals("fresh-jwt", response.getToken());
        assertEquals("new-token", response.getRefreshToken());
        verify(refreshTokenRepository, never()).revokeAllUserTokens(any());
    }

    @Test
    void reusoFueraDePeriodoDeGraciaRevocaTodasLasSesiones() {
        User user = User.builder().id(1L).email("u@polleria.com").name("User").role(Role.CLIENTE).build();
        RefreshToken viejo = RefreshToken.builder()
                .id(1L).user(user).token("old-token").revoked(true)
                .replacedByToken("new-token")
                .rotatedAt(Instant.now().minusSeconds(60))
                .expiryDate(Instant.now().plusSeconds(3600))
                .build();

        when(refreshTokenRepository.findByTokenForUpdate("old-token")).thenReturn(Optional.of(viejo));

        assertThrows(TokenRefreshException.class, () -> refreshTokenService.rotateRefreshToken("old-token"));
        verify(refreshTokenRepository).revokeAllUserTokens(user);
    }
}
