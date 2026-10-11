package com.sistema.polleria.auth.dto;

import com.sistema.polleria.auth.entity.IpBlacklist;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IpBlacklistResponse {
    private Long id;
    private String ip;
    private int failedAttempts;
    private LocalDateTime blockedUntil;
    private LocalDateTime lastAttempt;
    private boolean currentlyBlocked;

    public static IpBlacklistResponse from(IpBlacklist entity) {
        if (entity == null) return null;
        return IpBlacklistResponse.builder()
                .id(entity.getId())
                .ip(entity.getIp())
                .failedAttempts(entity.getFailedAttempts())
                .blockedUntil(entity.getBlockedUntil())
                .lastAttempt(entity.getLastAttempt())
                .currentlyBlocked(entity.isCurrentlyBlocked())
                .build();
    }
}
