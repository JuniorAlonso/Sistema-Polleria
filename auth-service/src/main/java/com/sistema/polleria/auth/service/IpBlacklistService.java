package com.sistema.polleria.auth.service;

import com.sistema.polleria.auth.entity.IpBlacklist;
import com.sistema.polleria.auth.repository.IpBlacklistRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class IpBlacklistService {

    private final IpBlacklistRepository ipBlacklistRepository;

    @Value("${security.max-failed-attempts:5}")
    private int maxFailedAttempts;

    @Value("${security.block-duration-minutes:15}")
    private int blockDurationMinutes;

    public boolean isBlocked(String ip) {
        return ipBlacklistRepository.findByIp(ip)
                .map(IpBlacklist::isCurrentlyBlocked)
                .orElse(false);
    }

    @Transactional
    public void registerFailedAttempt(String ip) {
        IpBlacklist record = ipBlacklistRepository.findByIp(ip)
                .orElseGet(() -> IpBlacklist.builder().ip(ip).failedAttempts(0).build());

        record.setFailedAttempts(record.getFailedAttempts() + 1);
        record.setLastAttempt(LocalDateTime.now());

        if (record.getFailedAttempts() >= maxFailedAttempts) {
            record.setBlockedUntil(LocalDateTime.now().plusMinutes(blockDurationMinutes));
            log.warn("IP bloqueada por {} minutos: {}", blockDurationMinutes, ip);
        }

        ipBlacklistRepository.save(record);
    }

    @Transactional
    public void resetFailedAttempts(String ip) {
        ipBlacklistRepository.findByIp(ip).ifPresent(record -> {
            record.setFailedAttempts(0);
            record.setBlockedUntil(null);
            ipBlacklistRepository.save(record);
        });
    }
}
