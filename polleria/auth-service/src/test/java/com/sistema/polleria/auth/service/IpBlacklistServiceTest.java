package com.sistema.polleria.auth.service;

import com.sistema.polleria.auth.dto.IpBlacklistResponse;
import com.sistema.polleria.auth.entity.IpBlacklist;
import com.sistema.polleria.auth.repository.IpBlacklistRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class IpBlacklistServiceTest {

    @Mock
    private IpBlacklistRepository ipBlacklistRepository;

    @InjectMocks
    private IpBlacklistService ipBlacklistService;

    @Test
    @DisplayName("Debe registrar un intento fallido y bloquear la IP si supera el umbral maximo")
    void registerFailedAttempt_bloqueaSiSuperaUmbral() {
        ReflectionTestUtils.setField(ipBlacklistService, "maxFailedAttempts", 3);
        ReflectionTestUtils.setField(ipBlacklistService, "blockDurationMinutes", 15);

        IpBlacklist registro = IpBlacklist.builder()
                .ip("192.168.1.100")
                .failedAttempts(2)
                .build();

        when(ipBlacklistRepository.findByIp("192.168.1.100")).thenReturn(Optional.of(registro));
        when(ipBlacklistRepository.save(any(IpBlacklist.class))).thenAnswer(inv -> inv.getArgument(0));

        ipBlacklistService.registerFailedAttempt("192.168.1.100");

        assertThat(registro.getFailedAttempts()).isEqualTo(3);
        assertThat(registro.getBlockedUntil()).isNotNull();
        verify(ipBlacklistRepository).save(registro);
    }

    @Test
    @DisplayName("Debe desbloquear manualmente una IP restableciendo intentos y fecha de bloqueo")
    void desbloquearIp_restableceIntentos() {
        IpBlacklist bloqueada = IpBlacklist.builder()
                .ip("200.48.10.5")
                .failedAttempts(5)
                .blockedUntil(LocalDateTime.now().plusMinutes(10))
                .build();

        when(ipBlacklistRepository.findByIp("200.48.10.5")).thenReturn(Optional.of(bloqueada));
        when(ipBlacklistRepository.save(any(IpBlacklist.class))).thenAnswer(inv -> inv.getArgument(0));

        ipBlacklistService.desbloquearIp("200.48.10.5");

        assertThat(bloqueada.getFailedAttempts()).isEqualTo(0);
        assertThat(bloqueada.getBlockedUntil()).isNull();
        verify(ipBlacklistRepository).save(bloqueada);
    }

    @Test
    @DisplayName("Debe listar todas las IPs bloqueadas o con intentos registrados")
    void listarIpsBloqueadas_retornaDtos() {
        IpBlacklist registro = IpBlacklist.builder()
                .ip("10.0.0.1")
                .failedAttempts(2)
                .lastAttempt(LocalDateTime.now())
                .build();

        when(ipBlacklistRepository.findAllByOrderByLastAttemptDesc()).thenReturn(List.of(registro));

        List<IpBlacklistResponse> res = ipBlacklistService.listarIpsBloqueadas();

        assertThat(res).hasSize(1);
        assertThat(res.get(0).getIp()).isEqualTo("10.0.0.1");
        assertThat(res.get(0).getFailedAttempts()).isEqualTo(2);
    }
}
