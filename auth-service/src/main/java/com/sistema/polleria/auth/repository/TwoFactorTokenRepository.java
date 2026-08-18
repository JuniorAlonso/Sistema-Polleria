package com.sistema.polleria.auth.repository;

import com.sistema.polleria.auth.entity.TwoFactorToken;
import com.sistema.polleria.auth.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface TwoFactorTokenRepository extends JpaRepository<TwoFactorToken, Long> {

    Optional<TwoFactorToken> findTopByUserAndUsedFalseOrderByCreatedAtDesc(User user);

    @Modifying
    @Query("UPDATE TwoFactorToken t SET t.used = true WHERE t.user = :user AND t.used = false")
    void invalidatePreviousTokens(User user);
}
