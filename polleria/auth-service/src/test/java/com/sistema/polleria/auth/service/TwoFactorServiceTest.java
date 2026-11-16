package com.sistema.polleria.auth.service;

import com.sistema.polleria.auth.entity.TwoFactorToken;
import com.sistema.polleria.auth.entity.User;
import com.sistema.polleria.auth.repository.TwoFactorTokenRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.javamail.JavaMailSender;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TwoFactorServiceTest {

    @Mock private TwoFactorTokenRepository tokenRepository;
    @Mock private JavaMailSender mailSender;

    @InjectMocks
    private TwoFactorService twoFactorService;

    @Test
    void invalidaCodigoAlSuperarMaximoIntentos() {
        User user = User.builder().id(1L).email("admin@polleria.com").name("Admin").build();
        TwoFactorToken token = TwoFactorToken.builder()
                .id(10L)
                .user(user)
                .code("123456")
                .expiresAt(LocalDateTime.now().plusMinutes(5))
                .used(false)
                .attempts(0)
                .build();

        when(tokenRepository.findTopByUserAndUsedFalseOrderByCreatedAtDesc(user))
                .thenReturn(Optional.of(token));

        for (int i = 1; i < TwoFactorService.MAX_ATTEMPTS_PER_CODE; i++) {
            assertFalse(twoFactorService.verifyCode(user, "000000"));
            assertFalse(token.isUsed());
            assertEquals(i, token.getAttempts());
        }

        assertFalse(twoFactorService.verifyCode(user, "000000"));
        assertTrue(token.isUsed(), "En el quinto intento fallido debe invalidarse el token");
        assertEquals(TwoFactorService.MAX_ATTEMPTS_PER_CODE, token.getAttempts());
        verify(tokenRepository, times(TwoFactorService.MAX_ATTEMPTS_PER_CODE)).save(token);
    }
}
