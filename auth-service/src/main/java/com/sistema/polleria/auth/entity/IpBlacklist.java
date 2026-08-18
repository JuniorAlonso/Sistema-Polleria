package com.sistema.polleria.auth.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "ip_blacklist")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IpBlacklist {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 45)
    private String ip;

    @Column(nullable = false)
    @Builder.Default
    private int failedAttempts = 0;

    private LocalDateTime blockedUntil;

    private LocalDateTime lastAttempt;

    public boolean isCurrentlyBlocked() {
        return blockedUntil != null && LocalDateTime.now().isBefore(blockedUntil);
    }
}
